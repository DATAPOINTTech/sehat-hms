<?php
// backend/routes/queue.php

/**
 * Executes the 10-Minute Auto-Shift check.
 * If any patient marked 'Called' has been waiting for >= 10 minutes (600 seconds),
 * automatically marks them 'Skipped (No-Show)' and calls the next 'Waiting' patient in that doctor's queue.
 */
function checkAndApplyAutoShift(PDO $db, ?int $targetDoctorId = null): array {
    $shifted = [];
    $query = "SELECT * FROM doctor_queue WHERE status = 'Called'";
    $params = [];
    if ($targetDoctorId !== null) {
        $query .= " AND doctor_id = ?";
        $params[] = $targetDoctorId;
    }

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $calledTokens = $stmt->fetchAll();

    $now = time();
    foreach ($calledTokens as $token) {
        if (empty($token['called_at'])) {
            continue;
        }

        $calledTime = strtotime($token['called_at']);
        $elapsed = $now - $calledTime;

        // 10 minutes = 600 seconds
        if ($elapsed >= 600) {
            // 1. Mark current as Skipped (No-Show)
            $uStmt = $db->prepare("UPDATE doctor_queue SET status = 'Skipped (No-Show)' WHERE id = ?");
            $uStmt->execute([$token['id']]);

            // 2. Find next waiting token for this doctor
            $nStmt = $db->prepare("
                SELECT * FROM doctor_queue
                WHERE doctor_id = ? AND status = 'Waiting'
                ORDER BY token_number ASC
                LIMIT 1
            ");
            $nStmt->execute([$token['doctor_id']]);
            $nextToken = $nStmt->fetch();

            $nextCalledId = null;
            if ($nextToken) {
                $cStmt = $db->prepare("UPDATE doctor_queue SET status = 'Called', called_at = datetime('now') WHERE id = ?");
                $cStmt->execute([$nextToken['id']]);
                $nextCalledId = $nextToken['id'];
            }

            $shifted[] = [
                'skipped_token_id' => $token['id'],
                'skipped_token_number' => $token['token_number'],
                'doctor_id' => $token['doctor_id'],
                'elapsed_seconds' => $elapsed,
                'next_called_token_id' => $nextCalledId
            ];
        }
    }

    return $shifted;
}

function handleQueueRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    // Run auto-shift check on every queue inquiry
    $autoShiftResults = checkAndApplyAutoShift($db);

    if ($method === 'GET') {
        parse_str($queryString ?? '', $queryParams);
        $doctorId = isset($queryParams['doctor_id']) ? (int)$queryParams['doctor_id'] : null;

        $sql = "
            SELECT q.*, p.mr_no, p.name as patient_name, p.gender, p.phone, p.blood_group,
                   d.name as doctor_name, d.specialty, d.room_no
            FROM doctor_queue q
            JOIN patients p ON q.patient_id = p.id
            JOIN doctors d ON q.doctor_id = d.id
        ";
        $params = [];
        if ($doctorId) {
            $sql .= " WHERE q.doctor_id = ?";
            $params[] = $doctorId;
        }
        $sql .= " ORDER BY q.token_number ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $tokens = $stmt->fetchAll();

        // Calculate remaining seconds for any active Called tokens
        $now = time();
        foreach ($tokens as &$t) {
            if ($t['status'] === 'Called' && !empty($t['called_at'])) {
                $elapsed = $now - strtotime($t['called_at']);
                $remaining = max(0, 600 - $elapsed);
                $t['countdown_seconds_remaining'] = $remaining;
                $t['elapsed_seconds'] = $elapsed;
            } else {
                $t['countdown_seconds_remaining'] = null;
            }
        }

        echo json_encode([
            'success' => true,
            'queue' => $tokens,
            'auto_shifted' => $autoShiftResults,
            'server_time' => date('Y-m-d H:i:s')
        ]);
        return;
    }

    if ($method === 'POST') {
        $subAction = $uriParts[2] ?? '';
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $tokenId = (int)($data['token_id'] ?? 0);

        if ($subAction === 'call') {
            if (!$tokenId) {
                http_response_code(400);
                echo json_encode(['error' => 'token_id is required']);
                return;
            }
            // Set called_at to current timestamp and status = 'Called'
            $stmt = $db->prepare("UPDATE doctor_queue SET status = 'Called', called_at = datetime('now') WHERE id = ?");
            $stmt->execute([$tokenId]);

            echo json_encode(['success' => true, 'message' => 'Token marked as Called. 10-minute timer started.']);
            return;
        }

        if ($subAction === 'start') {
            if (!$tokenId) {
                http_response_code(400);
                echo json_encode(['error' => 'token_id is required']);
                return;
            }
            $stmt = $db->prepare("UPDATE doctor_queue SET status = 'In Consultation', started_at = datetime('now') WHERE id = ?");
            $stmt->execute([$tokenId]);

            echo json_encode(['success' => true, 'message' => 'Consultation started.']);
            return;
        }

        if ($subAction === 'skip') {
            if (!$tokenId) {
                http_response_code(400);
                echo json_encode(['error' => 'token_id is required']);
                return;
            }

            // Get token doctor_id before skipping
            $tStmt = $db->prepare("SELECT doctor_id FROM doctor_queue WHERE id = ?");
            $tStmt->execute([$tokenId]);
            $doctorId = $tStmt->fetchColumn();

            // Mark skipped
            $stmt = $db->prepare("UPDATE doctor_queue SET status = 'Skipped (No-Show)' WHERE id = ?");
            $stmt->execute([$tokenId]);

            // Auto-shift: Call next waiting patient
            $nStmt = $db->prepare("
                SELECT id FROM doctor_queue
                WHERE doctor_id = ? AND status = 'Waiting'
                ORDER BY token_number ASC LIMIT 1
            ");
            $nStmt->execute([$doctorId]);
            $nextTokenId = $nStmt->fetchColumn();

            if ($nextTokenId) {
                $cStmt = $db->prepare("UPDATE doctor_queue SET status = 'Called', called_at = datetime('now') WHERE id = ?");
                $cStmt->execute([$nextTokenId]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Token skipped and turn auto-shifted to next waiting patient.',
                'next_token_id' => $nextTokenId ?: null
            ]);
            return;
        }

        if ($subAction === 'complete') {
            if (!$tokenId) {
                http_response_code(400);
                echo json_encode(['error' => 'token_id is required']);
                return;
            }
            $stmt = $db->prepare("UPDATE doctor_queue SET status = 'Completed', completed_at = datetime('now') WHERE id = ?");
            $stmt->execute([$tokenId]);

            echo json_encode(['success' => true, 'message' => 'Token marked as Completed.']);
            return;
        }

        // Fast-Forward 10 Min Demo Button!
        if ($subAction === 'fast-forward-10m') {
            $doctorId = isset($data['doctor_id']) ? (int)$data['doctor_id'] : null;

            // Find current Called token
            $sql = "SELECT id, doctor_id, token_number FROM doctor_queue WHERE status = 'Called'";
            $params = [];
            if ($doctorId) {
                $sql .= " AND doctor_id = ?";
                $params[] = $doctorId;
            }
            $sql .= " ORDER BY id ASC LIMIT 1";

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $calledToken = $stmt->fetch();

            if (!$calledToken) {
                http_response_code(404);
                echo json_encode(['error' => 'No active Called token found to fast-forward. Please click "Call Patient" first.']);
                return;
            }

            // Set called_at to 11 minutes ago so auto-shift immediately triggers!
            $pastTime = date('Y-m-d H:i:s', time() - 660);
            $uStmt = $db->prepare("UPDATE doctor_queue SET called_at = ? WHERE id = ?");
            $uStmt->execute([$pastTime, $calledToken['id']]);

            // Execute auto shift
            $shifts = checkAndApplyAutoShift($db, (int)$calledToken['doctor_id']);

            echo json_encode([
                'success' => true,
                'message' => "Fast-forwarded 10 minutes! Token #{$calledToken['token_number']} marked Skipped (No-Show) and next patient auto-called.",
                'shifts' => $shifts
            ]);
            return;
        }

        // Add walk-in queue token
        if ($subAction === 'add') {
            $patientId = (int)($data['patient_id'] ?? 0);
            $doctorId = (int)($data['doctor_id'] ?? 0);
            $source = trim($data['source'] ?? 'Walk-in');

            if (!$patientId || !$doctorId) {
                http_response_code(400);
                echo json_encode(['error' => 'patient_id and doctor_id are required']);
                return;
            }

            $stmt = $db->prepare("
                SELECT COALESCE(MAX(token_number), 0) + 1 FROM doctor_queue
                WHERE doctor_id = ? AND date(created_at) = date('now')
            ");
            $stmt->execute([$doctorId]);
            $nextToken = (int)$stmt->fetchColumn();

            $stmt = $db->prepare("
                INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, source)
                VALUES (?, ?, ?, 'Waiting', ?)
            ");
            $stmt->execute([$doctorId, $patientId, $nextToken, $source]);
            $id = $db->lastInsertId();

            echo json_encode(['success' => true, 'token_id' => $id, 'token_number' => $nextToken]);
            return;
        }
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
