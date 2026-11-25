<?php
// backend/routes/appointments.php

function handleAppointmentsRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $sub = $uriParts[2] ?? '';

    if ($method === 'GET' && $sub === 'slots') {
        parse_str($queryString ?? '', $params);
        $doctorId = (int)($params['doctor_id'] ?? 1);
        $date = trim($params['date'] ?? date('Y-m-d'));

        $standardSlots = [
            '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
            '11:00 AM', '11:30 AM', '12:00 PM',
            '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
        ];

        $stmt = $db->prepare("
            SELECT time_slot FROM appointments
            WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'
        ");
        $stmt->execute([$doctorId, $date]);
        $bookedSlots = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $slots = [];
        foreach ($standardSlots as $slot) {
            $slots[] = [
                'time_slot' => $slot,
                'is_available' => !in_array($slot, $bookedSlots, true),
            ];
        }

        echo json_encode([
            'success' => true,
            'doctor_id' => $doctorId,
            'date' => $date,
            'slots' => $slots
        ]);
        return;
    }

    if ($method === 'GET') {
        $stmt = $db->query("
            SELECT a.*, p.mr_no, p.name as patient_name, p.phone as patient_phone, d.name as doctor_name, d.specialty
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            ORDER BY a.appointment_date DESC, a.time_slot ASC
        ");
        $appointments = $stmt->fetchAll();
        echo json_encode(['success' => true, 'appointments' => $appointments]);
        return;
    }

    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $patientId = (int)($data['patient_id'] ?? 0);
        $doctorId = (int)($data['doctor_id'] ?? 0);
        $source = trim($data['booking_source'] ?? 'Online');
        $date = trim($data['appointment_date'] ?? date('Y-m-d'));
        $timeSlot = trim($data['time_slot'] ?? '10:00 AM');
        $symptoms = trim($data['symptoms'] ?? '');

        // If patient_id is not given, check if patient details are provided (e.g. from public booking form)
        if ($patientId === 0 && !empty($data['patient_name']) && !empty($data['patient_phone'])) {
            $phone = trim($data['patient_phone']);
            $stmt = $db->prepare("SELECT id FROM patients WHERE phone = ?");
            $stmt->execute([$phone]);
            $existing = $stmt->fetchColumn();

            if ($existing) {
                $patientId = (int)$existing;
            } else {
                // Generate MR No
                $year = date('Y');
                $stmt = $db->prepare("SELECT mr_no FROM patients WHERE mr_no LIKE ? ORDER BY id DESC LIMIT 1");
                $stmt->execute(["MR-{$year}-%"]);
                $lastMr = $stmt->fetchColumn();
                $nextSeq = ($lastMr && preg_match("/MR-{$year}-(\\d+)/", $lastMr, $m)) ? ((int)$m[1] + 1) : 1;
                $mrNo = sprintf("MR-%s-%04d", $year, $nextSeq);

                $stmt = $db->prepare("
                    INSERT INTO patients (mr_no, name, gender, dob, phone, email, address, blood_group)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $mrNo,
                    trim($data['patient_name']),
                    trim($data['patient_gender'] ?? 'Other'),
                    trim($data['patient_dob'] ?? '1990-01-01'),
                    $phone,
                    trim($data['patient_email'] ?? ''),
                    trim($data['patient_address'] ?? ''),
                    trim($data['patient_blood_group'] ?? 'Unknown')
                ]);
                $patientId = (int)$db->lastInsertId();
            }
        }

        if ($patientId === 0 || $doctorId === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid patient and doctor are required']);
            return;
        }

        // 1. Insert appointment
        $stmt = $db->prepare("
            INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Checked-in')
        ");
        $stmt->execute([$patientId, $doctorId, $source, $date, $timeSlot, $symptoms]);
        $appointmentId = (int)$db->lastInsertId();

        // 2. Centralized Sync: Auto-enqueue in doctor_queue immediately
        // Determine next token number for this doctor today
        $stmt = $db->prepare("
            SELECT COALESCE(MAX(token_number), 0) + 1 FROM doctor_queue
            WHERE doctor_id = ? AND date(created_at) = date('now')
        ");
        $stmt->execute([$doctorId]);
        $nextToken = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("
            INSERT INTO doctor_queue (doctor_id, patient_id, appointment_id, token_number, status, source)
            VALUES (?, ?, ?, ?, 'Waiting', ?)
        ");
        $stmt->execute([$doctorId, $patientId, $appointmentId, $nextToken, $source]);
        $queueId = (int)$db->lastInsertId();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Appointment booked and queued successfully',
            'appointment_id' => $appointmentId,
            'token_number' => $nextToken,
            'queue_id' => $queueId
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
