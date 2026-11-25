<?php
// backend/init_db.php

function initializeDatabase(PDO $db): void {
    // Enable foreign keys
    $db->exec("PRAGMA foreign_keys = ON;");

    // 1. Create Tables
    $db->exec("
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mr_no TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            gender TEXT NOT NULL,
            dob TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            address TEXT,
            blood_group TEXT,
            emergency_contact TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            consultation_fee REAL NOT NULL DEFAULT 50.00,
            room_no TEXT,
            status TEXT DEFAULT 'Available'
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            booking_source TEXT NOT NULL DEFAULT 'Online', -- Online, WhatsApp, Walk-in
            appointment_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            symptoms TEXT,
            status TEXT DEFAULT 'Scheduled', -- Scheduled, Checked-in, Cancelled, Completed
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS doctor_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id INTEGER NOT NULL,
            patient_id INTEGER NOT NULL,
            appointment_id INTEGER,
            token_number INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Waiting', -- Waiting, Called, In Consultation, Skipped (No-Show), Completed
            called_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            source TEXT DEFAULT 'Walk-in',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            queue_token_id INTEGER,
            vitals TEXT, -- JSON: bp, heart_rate, temp, weight, spo2
            chief_complaint TEXT,
            diagnosis TEXT,
            clinical_notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consultation_id INTEGER NOT NULL,
            medicine_name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            frequency TEXT NOT NULL,
            duration TEXT NOT NULL,
            instructions TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS lab_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_name TEXT NOT NULL,
            category TEXT NOT NULL,
            fee REAL NOT NULL,
            normal_range TEXT,
            unit TEXT
        );

        CREATE TABLE IF NOT EXISTS lab_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consultation_id INTEGER,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            test_catalog_id INTEGER NOT NULL,
            status TEXT DEFAULT 'Pending', -- Pending, Sample Collected, Completed
            result_value TEXT,
            remarks TEXT,
            report_file_url TEXT,
            report_file_key TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            FOREIGN KEY (test_catalog_id) REFERENCES lab_catalog(id)
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT NOT NULL UNIQUE,
            ward_category TEXT NOT NULL, -- General Ward, Semi-Private, Private Room, ICU
            daily_rate REAL NOT NULL,
            status TEXT DEFAULT 'Available', -- Available, Occupied, Cleaning
            current_admission_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS admissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            consultation_id INTEGER,
            room_id INTEGER,
            diagnosis TEXT NOT NULL,
            inpatient_prescriptions TEXT,
            admitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            discharged_at TEXT,
            total_days INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Active', -- Active, Discharged
            notes TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT UNIQUE NOT NULL,
            patient_id INTEGER NOT NULL,
            subtotal REAL NOT NULL DEFAULT 0.00,
            discount REAL NOT NULL DEFAULT 0.00,
            tax REAL NOT NULL DEFAULT 0.00,
            total_amount REAL NOT NULL DEFAULT 0.00,
            paid_amount REAL NOT NULL DEFAULT 0.00,
            payment_status TEXT DEFAULT 'Unpaid', -- Unpaid, Partial, Paid
            payment_method TEXT DEFAULT 'Cash',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            item_type TEXT NOT NULL, -- Consultation, Room, Lab, Medicine, Other
            item_description TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            total_price REAL NOT NULL,
            reference_id INTEGER,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        );
    ");

    // Clear existing data for fresh seed if needed
    $count = $db->query("SELECT COUNT(*) FROM doctors")->fetchColumn();
    if ($count > 0) {
        return; // Already seeded
    }

    // 2. Seed Doctors
    $doctors = [
        ['Dr. Sarah Jenkins', 'Cardiology & Internal Medicine', 80.00, 'Room 101', 'Available'],
        ['Dr. Farhan Ahmed', 'General Medicine & Family Health', 45.00, 'Room 102', 'Available'],
        ['Dr. Priya Patel', 'Pediatrics & Pulmonology', 60.00, 'Room 103', 'Available']
    ];
    $stmt = $db->prepare("INSERT INTO doctors (name, specialty, consultation_fee, room_no, status) VALUES (?, ?, ?, ?, ?)");
    foreach ($doctors as $d) {
        $stmt->execute($d);
    }

    // 3. Seed Patients (6 Patients with sequential MR Numbers)
    $patients = [
        ['MR-2026-0001', 'John Doe', 'Male', '1988-05-14', '+1-555-0192', 'john.doe@example.com', '45 Elm Street, North Ward', 'B+', 'Sarah Doe (+1-555-0199)'],
        ['MR-2026-0002', 'Maria Garcia', 'Female', '1993-11-20', '+1-555-0143', 'maria.garcia@example.com', '120 Sunset Blvd, West End', 'A+', 'Carlos Garcia (+1-555-0140)'],
        ['MR-2026-0003', 'Ahmed Khan', 'Male', '1975-02-10', '+1-555-0188', 'ahmed.k@example.com', '78 River Road, Central District', 'O+', 'Fatima Khan (+1-555-0181)'],
        ['MR-2026-0004', 'Emily Chen', 'Female', '2001-08-30', '+1-555-0176', 'emily.chen@example.com', '33 Oak Avenue, Midtown', 'AB+', 'David Chen (+1-555-0170)'],
        ['MR-2026-0005', 'Robert Taylor', 'Male', '1962-12-05', '+1-555-0121', 'robert.taylor@example.com', '512 Pinecrest Dr, Hillside', 'O-', 'Linda Taylor (+1-555-0128)'],
        ['MR-2026-0006', 'Fatima Zahra', 'Female', '2018-04-12', '+1-555-0165', 'parents.zahra@example.com', '14 Maple Way, South Suburb', 'A-', 'Yasmin Zahra (+1-555-0160)']
    ];
    $stmt = $db->prepare("INSERT INTO patients (mr_no, name, gender, dob, phone, email, address, blood_group, emergency_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($patients as $p) {
        $stmt->execute($p);
    }

    // 4. Seed Lab Catalog
    $labCatalog = [
        ['Complete Blood Count (CBC)', 'Hematology', 25.00, '4.5 - 11.0 x10^3', 'uL'],
        ['Lipid Profile Panel', 'Biochemistry', 45.00, 'Total Chol < 200', 'mg/dL'],
        ['Fasting Blood Sugar (FBS)', 'Endocrinology', 15.00, '70 - 99', 'mg/dL'],
        ['Chest X-Ray (PA View)', 'Radiology', 50.00, 'Clear lung fields', 'Report'],
        ['Liver Function Test (LFT)', 'Biochemistry', 40.00, 'ALT 7-56, AST 10-40', 'U/L'],
        ['Serum Creatinine & Urea', 'Nephrology', 30.00, '0.7 - 1.3', 'mg/dL'],
        ['Urine Routine Examination', 'Pathology', 20.00, 'Normal, Nil Protein', 'Analysis'],
        ['12-Lead Electrocardiogram (ECG)', 'Cardiology', 35.00, 'Normal Sinus Rhythm', 'Trace']
    ];
    $stmt = $db->prepare("INSERT INTO lab_catalog (test_name, category, fee, normal_range, unit) VALUES (?, ?, ?, ?, ?)");
    foreach ($labCatalog as $lc) {
        $stmt->execute($lc);
    }

    // 5. Seed Rooms (8 Rooms across categories)
    $rooms = [
        ['GW-201', 'General Ward', 35.00, 'Available', null],
        ['GW-202', 'General Ward', 35.00, 'Occupied', null],
        ['SP-203', 'Semi-Private', 70.00, 'Available', null],
        ['SP-204', 'Semi-Private', 70.00, 'Cleaning', null],
        ['PV-301', 'Private Room', 140.00, 'Available', null],
        ['PV-302', 'Private Room', 140.00, 'Occupied', null],
        ['ICU-401', 'ICU', 300.00, 'Available', null],
        ['ICU-402', 'ICU', 300.00, 'Occupied', null]
    ];
    $stmt = $db->prepare("INSERT INTO rooms (room_number, ward_category, daily_rate, status, current_admission_id) VALUES (?, ?, ?, ?, ?)");
    foreach ($rooms as $r) {
        $stmt->execute($r);
    }

    // 6. Seed Sample Admissions
    // Robert Taylor (Patient 5) admitted to ICU-402 (Room 8)
    $stmt = $db->prepare("INSERT INTO admissions (patient_id, doctor_id, room_id, diagnosis, inpatient_prescriptions, admitted_at, total_days, status, notes) VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'), ?, ?, ?)");
    $stmt->execute([
        5, 1, 8, 'Acute Coronary Syndrome post-angiography observation',
        'Aspirin 75mg OD, Atorvastatin 40mg HS, Enoxaparin 40mg SC BD',
        2, 'Active', 'Monitor continuous ECG, SpO2, and cardiac enzymes.'
    ]);
    $admId1 = $db->lastInsertId();
    $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = $admId1 WHERE id = 8");

    // Ahmed Khan (Patient 3) admitted to GW-202 (Room 2)
    $stmt->execute([
        3, 2, 2, 'Uncontrolled Hypertension with Mild Renal Impairment',
        'Amlodipine 5mg BD, Telmisartan 40mg OD, Low Salt Diet',
        3, 'Active', 'Daily BP charting every 4 hours.'
    ]);
    $admId2 = $db->lastInsertId();
    $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = $admId2 WHERE id = 2");

    // Emily Chen (Patient 4) admitted to PV-302 (Room 6)
    $stmt->execute([
        4, 2, 6, 'Type 1 Diabetes Mellitus with Ketoacidosis Resolved',
        'Regular Insulin sliding scale, IV Fluids 0.9% NS',
        1, 'Active', 'Transitioning to subcutaneous basal-bolus regimen.'
    ]);
    $admId3 = $db->lastInsertId();
    $db->exec("UPDATE rooms SET status = 'Occupied', current_admission_id = $admId3 WHERE id = 6");

    // 7. Seed Appointments & Queue Tokens
    // Called token for Doctor 1 (called 2 minutes ago to test 10-min countdown timer!)
    $twoMinutesAgo = date('Y-m-d H:i:s', time() - 120);

    // Dr. Sarah Jenkins (Doc 1)
    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, called_at, source, created_at)
        VALUES (1, 1, 1, 'Called', '$twoMinutesAgo', 'Walk-in', datetime('now', '-15 minutes'))");

    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, source, created_at)
        VALUES (1, 2, 2, 'Waiting', 'Online', datetime('now', '-10 minutes'))");

    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, source, created_at)
        VALUES (1, 3, 3, 'Waiting', 'WhatsApp', datetime('now', '-5 minutes'))");

    // Dr. Farhan Ahmed (Doc 2)
    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, started_at, source, created_at)
        VALUES (2, 4, 1, 'In Consultation', datetime('now', '-5 minutes'), 'Online', datetime('now', '-20 minutes'))");

    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, source, created_at)
        VALUES (2, 5, 2, 'Waiting', 'Walk-in', datetime('now', '-8 minutes'))");

    // Dr. Priya Patel (Doc 3)
    $db->exec("INSERT INTO doctor_queue (doctor_id, patient_id, token_number, status, source, created_at)
        VALUES (3, 6, 1, 'Waiting', 'WhatsApp', datetime('now', '-3 minutes'))");

    // 8. Seed Appointments
    $db->exec("INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
        VALUES (2, 1, 'Online', date('now'), '10:00 AM', 'Occasional chest palpitations and shortness of breath', 'Checked-in')");
    $db->exec("INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
        VALUES (3, 1, 'WhatsApp', date('now'), '10:30 AM', 'Routine BP evaluation and blood work renewal', 'Checked-in')");
    $db->exec("INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
        VALUES (4, 2, 'Online', date('now'), '09:30 AM', 'Elevated morning blood sugar levels', 'Checked-in')");
    $db->exec("INSERT INTO appointments (patient_id, doctor_id, booking_source, appointment_date, time_slot, symptoms, status)
        VALUES (6, 3, 'WhatsApp', date('now'), '11:00 AM', 'Child high fever with coughing for 2 days', 'Checked-in')");

    // 9. Seed Consultations & Prescriptions
    $db->exec("INSERT INTO consultations (patient_id, doctor_id, vitals, chief_complaint, diagnosis, clinical_notes)
        VALUES (1, 1, '{\"bp\":\"138/86\",\"hr\":\"78\",\"temp\":\"98.6\",\"spo2\":\"98\",\"weight\":\"82\"}',
        'Intermittent chest heaviness on exertion', 'Stage 1 Hypertension & Exertional Angina suspicion',
        'Patient advised 12-lead ECG, Lipid Profile, and regular exercise. Prescribed beta-blocker.')");
    $consId1 = $db->lastInsertId();

    $db->exec("INSERT INTO prescriptions (consultation_id, medicine_name, dosage, frequency, duration, instructions)
        VALUES ($consId1, 'Metoprolol Tartrate', '25mg', 'Twice daily', '14 days', 'Take with food morning and night')");
    $db->exec("INSERT INTO prescriptions (consultation_id, medicine_name, dosage, frequency, duration, instructions)
        VALUES ($consId1, 'Aspirin (Cardio)', '81mg', 'Once daily', '30 days', 'Take after lunch')");

    // 10. Seed Lab Orders & Demo Reports
    // Ensure demo PDF exists
    $cfg = require __DIR__ . '/config/config.php';
    $uploadDir = $cfg['upload_dir'] ?? (__DIR__ . '/uploads/lab-reports');
    $baseUrl = rtrim($cfg['base_url'] ?? 'http://localhost:8000', '/');
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $demoPdfPath = $uploadDir . '/sample-report-cbc-MR-2026-0001.pdf';
    if (!file_exists($demoPdfPath)) {
        // Minimal valid PDF binary
        $minimalPdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length 55>>stream\nBT /F1 18 Tf 50 700 Td (SEHAT LAB REPORT - CBC - JOHN DOE) ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000206 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n312\n%%EOF";
        file_put_contents($demoPdfPath, $minimalPdf);
    }

    $db->exec("INSERT INTO lab_orders (consultation_id, patient_id, doctor_id, test_catalog_id, status, result_value, remarks, report_file_url, report_file_key, completed_at)
        VALUES ($consId1, 1, 1, 1, 'Completed', 'WBC: 7.2 x10^3/uL, RBC: 4.8 x10^6/uL, Platelets: 240 x10^3/uL, Hemoglobin: 14.8 g/dL',
        'Normal hematological indices. No acute infection.', '{$baseUrl}/uploads/lab-reports/sample-report-cbc-MR-2026-0001.pdf', 'reports/sample-report-cbc-MR-2026-0001.pdf', datetime('now', '-1 day'))");

    $db->exec("INSERT INTO lab_orders (consultation_id, patient_id, doctor_id, test_catalog_id, status)
        VALUES ($consId1, 1, 1, 2, 'Pending')");

    $db->exec("INSERT INTO lab_orders (consultation_id, patient_id, doctor_id, test_catalog_id, status)
        VALUES (null, 2, 1, 8, 'Pending')");

    // 11. Seed Invoices & Items
    $db->exec("INSERT INTO invoices (invoice_no, patient_id, subtotal, discount, tax, total_amount, paid_amount, payment_status, payment_method, notes)
        VALUES ('INV-2026-0001', 1, 105.00, 5.00, 0.00, 100.00, 100.00, 'Paid', 'Credit Card', 'OPD consultation & Complete Blood Count')");
    $invId1 = $db->lastInsertId();

    $db->exec("INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
        VALUES ($invId1, 'Consultation', 'Dr. Sarah Jenkins - OPD Consultation', 80.00, 1, 80.00, $consId1)");
    $db->exec("INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
        VALUES ($invId1, 'Lab', 'Complete Blood Count (CBC)', 25.00, 1, 25.00, 1)");

    // Pending invoice for Patient 3 (Inpatient Room Charges + Consult)
    $db->exec("INSERT INTO invoices (invoice_no, patient_id, subtotal, discount, tax, total_amount, paid_amount, payment_status, payment_method, notes)
        VALUES ('INV-2026-0002', 3, 150.00, 0.00, 0.00, 150.00, 50.00, 'Partial', 'Cash', 'Admission deposit and room charges')");
    $invId2 = $db->lastInsertId();

    $db->exec("INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
        VALUES ($invId2, 'Consultation', 'Dr. Farhan Ahmed - Inpatient Care', 45.00, 1, 45.00, null)");
    $db->exec("INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price, reference_id)
        VALUES ($invId2, 'Room', 'General Ward Bed GW-202 (3 Days)', 35.00, 3, 105.00, $admId2)");

    ensureUsersAndHR($db);
}

/**
 * Ensures the users (RBAC + HR) table exists and is seeded even on existing databases.
 */
function ensureUsersAndHR(PDO $db): void {
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT,
            email TEXT,
            phone TEXT,
            shift TEXT DEFAULT 'Morning (08:00 - 16:00)',
            salary REAL DEFAULT 0.00,
            status TEXT DEFAULT 'Active',
            permissions TEXT NOT NULL,
            doctor_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    ");

    $count = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count > 0) {
        return;
    }

    $defaultHash = password_hash('password123', PASSWORD_DEFAULT);
    $staff = [
        [
            'admin', $defaultHash, 'System Administrator', 'Admin', 'Administration',
            'admin@sehat.hospital', '+1-555-0100', 'Day (09:00 - 17:00)', 8500.00, 'Active',
            json_encode(['reception', 'doctor', 'admission', 'lab', 'hr', 'billing', 'admin', 'queue_display']), null
        ],
        [
            'reception', $defaultHash, 'Aisha Raza', 'Receptionist', 'Front Desk & OPD',
            'reception@sehat.hospital', '+1-555-0101', 'Morning (08:00 - 16:00)', 3200.00, 'Active',
            json_encode(['reception', 'admission', 'queue_display']), null
        ],
        [
            'dr_jenkins', $defaultHash, 'Dr. Sarah Jenkins', 'Doctor', 'Cardiology & Internal Medicine',
            's.jenkins@sehat.hospital', '+1-555-0102', 'Morning (08:00 - 16:00)', 14000.00, 'Active',
            json_encode(['doctor', 'admission', 'lab']), 1
        ],
        [
            'lab_tech', $defaultHash, 'Bilal Tariq', 'Lab Tech', 'Pathology & Diagnostics',
            'lab@sehat.hospital', '+1-555-0103', 'Morning (08:00 - 16:00)', 4100.00, 'Active',
            json_encode(['lab']), null
        ],
        [
            'hr_manager', $defaultHash, 'Sanaullah Khan', 'HR', 'Human Resources',
            'hr@sehat.hospital', '+1-555-0104', 'Day (09:00 - 17:00)', 5200.00, 'Active',
            json_encode(['hr']), null
        ],
        [
            'billing', $defaultHash, 'Omar Farooq', 'Billing', 'Finance & Cashier',
            'billing@sehat.hospital', '+1-555-0105', 'Morning (08:00 - 16:00)', 3900.00, 'Active',
            json_encode(['billing', 'reception']), null
        ],
    ];

    $stmt = $db->prepare("
        INSERT INTO users (username, password_hash, full_name, role, department, email, phone, shift, salary, status, permissions, doctor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($staff as $u) {
        $stmt->execute($u);
    }
}

// Standalone execution support
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    require_once __DIR__ . '/config/db.php';
    $db = Database::getConnection();
    echo "Database initialized and seeded successfully!\n";
}
