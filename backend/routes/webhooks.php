<?php
// backend/routes/webhooks.php

function handleWebhookRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $config = require __DIR__ . '/../config/config.php';
    $verifyToken = $config['whatsapp']['verify_token'] ?? 'sehat_demo_token_2026';

    // 1. WhatsApp Webhook Verification (Meta Cloud API hub challenge)
    if ($method === 'GET') {
        parse_str($queryString ?? '', $params);
        $mode = $params['hub_mode'] ?? $params['hub.mode'] ?? '';
        $token = $params['hub_verify_token'] ?? $params['hub.verify_token'] ?? '';
        $challenge = $params['hub_challenge'] ?? $params['hub.challenge'] ?? '';

        if ($mode === 'subscribe' && $token === $verifyToken) {
            header('Content-Type: text/plain');
            echo $challenge;
            return;
        }

        echo json_encode([
            'status' => 'active',
            'message' => 'Sehat WhatsApp Webhook endpoint is live. Submit POST requests to book appointments.'
        ]);
        return;
    }

    // 2. Process incoming WhatsApp message (Meta Cloud API / Twilio / UI Simulator)
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? [];

        // Support both direct simulation payload and standard Meta Webhook shape:
        // Shape 1: { "patient_name": "...", "patient_phone": "...", "message": "...", "doctor_id": 1 }
        // Shape 2: Meta Cloud API: { "entry": [{ "changes": [{ "value": { "messages": [...], "contacts": [...] } }] }] }
        $senderPhone = '';
        $senderName = 'WhatsApp Patient';
        $messageBody = '';
        $doctorId = 1; // Default to Dr. Sarah Jenkins (Cardiology)

        if (isset($data['entry'][0]['changes'][0]['value']['messages'][0])) {
            $msgObj = $data['entry'][0]['changes'][0]['value']['messages'][0];
            $senderPhone = $msgObj['from'] ?? '';
            $messageBody = $msgObj['text']['body'] ?? '';

            if (isset($data['entry'][0]['changes'][0]['value']['contacts'][0]['profile']['name'])) {
                $senderName = $data['entry'][0]['changes'][0]['value']['contacts'][0]['profile']['name'];
            }
        } else {
            // Direct simulator format
            $senderPhone = trim($data['patient_phone'] ?? $data['from'] ?? '+1-555-0199');
            $senderName = trim($data['patient_name'] ?? $data['name'] ?? 'WhatsApp Patient');
            $messageBody = trim($data['message'] ?? 'Book appointment for consultation');
            $doctorId = (int)($data['doctor_id'] ?? 1);
        }

        // Intelligently infer doctor from message if mentions specialty
        $lowerMsg = strtolower($messageBody);
        if (str_contains($lowerMsg, 'cardio') || str_contains($lowerMsg, 'heart') || str_contains($lowerMsg, 'chest')) {
            $doctorId = 1; // Dr. Sarah Jenkins (Cardiology)
        } elseif (str_contains($lowerMsg, 'child') || str_contains($lowerMsg, 'baby') || str_contains($lowerMsg, 'pediatric') || str_contains($lowerMsg, 'cough')) {
            $doctorId = 3; // Dr. Priya Patel (Pediatrics)
        } elseif (str_contains($lowerMsg, 'fever') || str_contains($lowerMsg, 'flu') || str_contains($lowerMsg, 'sugar') || str_contains($lowerMsg, 'general')) {
            $doctorId = 2; // Dr. Farhan Ahmed (General Medicine)
        }

        // 1. Find or create patient by phone
        $stmt = $db->prepare("SELECT id, mr_no, name FROM patients WHERE phone = ?");
        $stmt->execute([$senderPhone]);
        $existingPatient = $stmt->fetch();

        $patientId = 0;
        $mrNo = '';

        if ($existingPatient) {
            $patientId = (int)$existingPatient['id'];
            $mrNo = $existingPatient['mr_no'];
            $senderName = $existingPatient['name'];
        } else {
            // Auto-generate sequential MR No
            $year = date('Y');
            $stmt = $db->prepare("SELECT mr_no FROM patients WHERE mr_no LIKE ? ORDER BY id DESC LIMIT 1");
            $stmt->execute(["MR-{$year}-%"]);
            $lastMr = $stmt->fetchColumn();
            $nextSeq = ($lastMr && preg_match("/MR-{$year}-(\\d+)/", $lastMr, $m)) ? ((int)$m[1] + 1) : rand(10, 99);
            $mrNo = sprintf("MR-%s-%04d", $year, $nextSeq);

            $stmt = $db->prepare("
                INSERT INTO patients (mr_no, name, gender, dob, phone, email, address, blood_group)
                VALUES (?, ?, 'Other', '1995-01-01', ?, '', 'WhatsApp Booking', 'Unknown')
            ");
            $stmt->execute([$mrNo, $senderName, $senderPhone]);
            $patientId = (int)$db->lastInsertId();
        }

        // 2. Fetch Doctor Info
        $dStmt = $db->prepare("SELECT name, specialty, room_no FROM doctors WHERE id = ?");
        $dStmt->execute([$doctorId]);
        $doctor = $dStmt->fetch();

        // 3. Create Appointment
        $aStmt = $db->prepare("
            INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
            VALUES (?, ?, 'WhatsApp', date('now'), '11:30 AM', ?, 'Checked-in')
        ");
        $aStmt->execute([$patientId, $doctorId, $messageBody]);
        $appointmentId = (int)$db->lastInsertId();

        // 4. Centralized Sync: Auto-enqueue in doctor_queue immediately
        $tStmt = $db->prepare("
            SELECT COALESCE(MAX(token_number), 0) + 1 FROM doctor_queue
            WHERE doctor_id = ? AND date(created_at) = date('now')
        ");
        $tStmt->execute([$doctorId]);
        $nextToken = (int)$tStmt->fetchColumn();

        $qStmt = $db->prepare("
            INSERT INTO doctor_queue (doctor_id, patient_id, appointment_id, token_number, status, source)
            VALUES (?, ?, ?, ?, 'Waiting', 'WhatsApp')
        ");
        $qStmt->execute([$doctorId, $patientId, $appointmentId, $nextToken]);
        $queueId = (int)$db->lastInsertId();

        // 5. Build WhatsApp Reply Message
        $replyText = "Hello {$senderName}! Your appointment with {$doctor['name']} ({$doctor['specialty']}) is confirmed.\n\n"
            . "📋 MR Number: {$mrNo}\n"
            . "🎫 Live Queue Token: #{$nextToken}\n"
            . "🏥 Room: {$doctor['room_no']}\n"
            . "Please arrive 10 minutes early. You can track your turn on our live Queue Board!";

        echo json_encode([
            'success' => true,
            'message' => 'WhatsApp booking processed and synchronized into live QMS',
            'mr_no' => $mrNo,
            'token_number' => $nextToken,
            'doctor_name' => $doctor['name'],
            'room_no' => $doctor['room_no'],
            'whatsapp_reply' => $replyText,
            'appointment_id' => $appointmentId,
            'queue_id' => $queueId
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
