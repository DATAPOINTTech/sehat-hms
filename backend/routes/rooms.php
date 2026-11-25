<?php
// backend/routes/rooms.php

function handleRoomsRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    if ($method === 'GET') {
        // List all rooms with active admission and patient info
        $stmt = $db->query("
            SELECT r.*,
                   a.id as admission_id, a.admitted_at, a.diagnosis,
                   p.id as patient_id, p.mr_no, p.name as patient_name, p.gender, p.phone,
                   d.name as doctor_name
            FROM rooms r
            LEFT JOIN admissions a ON r.current_admission_id = a.id AND a.status = 'Active'
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            ORDER BY r.ward_category ASC, r.room_number ASC
        ");
        $rooms = $stmt->fetchAll();

        // Calculate days stayed for occupied rooms
        $now = time();
        foreach ($rooms as &$room) {
            if ($room['status'] === 'Occupied' && !empty($room['admitted_at'])) {
                $days = max(1, (int)ceil(($now - strtotime($room['admitted_at'])) / 86400));
                $room['current_stay_days'] = $days;
                $room['accumulated_room_charges'] = $days * (float)$room['daily_rate'];
            } else {
                $room['current_stay_days'] = 0;
                $room['accumulated_room_charges'] = 0.0;
            }
        }

        echo json_encode(['success' => true, 'rooms' => $rooms]);
        return;
    }

    if ($method === 'POST') {
        $sub = $uriParts[2] ?? '';
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // Allot Room / Direct Admission: POST /api/rooms/admit or POST /api/admissions
        if ($sub === 'admit' || $sub === '') {
            $patientId = (int)($data['patient_id'] ?? 0);
            $doctorId = (int)($data['doctor_id'] ?? 1);
            $roomId = (int)($data['room_id'] ?? 0);
            $diagnosis = trim($data['diagnosis'] ?? 'Inpatient Medical Care');
            $inpatientPrescriptions = trim($data['inpatient_prescriptions'] ?? '');
            $notes = trim($data['notes'] ?? '');

            if (!$patientId || !$roomId) {
                http_response_code(400);
                echo json_encode(['error' => 'patient_id and room_id are required']);
                return;
            }

            // Check if room is available
            $rStmt = $db->prepare("SELECT status FROM rooms WHERE id = ?");
            $rStmt->execute([$roomId]);
            $currentStatus = $rStmt->fetchColumn();
            if ($currentStatus !== 'Available') {
                http_response_code(400);
                echo json_encode(['error' => "Room is currently {$currentStatus} and cannot be allotted"]);
                return;
            }

            // Create admission
            $stmt = $db->prepare("
                INSERT INTO admissions (patient_id, doctor_id, room_id, diagnosis, inpatient_prescriptions, total_days, status, notes)
                VALUES (?, ?, ?, ?, ?, 1, 'Active', ?)
            ");
            $stmt->execute([$patientId, $doctorId, $roomId, $diagnosis, $inpatientPrescriptions, $notes]);
            $admissionId = (int)$db->lastInsertId();

            // Mark room occupied
            $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = {$admissionId} WHERE id = {$roomId}");

            echo json_encode([
                'success' => true,
                'message' => 'Patient successfully admitted and room allotted',
                'admission_id' => $admissionId
            ]);
            return;
        }

        // Room Transfer: POST /api/rooms/transfer
        if ($sub === 'transfer') {
            $admissionId = (int)($data['admission_id'] ?? 0);
            $newRoomId = (int)($data['new_room_id'] ?? 0);

            if (!$admissionId || !$newRoomId) {
                http_response_code(400);
                echo json_encode(['error' => 'admission_id and new_room_id are required']);
                return;
            }

            // Verify new room is available
            $rStmt = $db->prepare("SELECT status, room_number FROM rooms WHERE id = ?");
            $rStmt->execute([$newRoomId]);
            $newRoom = $rStmt->fetch();
            if (!$newRoom || $newRoom['status'] !== 'Available') {
                http_response_code(400);
                echo json_encode(['error' => 'Selected room is not available for transfer']);
                return;
            }

            // Get old room id
            $admStmt = $db->prepare("SELECT room_id FROM admissions WHERE id = ?");
            $admStmt->execute([$admissionId]);
            $oldRoomId = (int)$admStmt->fetchColumn();

            // Free old room to Cleaning
            if ($oldRoomId) {
                $db->exec("UPDATE rooms SET status = 'Cleaning', current_admission_id = NULL WHERE id = {$oldRoomId}");
            }

            // Assign new room
            $db->prepare("UPDATE admissions SET room_id = ? WHERE id = ?")->execute([$newRoomId, $admissionId]);
            $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = {$admissionId} WHERE id = {$newRoomId}");

            echo json_encode([
                'success' => true,
                'message' => "Patient successfully transferred to {$newRoom['room_number']}. Old room marked Cleaning."
            ]);
            return;
        }

        // Discharge Patient: POST /api/rooms/discharge
        if ($sub === 'discharge') {
            $admissionId = (int)($data['admission_id'] ?? 0);
            if (!$admissionId) {
                http_response_code(400);
                echo json_encode(['error' => 'admission_id is required']);
                return;
            }

            $stmt = $db->prepare("
                SELECT a.*, r.id as room_id, r.room_number, r.daily_rate, p.mr_no, p.name as patient_name
                FROM admissions a
                JOIN rooms r ON a.room_id = r.id
                JOIN patients p ON a.patient_id = p.id
                WHERE a.id = ?
            ");
            $stmt->execute([$admissionId]);
            $adm = $stmt->fetch();
            if (!$adm) {
                http_response_code(404);
                echo json_encode(['error' => 'Admission record not found']);
                return;
            }

            // Calculate stay days: at least 1 day
            $staySeconds = time() - strtotime($adm['admitted_at']);
            $stayDays = max(1, (int)ceil($staySeconds / 86400));
            $roomCharges = $stayDays * (float)$adm['daily_rate'];

            // 1. Mark Admission Discharged
            $db->prepare("
                UPDATE admissions
                SET status = 'Discharged', discharged_at = datetime('now'), total_days = ?
                WHERE id = ?
            ")->execute([$stayDays, $admissionId]);

            // 2. Free Room and set to Cleaning
            $db->exec("UPDATE rooms SET status = 'Cleaning', current_admission_id = NULL WHERE id = {$adm['room_id']}");

            // 3. Automatically add room charges to an invoice for the patient
            $year = date('Y');
            $invNo = sprintf("INV-%s-%04d", $year, rand(1000, 9999));
            $invStmt = $db->prepare("
                INSERT INTO invoices (invoice_no, patient_id, subtotal, discount, tax, total_amount, paid_amount, payment_status, notes)
                VALUES (?, ?, ?, 0.00, 0.00, ?, 0.00, 'Unpaid', ?)
            ");
            $invStmt->execute([
                $invNo, $adm['patient_id'], $roomCharges, $roomCharges,
                "Inpatient Stay: Room {$adm['room_number']} for {$stayDays} day(s)"
            ]);
            $invoiceId = (int)$db->lastInsertId();

            $itemStmt = $db->prepare("
                INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
                VALUES (?, 'Room', ?, ?, ?, ?, ?)
            ");
            $itemStmt->execute([
                $invoiceId,
                "Room Accommodation: {$adm['room_number']} ({$adm['ward_category']})",
                (float)$adm['daily_rate'],
                $stayDays,
                $roomCharges,
                $admissionId
            ]);

            echo json_encode([
                'success' => true,
                'message' => "Patient {$adm['patient_name']} discharged after {$stayDays} day(s). Room {$adm['room_number']} set to Cleaning. Bill #{$invNo} generated.",
                'stay_days' => $stayDays,
                'room_charges' => $roomCharges,
                'invoice_no' => $invNo
            ]);
            return;
        }

        // Room Status Update (e.g., Cleaning -> Available): POST /api/rooms/status
        if ($sub === 'status') {
            $roomId = (int)($data['room_id'] ?? 0);
            $newStatus = trim($data['status'] ?? 'Available');

            if (!$roomId || !in_array($newStatus, ['Available', 'Occupied', 'Cleaning'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid room_id or status']);
                return;
            }

            $db->prepare("UPDATE rooms SET status = ? WHERE id = ?")->execute([$newStatus, $roomId]);

            echo json_encode(['success' => true, 'message' => "Room status updated to {$newStatus}"]);
            return;
        }
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
