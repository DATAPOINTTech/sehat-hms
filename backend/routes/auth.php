<?php
// backend/routes/auth.php

function handleAuthRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $sub = $uriParts[2] ?? '';

    if ($method === 'POST' && $sub === 'login') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if ($username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Username and password are required']);
            return;
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid username or password']);
            return;
        }

        if ($user['status'] !== 'Active') {
            http_response_code(403);
            echo json_encode(['error' => 'Account is currently ' . $user['status'] . '. Contact Admin.']);
            return;
        }

        unset($user['password_hash']);
        $user['permissions'] = json_decode($user['permissions'], true) ?? [];

        // Simple stateless demo token (base64 JSON)
        $tokenPayload = base64_encode(json_encode([
            'user_id' => (int)$user['id'],
            'username' => $user['username'],
            'role' => $user['role'],
            'iat' => time()
        ]));

        echo json_encode([
            'success' => true,
            'token' => $tokenPayload,
            'user' => $user
        ]);
        return;
    }

    if ($method === 'POST' && $sub === 'patient-login') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $mrNo = trim($data['mr_no'] ?? '');
        $phone = trim($data['phone'] ?? '');

        if ($mrNo === '' && $phone === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Please enter your MR Number or Phone Number']);
            return;
        }

        if ($mrNo !== '' && $phone !== '') {
            $stmt = $db->prepare("SELECT * FROM patients WHERE UPPER(mr_no) = UPPER(?) AND phone LIKE ?");
            $stmt->execute([$mrNo, "%{$phone}%"]);
        } elseif ($mrNo !== '') {
            $stmt = $db->prepare("SELECT * FROM patients WHERE UPPER(mr_no) = UPPER(?)");
            $stmt->execute([$mrNo]);
        } else {
            $stmt = $db->prepare("SELECT * FROM patients WHERE phone LIKE ? ORDER BY id DESC LIMIT 1");
            $stmt->execute(["%{$phone}%"]);
        }

        $patient = $stmt->fetch();
        if (!$patient) {
            http_response_code(404);
            echo json_encode(['error' => 'No patient record found matching these credentials']);
            return;
        }

        echo json_encode([
            'success' => true,
            'patient' => $patient
        ]);
        return;
    }

    if ($method === 'GET' && $sub === 'me') {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $token = str_replace('Bearer ', '', $authHeader);
        if ($token === '') {
            http_response_code(401);
            echo json_encode(['error' => 'Not authenticated']);
            return;
        }

        $decoded = json_decode(base64_decode($token), true);
        if (!$decoded || empty($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid session token']);
            return;
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([(int)$decoded['user_id']]);
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'User not found']);
            return;
        }

        unset($user['password_hash']);
        $user['permissions'] = json_decode($user['permissions'], true) ?? [];

        echo json_encode(['success' => true, 'user' => $user]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method or auth route not supported']);
}
