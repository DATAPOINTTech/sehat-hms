<?php
// backend/config/config.php

// Auto-load .env if present
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (!array_key_exists($key, $_SERVER) && !array_key_exists($key, $_ENV)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

if (!function_exists('env')) {
    function env(string $key, $default = null) {
        $val = getenv($key);
        if ($val === false) {
            return $_ENV[$key] ?? $_SERVER[$key] ?? $default;
        }
        return $val;
    }
}

$isVercel = !empty(getenv('VERCEL')) || !empty($_ENV['VERCEL']) || !empty($_SERVER['VERCEL']);
$defaultDb = $isVercel ? '/tmp/hms.sqlite' : (__DIR__ . '/../data/hms.sqlite');
$defaultUpload = $isVercel ? '/tmp/uploads/lab-reports' : (__DIR__ . '/../uploads/lab-reports');
$defaultBaseUrl = ($isVercel && !empty($_SERVER['HTTP_HOST']))
    ? ('https://' . $_SERVER['HTTP_HOST'])
    : env('BASE_URL', 'http://localhost:8000');

return [
    'db_path' => env('DB_PATH', $defaultDb),
    'upload_dir' => $defaultUpload,
    'base_url' => $defaultBaseUrl,
    'r2' => [
        'account_id' => env('R2_ACCOUNT_ID', ''),
        'access_key' => env('R2_ACCESS_KEY_ID', ''),
        'secret_key' => env('R2_SECRET_ACCESS_KEY', ''),
        'bucket' => env('R2_BUCKET', ''),
        'public_url' => env('R2_PUBLIC_URL', ''),
    ],
    'whatsapp' => [
        'verify_token' => env('WHATSAPP_VERIFY_TOKEN', 'sehat_demo_token_2026')
    ]
];
