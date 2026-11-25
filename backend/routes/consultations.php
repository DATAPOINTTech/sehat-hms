<?php
// backend/routes/consultations.php

function handleConsultationsRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    if ($method === 'GET') {
        // GET /api/consultations/:id
        if (isset($uriParts[2]) && is_numeric($uriParts[2])) {
            $id = (int)$uriParts[2];
            $stmt = $db->prepare("
                SELECT c.*, p.mr_no, p.name as patient_name, p.dob, p.gender, p.blood_group,
                       d.name as doctor_name, d.specialty
                FROM consultations c
                JOIN patients p ON c.patient_id = p.id
                JOIN doctors d ON c.doctor_id = d.id
                WHERE c.id = ?
            ");
            $stmt->execute([$id]);
            $consultation = $stmt->fetch();
            if (!$consultation) {
                http_response_code(404);
                echo json_encode(['error' => 'Consultation not found']);
                return;
            }

            $pStmt = $db->prepare("SELECT * FROM prescriptions WHERE consultation_id = ?");
            $pStmt->execute([$id]);
            $consultation['prescriptions'] = $pStmt->fetchAll();

            $lStmt = $db->prepare("
                SELECT lo.*, lc.test_name, lc.fee, lc.category
                FROM lab_orders lo
                JOIN lab_catalog lc ON lo.test_catalog_id = lc.id
                WHERE lo.consultation_id = ?
            ");
            $lStmt->execute([$id]);
            $consultation['lab_orders'] = $lStmt->fetchAll();

            $consultation['vitals'] = json_decode($consultation['vitals'] ?? '{}', true);

            echo json_encode(['success' => true, 'consultation' => $consultation]);
            return;
        }

        // List recent consultations
        $stmt = $db->query("
            SELECT c.*, p.mr_no, p.name as patient_name, d.name as doctor_name
            FROM consultations c
            JOIN patients p ON c.patient_id = p.id
            JOIN doctors d ON c.doctor_id = d.id
            ORDER BY c.id DESC LIMIT 30
        ");
        echo json_encode(['success' => true, 'consultations' => $stmt->fetchAll()]);
        return;
    }

    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $patientId = (int)($data['patient_id'] ?? 0);
        $doctorId = (int)($data['doctor_id'] ?? 0);
        $queueTokenId = !empty($data['queue_token_id']) ? (int)$data['queue_token_id'] : null;
        $vitals = json_encode($data['vitals'] ?? []);
        $chiefComplaint = trim($data['chief_complaint'] ?? '');
        $diagnosis = trim($data['diagnosis'] ?? '');
        $clinicalNotes = trim($data['clinical_notes'] ?? '');
        $prescriptions = $data['prescriptions'] ?? [];
        $labTestIds = $data['lab_tests'] ?? [];
        $admitPatient = $data['admit_patient'] ?? null;

        if (!$patientId || !$doctorId) {
            http_response_code(400);
            echo json_encode(['error' => 'patient_id and doctor_id are required']);
            return;
        }

        // 1. Create Consultation
        $stmt = $db->prepare("
            INSERT INTO consultations (patient_id, doctor_id, queue_token_id, vitals, chief_complaint, diagnosis, clinical_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$patientId, $doctorId, $queueTokenId, $vitals, $chiefComplaint, $diagnosis, $clinicalNotes]);
        $consultationId = (int)$db->lastInsertId();

        // 2. Insert Prescriptions
        if (!empty($prescriptions) && is_array($prescriptions)) {
            $pStmt = $db->prepare("
                INSERT INTO prescriptions (consultation_id, medicine_name, dosage, frequency, duration, instructions)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            foreach ($prescriptions as $p) {
                if (!empty($p['medicine_name'])) {
                    $pStmt->execute([
                        $consultationId,
                        trim($p['medicine_name']),
                        trim($p['dosage'] ?? '1 tablet'),
                        trim($p['frequency'] ?? 'Once daily'),
                        trim($p['duration'] ?? '5 days'),
                        trim($p['instructions'] ?? '')
                    ]);
                }
            }
        }

        // 3. Insert Prescribed Lab Tests
        $totalLabFee = 0.0;
        $labOrdersCreated = [];
        if (!empty($labTestIds) && is_array($labTestIds)) {
            $lStmt = $db->prepare("INSERT INTO lab_orders (consultation_id, patient_id, doctor_id, test_catalog_id, status) VALUES (?, ?, ?, ?, 'Pending')");
            $fStmt = $db->prepare("SELECT fee, test_name FROM lab_catalog WHERE id = ?");

            foreach ($labTestIds as $tId) {
                $tId = (int)$tId;
                if ($tId > 0) {
                    $lStmt->execute([$consultationId, $patientId, $doctorId, $tId]);
                    $orderId = (int)$db->lastInsertId();

                    $fStmt->execute([$tId]);
                    $cat = $fStmt->fetch();
                    if ($cat) {
                        $totalLabFee += (float)$cat['fee'];
                        $labOrdersCreated[] = [
                            'order_id' => $orderId,
                            'name' => $cat['test_name'],
                            'fee' => (float)$cat['fee']
                        ];
                    }
                }
            }
        }

        // 4. Inpatient Admission if requested
        $admissionId = null;
        if (!empty($admitPatient) && !empty($admitPatient['room_id'])) {
            $roomId = (int)$admitPatient['room_id'];
            $inpatientMeds = trim($admitPatient['inpatient_prescriptions'] ?? '');
            $admNotes = trim($admitPatient['notes'] ?? 'Admitted during consultation');

            $admStmt = $db->prepare("
                INSERT INTO admissions (patient_id, doctor_id, consultation_id, room_id, diagnosis, inpatient_prescriptions, total_days, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, 1, 'Active', ?)
            ");
            $admStmt->execute([$patientId, $doctorId, $consultationId, $roomId, $diagnosis ?: 'Hospital Admission', $inpatientMeds, $admNotes]);
            $admissionId = (int)$db->lastInsertId();

            // Mark room occupied
            $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = {$admissionId} WHERE id = {$roomId}");
        }

        // 5. Automatically create/append billing invoice for consultation + lab fees
        $docFeeStmt = $db->prepare("SELECT consultation_fee, name FROM doctors WHERE id = ?");
        $docFeeStmt->execute([$doctorId]);
        $docInfo = $docFeeStmt->fetch();
        $consultFee = (float)($docInfo['consultation_fee'] ?? 50.0);

        $subtotal = $consultFee + $totalLabFee;

        // Generate invoice number: INV-YYYY-XXXX
        $year = date('Y');
        $invSeqStmt = $db->prepare("SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1");
        $invSeqStmt->execute(["%INV-{$year}-%"]);
        $lastInv = $invSeqStmt->fetchColumn();
        $nextInvSeq = ($lastInv && preg_match("/INV-{$year}-(\\d+)/", $lastInv, $im)) ? ((int)$im[1] + 1) : rand(100, 999);
        $invoiceNo = sprintf("INV-%s-%04d", $year, $nextInvSeq);

        $invStmt = $db->prepare("
            INSERT INTO invoices (invoice_no, patient_id, subtotal, discount, tax, total_amount, paid_amount, payment_status, payment_method, notes)
            VALUES (?, ?, ?, 0.00, 0.00, ?, 0.00, 'Unpaid', 'Pending', ?)
        ");
        $invStmt->execute([$invoiceNo, $patientId, $subtotal, $subtotal, "Consultation with {$docInfo['name']}"]);
        $newInvoiceId = (int)$db->lastInsertId();

        // Invoice Item for Consultation
        $itemStmt = $db->prepare("
            INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $itemStmt->execute([
            $newInvoiceId, 'Consultation', "Doctor Consultation - {$docInfo['name']}", $consultFee, 1, $consultFee, $consultationId
        ]);

        // Invoice Items for Prescribed Lab Tests
        foreach ($labOrdersCreated as $labItem) {
            $itemStmt->execute([
                $newInvoiceId, 'Lab', "Lab Test: {$labItem['name']}", $labItem['fee'], 1, $labItem['fee'], $labItem['order_id']
            ]);
        }

        // 6. Complete Queue Token if attached
        if ($queueTokenId) {
            $db->exec("UPDATE doctor_queue SET status = 'Completed', completed_at = datetime('now') WHERE id = {$queueTokenId}");
        }

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Consultation saved, lab tests ordered, and billing invoice generated',
            'consultation_id' => $consultationId,
            'invoice_id' => $newInvoiceId,
            'admission_id' => $admissionId
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
