<?php
// backend/routes/admin.php

function handleAdminRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $sub = $uriParts[2] ?? '';

    if ($method === 'GET' && ($sub === 'users' || $sub === '')) {
        $stmt = $db->query("
            SELECT id, username, full_name, role, department, email, phone, shift, salary, status, permissions, doctor_id, created_at
            FROM users
            ORDER BY id ASC
        ");
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['permissions'] = json_decode($u['permissions'], true) ?? [];
        }

        echo json_encode([
            'success' => true,
            'users' => $users,
            'available_permissions' => [
                ['key' => 'reception', 'label' => 'Reception & Queue Desk'],
                ['key' => 'doctor', 'label' => 'Doctor Console & e-Rx'],
                ['key' => 'admission', 'label' => 'Inpatient Admission & Beds'],
                ['key' => 'lab', 'label' => 'Laboratory & R2 Reports'],
                ['key' => 'hr', 'label' => 'Human Resources (HR)'],
                ['key' => 'billing', 'label' => 'Billing & Cashier Desk'],
                ['key' => 'queue_display', 'label' => 'Waiting Room TV Display'],
                ['key' => 'admin', 'label' => 'Admin Access Control'],
            ]
        ]);
        return;
    }

    if ($method === 'POST' && $sub === 'users') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? 'password123';
        $fullName = trim($data['full_name'] ?? '');
        $role = trim($data['role'] ?? 'Staff');
        $department = trim($data['department'] ?? 'General');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $permissions = $data['permissions'] ?? ['reception'];

        if ($username === '' || $fullName === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Username and full name are required']);
            return;
        }

        // Check duplicate username
        $check = $db->prepare("SELECT id FROM users WHERE username = ?");
        $check->execute([$username]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Username already exists']);
            return;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $shift = trim($data['shift'] ?? 'Morning (08:00 - 16:00)');
        $salary = (float)($data['salary'] ?? 3500.00);

        $stmt = $db->prepare("
            INSERT INTO users (username, password_hash, full_name, role, department, email, phone, shift, salary, permissions, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
        ");
        $stmt->execute([
            $username, $hash, $fullName, $role, $department, $email, $phone, $shift, $salary, json_encode(array_values($permissions))
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => "User '{$username}' created with assigned privileges.",
            'user_id' => (int)$db->lastInsertId()
        ]);
        return;
    }

    // Update user permissions & status: POST /api/admin/permissions
    if ($method === 'POST' && $sub === 'permissions') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $userId = (int)($data['user_id'] ?? 0);
        $permissions = $data['permissions'] ?? null;
        $role = $data['role'] ?? null;
        $status = $data['status'] ?? null;

        if (!$userId || !is_array($permissions)) {
            http_response_code(400);
            echo json_encode(['error' => 'user_id and permissions array are required']);
            return;
        }

        $fields = ["permissions = ?"];
        $params = [json_encode(array_values($permissions))];

        if ($role !== null) {
            $fields[] = "role = ?";
            $params[] = $role;
        }
        if ($status !== null) {
            $fields[] = "status = ?";
            $params[] = $status;
        }
        $params[] = $userId;

        $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?";
        $db->prepare($sql)->execute($params);

        echo json_encode([
            'success' => true,
            'message' => 'User privileges updated successfully'
        ]);
        return;
    }

    // Add Doctor (and optional Doctor Login): POST /api/admin/doctors
    if ($method === 'POST' && $sub === 'doctors') {
        $action = $uriParts[3] ?? '';
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if ($action === 'update') {
            $docId = (int)($data['id'] ?? 0);
            if (!$docId) {
                http_response_code(400);
                echo json_encode(['error' => 'Doctor id is required']);
                return;
            }
            $stmt = $db->prepare("
                UPDATE doctors
                SET name = COALESCE(?, name),
                    specialty = COALESCE(?, specialty),
                    consultation_fee = COALESCE(?, consultation_fee),
                    room_no = COALESCE(?, room_no),
                    status = COALESCE(?, status)
                WHERE id = ?
            ");
            $stmt->execute([
                $data['name'] ?? null,
                $data['specialty'] ?? null,
                isset($data['consultation_fee']) ? (float)$data['consultation_fee'] : null,
                $data['room_no'] ?? null,
                $data['status'] ?? null,
                $docId
            ]);
            echo json_encode(['success' => true, 'message' => 'Doctor profile updated']);
            return;
        }

        $name = trim($data['name'] ?? '');
        $specialty = trim($data['specialty'] ?? '');
        $fee = (float)($data['consultation_fee'] ?? 50.00);
        $roomNo = trim($data['room_no'] ?? 'Room 104');
        $status = trim($data['status'] ?? 'Available');

        if ($name === '' || $specialty === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Doctor name and specialty are required']);
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO doctors (name, specialty, consultation_fee, room_no, status)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$name, $specialty, $fee, $roomNo, $status]);
        $doctorId = (int)$db->lastInsertId();

        // Optionally create a linked Doctor login account
        $userId = null;
        if (!empty($data['username'])) {
            $username = trim($data['username']);
            $password = $data['password'] ?? 'password123';
            $check = $db->prepare("SELECT id FROM users WHERE username = ?");
            $check->execute([$username]);
            if (!$check->fetch()) {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $perms = $data['permissions'] ?? ['doctor', 'admission', 'lab'];
                $uStmt = $db->prepare("
                    INSERT INTO users (username, password_hash, full_name, role, department, email, phone, shift, salary, status, permissions, doctor_id)
                    VALUES (?, ?, ?, 'Doctor', ?, ?, ?, 'Morning (08:00 - 16:00)', ?, 'Active', ?, ?)
                ");
                $uStmt->execute([
                    $username,
                    $hash,
                    $name,
                    $specialty,
                    trim($data['email'] ?? ''),
                    trim($data['phone'] ?? ''),
                    (float)($data['salary'] ?? 12000.00),
                    json_encode(array_values($perms)),
                    $doctorId
                ]);
                $userId = (int)$db->lastInsertId();
            }
        }

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => "Doctor '{$name}' added successfully.",
            'doctor_id' => $doctorId,
            'user_id' => $userId
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
