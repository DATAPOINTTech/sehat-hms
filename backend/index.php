<?php
// backend/index.php

// 1. CORS Headers for Next.js frontend
if (php_sapi_name() !== 'cli') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 2. Serve static uploaded files directly if requested
$rawUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestUri = parse_url($rawUri, PHP_URL_PATH) ?? '/';
if (str_starts_with($requestUri, '/uploads/')) {
    $cfg = require __DIR__ . '/config/config.php';
    $filePath = __DIR__ . $requestUri;
    if (!file_exists($filePath)) {
        $filePath = rtrim($cfg['upload_dir'], '/') . '/' . basename($requestUri);
    }
    if (file_exists($filePath) && is_file($filePath)) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $contentTypes = [
            'pdf' => 'application/pdf',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'txt' => 'text/plain'
        ];
        if (php_sapi_name() !== 'cli') {
            header("Content-Type: " . ($contentTypes[$ext] ?? 'application/octet-stream'));
            header("Content-Disposition: inline; filename=\"" . basename($filePath) . "\"");
        }
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        echo "File not found";
        exit;
    }
}

// Default JSON API response
if (php_sapi_name() !== 'cli') {
    header("Content-Type: application/json; charset=UTF-8");
}

require_once __DIR__ . '/config/db.php';
$db = Database::getConnection();

// Load route modules
require_once __DIR__ . '/routes/patients.php';
require_once __DIR__ . '/routes/appointments.php';
require_once __DIR__ . '/routes/queue.php';
require_once __DIR__ . '/routes/consultations.php';
require_once __DIR__ . '/routes/lab.php';
require_once __DIR__ . '/routes/rooms.php';
require_once __DIR__ . '/routes/billing.php';
require_once __DIR__ . '/routes/webhooks.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/admin.php';
require_once __DIR__ . '/routes/hr.php';
require_once __DIR__ . '/services/R2Service.php';

$method = $_SERVER['REQUEST_METHOD'];
$queryString = $_SERVER['QUERY_STRING'] ?? '';

// Normalize URI path
$basePath = trim($requestUri, '/');
$uriParts = explode('/', $basePath);

// Expecting /api/...
if (empty($uriParts[0]) || $uriParts[0] !== 'api') {
    echo json_encode([
        'status' => 'online',
        'service' => 'Sehat HMS REST API (PHP 8 + SQLite + Cloudflare R2)',
        'time' => date('Y-m-d H:i:s')
    ]);
    exit;
}

$resource = $uriParts[1] ?? '';

switch ($resource) {
    case 'health':
        $r2 = new R2Service();
        echo json_encode([
            'status' => 'healthy',
            'database' => 'SQLite Connected',
            'storage' => $r2->getStorageType(),
            'is_r2_configured' => $r2->isR2Configured(),
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        break;

    case 'doctors':
        $stmt = $db->query("
            SELECT d.*,
                   (SELECT COUNT(*) FROM doctor_queue q WHERE q.doctor_id = d.id AND q.status = 'Waiting') as waiting_count,
                   (SELECT token_number FROM doctor_queue q WHERE q.doctor_id = d.id AND q.status = 'Called' LIMIT 1) as current_called_token,
                   (SELECT token_number FROM doctor_queue q WHERE q.doctor_id = d.id AND q.status = 'In Consultation' LIMIT 1) as current_in_consultation_token
            FROM doctors d
            ORDER BY d.id ASC
        ");
        echo json_encode(['success' => true, 'doctors' => $stmt->fetchAll()]);
        break;

    case 'patients':
        handlePatientsRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'appointments':
        handleAppointmentsRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'queue':
        handleQueueRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'consultations':
        handleConsultationsRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'lab':
        handleLabRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'rooms':
        handleRoomsRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'admissions':
        handleRoomsRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'billing':
        handleBillingRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'auth':
        handleAuthRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'admin':
        handleAdminRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'hr':
        handleHrRoutes($db, $method, $uriParts, $queryString);
        break;

    case 'webhooks':
        if (($uriParts[2] ?? '') === 'whatsapp') {
            handleWebhookRoutes($db, $method, $uriParts, $queryString);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Unknown webhook']);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => "Endpoint '/api/{$resource}' not found"]);
        break;
}
