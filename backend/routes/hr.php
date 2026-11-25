<?php
// backend/routes/hr.php

function handleHrRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $sub = $uriParts[2] ?? '';

    if ($method === 'GET') {
        $stmt = $db->query("
            SELECT id, username, full_name, role, department, email, phone, shift, salary, status, created_at
            FROM users
            ORDER BY department ASC, full_name ASC
        ");
        $staff = $stmt->fetchAll();

        $totalPayroll = 0.0;
        $activeCount = 0;
        foreach ($staff as $s) {
            if ($s['status'] === 'Active') {
                $activeCount++;
                $totalPayroll += (float)$s['salary'];
            }
        }

        echo json_encode([
            'success' => true,
            'staff' => $staff,
            'stats' => [
                'total_staff' => count($staff),
                'active_staff' => $activeCount,
                'monthly_payroll' => $totalPayroll
            ]
        ]);
        return;
    }

    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // Update staff shift/salary/status: POST /api/hr/update
        if ($sub === 'update') {
            $userId = (int)($data['user_id'] ?? 0);
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['error' => 'user_id is required']);
                return;
            }

            $stmt = $db->prepare("
                UPDATE users
                SET department = COALESCE(?, department),
                    shift = COALESCE(?, shift),
                    salary = COALESCE(?, salary),
                    status = COALESCE(?, status)
                WHERE id = ?
            ");
            $stmt->execute([
                $data['department'] ?? null,
                $data['shift'] ?? null,
                isset($data['salary']) ? (float)$data['salary'] : null,
                $data['status'] ?? null,
                $userId
            ]);

            echo json_encode(['success' => true, 'message' => 'Staff HR record updated']);
            return;
        }

        // Add new HR employee: POST /api/hr/staff
        $fullName = trim($data['full_name'] ?? '');
        $username = trim($data['username'] ?? '');
        $role = trim($data['role'] ?? 'Nurse');
        $department = trim($data['department'] ?? 'General Ward');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');
        $shift = trim($data['shift'] ?? 'Morning (08:00 - 16:00)');
        $salary = (float)($data['salary'] ?? 3000.00);

        if ($fullName === '' || $username === '') {
            http_response_code(400);
            echo json_encode(['error' => 'full_name and username are required']);
            return;
        }

        $hash = password_hash('password123', PASSWORD_DEFAULT);
        $defaultPerms = json_encode(['reception']);

        $stmt = $db->prepare("
            INSERT INTO users (username, password_hash, full_name, role, department, email, phone, shift, salary, status, permissions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        ");
        $stmt->execute([$username, $hash, $fullName, $role, $department, $email, $phone, $shift, $salary, $defaultPerms]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => "Employee {$fullName} onboarded into HR directory.",
            'user_id' => (int)$db->lastInsertId()
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
