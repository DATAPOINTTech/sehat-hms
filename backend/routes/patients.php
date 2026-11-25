<?php
// backend/routes/patients.php

function handlePatientsRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    if ($method === 'GET') {
        // GET /api/patients/:id
        if (isset($uriParts[2]) && is_numeric($uriParts[2])) {
            $patientId = (int)$uriParts[2];
            $stmt = $db->prepare("SELECT * FROM patients WHERE id = ?");
            $stmt->execute([$patientId]);
            $patient = $stmt->fetch();
            if (!$patient) {
                http_response_code(404);
                echo json_encode(['error' => 'Patient not found']);
                return;
            }

            // Consultations & Prescriptions
            $stmt = $db->prepare("
                SELECT c.*, d.name as doctor_name, d.specialty
                FROM consultations c
                JOIN doctors d ON c.doctor_id = d.id
                WHERE c.patient_id = ?
                ORDER BY c.created_at DESC
            ");
            $stmt->execute([$patientId]);
            $consultations = $stmt->fetchAll();

            foreach ($consultations as &$c) {
                $pStmt = $db->prepare("SELECT * FROM prescriptions WHERE consultation_id = ?");
                $pStmt->execute([$c['id']]);
                $c['prescriptions'] = $pStmt->fetchAll();

                $c['vitals'] = json_decode($c['vitals'] ?? '{}', true);
            }

            // Lab Orders & R2 Reports
            $stmt = $db->prepare("
                SELECT lo.*, lc.test_name, lc.category, lc.fee, lc.normal_range, lc.unit, d.name as doctor_name
                FROM lab_orders lo
                JOIN lab_catalog lc ON lo.test_catalog_id = lc.id
                LEFT JOIN doctors d ON lo.doctor_id = d.id
                WHERE lo.patient_id = ?
                ORDER BY lo.created_at DESC
            ");
            $stmt->execute([$patientId]);
            $labOrders = $stmt->fetchAll();

            // Admissions
            $stmt = $db->prepare("
                SELECT a.*, r.room_number, r.ward_category, r.daily_rate, d.name as doctor_name
                FROM admissions a
                LEFT JOIN rooms r ON a.room_id = r.id
                LEFT JOIN doctors d ON a.doctor_id = d.id
                WHERE a.patient_id = ?
                ORDER BY a.admitted_at DESC
            ");
            $stmt->execute([$patientId]);
            $admissions = $stmt->fetchAll();

            // Invoices & Ledger
            $stmt = $db->prepare("
                SELECT * FROM invoices
                WHERE patient_id = ?
                ORDER BY created_at DESC
            ");
            $stmt->execute([$patientId]);
            $invoices = $stmt->fetchAll();

            foreach ($invoices as &$inv) {
                $itStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                $itStmt->execute([$inv['id']]);
                $inv['items'] = $itStmt->fetchAll();
            }

            // Appointments
            $stmt = $db->prepare("
                SELECT a.*, d.name as doctor_name, d.specialty
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                WHERE a.patient_id = ?
                ORDER BY a.created_at DESC
            ");
            $stmt->execute([$patientId]);
            $appointments = $stmt->fetchAll();

            echo json_encode([
                'success' => true,
                'patient' => $patient,
                'consultations' => $consultations,
                'lab_orders' => $labOrders,
                'admissions' => $admissions,
                'invoices' => $invoices,
                'appointments' => $appointments
            ]);
            return;
        }

        // GET /api/patients?q=search_term
        parse_str($queryString ?? '', $queryParams);
        $search = trim($queryParams['q'] ?? '');

        if ($search !== '') {
            $term = "%{$search}%";
            $stmt = $db->prepare("
                SELECT * FROM patients
                WHERE mr_no LIKE ? OR name LIKE ? OR phone LIKE ?
                ORDER BY id DESC LIMIT 50
            ");
            $stmt->execute([$term, $term, $term]);
        } else {
            $stmt = $db->query("SELECT * FROM patients ORDER BY id DESC LIMIT 50");
        }

        $patients = $stmt->fetchAll();
        echo json_encode(['success' => true, 'patients' => $patients]);
        return;
    }

    if ($method === 'POST') {
        // Register new patient with sequential MR No
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $name = trim($data['name'] ?? '');
        $gender = trim($data['gender'] ?? 'Other');
        $dob = trim($data['dob'] ?? date('Y-m-d'));
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $address = trim($data['address'] ?? '');
        $bloodGroup = trim($data['blood_group'] ?? 'Unknown');
        $emergencyContact = trim($data['emergency_contact'] ?? '');

        if ($name === '' || $phone === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Patient name and phone are required']);
            return;
        }

        // Sequential MR No generator: MR-YYYY-XXXX
        $year = date('Y');
        $stmt = $db->prepare("SELECT mr_no FROM patients WHERE mr_no LIKE ? ORDER BY id DESC LIMIT 1");
        $stmt->execute(["MR-{$year}-%"]);
        $lastMr = $stmt->fetchColumn();

        if ($lastMr && preg_match("/MR-{$year}-(\\d+)/", $lastMr, $matches)) {
            $nextSeq = (int)$matches[1] + 1;
        } else {
            $nextSeq = 1;
        }
        $mrNo = sprintf("MR-%s-%04d", $year, $nextSeq);

        $stmt = $db->prepare("
            INSERT INTO patients (mr_no, name, gender, dob, phone, email, address, blood_group, emergency_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$mrNo, $name, $gender, $dob, $phone, $email, $address, $bloodGroup, $emergencyContact]);
        $newId = $db->lastInsertId();

        $stmt = $db->prepare("SELECT * FROM patients WHERE id = ?");
        $stmt->execute([$newId]);
        $patient = $stmt->fetch();

        http_response_code(201);
        echo json_encode(['success' => true, 'patient' => $patient, 'mr_no' => $mrNo]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
