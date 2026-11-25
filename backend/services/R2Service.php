<?php
// backend/services/R2Service.php

class R2Service {
    private string $accountId;
    private string $accessKey;
    private string $secretKey;
    private string $bucket;
    private string $publicUrl;
    private string $uploadDir;
    private string $baseUrl;
    private bool $isR2Ready = false;

    public function __construct() {
        $config = require __DIR__ . '/../config/config.php';
        $this->accountId = $config['r2']['account_id'] ?? '';
        $this->accessKey = $config['r2']['access_key'] ?? '';
        $this->secretKey = $config['r2']['secret_key'] ?? '';
        $this->bucket = $config['r2']['bucket'] ?? '';
        $this->publicUrl = rtrim($config['r2']['public_url'] ?? '', '/');
        $this->uploadDir = $config['upload_dir'] ?? (__DIR__ . '/../uploads/lab-reports');
        $this->baseUrl = rtrim($config['base_url'] ?? 'http://localhost:8000', '/');

        if (!empty($this->accountId) && !empty($this->accessKey) && !empty($this->secretKey) && !empty($this->bucket)) {
            $this->isR2Ready = true;
        }

        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }
    }

    public function isR2Configured(): bool {
        return $this->isR2Ready;
    }

    public function getStorageType(): string {
        return $this->isR2Ready ? 'Cloudflare R2' : 'Local Storage Fallback';
    }

    /**
     * Upload binary content or file to R2 or Local Storage
     */
    public function uploadFile(string $sourceFilePath, string $destinationKey, string $contentType = 'application/pdf'): array {
        $fileContent = file_get_contents($sourceFilePath);
        return $this->uploadContent($fileContent, $destinationKey, $contentType);
    }

    /**
     * Upload content directly
     */
    public function uploadContent(string $binaryData, string $destinationKey, string $contentType = 'application/pdf'): array {
        // If R2 is not configured, save locally
        if (!$this->isR2Ready) {
            $localPath = $this->uploadDir . '/' . basename($destinationKey);
            file_put_contents($localPath, $binaryData);
            $url = $this->baseUrl . '/uploads/lab-reports/' . basename($destinationKey);
            return [
                'success' => true,
                'storage' => 'local_fallback',
                'key' => $destinationKey,
                'url' => $url,
                'local_path' => $localPath
            ];
        }

        // 1. Try AWS SDK if installed via composer
        if (class_exists('\Aws\S3\S3Client')) {
            try {
                $s3Client = new \Aws\S3\S3Client([
                    'version' => 'latest',
                    'region' => 'auto',
                    'endpoint' => "https://{$this->accountId}.r2.cloudflarestorage.com",
                    'credentials' => [
                        'key' => $this->accessKey,
                        'secret' => $this->secretKey,
                    ],
                ]);

                $s3Client->putObject([
                    'Bucket' => $this->bucket,
                    'Key' => $destinationKey,
                    'Body' => $binaryData,
                    'ContentType' => $contentType,
                ]);

                $url = !empty($this->publicUrl)
                    ? "{$this->publicUrl}/{$destinationKey}"
                    : "https://{$this->accountId}.r2.cloudflarestorage.com/{$this->bucket}/{$destinationKey}";

                return [
                    'success' => true,
                    'storage' => 'cloudflare_r2_sdk',
                    'key' => $destinationKey,
                    'url' => $url
                ];
            } catch (\Exception $e) {
                error_log("R2 SDK Upload failed: " . $e->getMessage() . ". Falling back to SigV4 Curl.");
            }
        }

        // 2. Direct AWS Signature Version 4 upload over cURL
        $result = $this->uploadViaSigV4($binaryData, $destinationKey, $contentType);
        if ($result['success']) {
            return $result;
        }

        // 3. Fallback to local if R2 remote call returned error
        $localPath = $this->uploadDir . '/' . basename($destinationKey);
        file_put_contents($localPath, $binaryData);
        $url = $this->baseUrl . '/uploads/lab-reports/' . basename($destinationKey);

        return [
            'success' => true,
            'storage' => 'local_fallback_on_r2_error',
            'key' => $destinationKey,
            'url' => $url,
            'warning' => $result['error'] ?? 'R2 connection failed, saved locally'
        ];
    }

    /**
     * S3 SigV4 implementation for Cloudflare R2
     */
    private function uploadViaSigV4(string $data, string $key, string $contentType): array {
        $host = "{$this->bucket}.{$this->accountId}.r2.cloudflarestorage.com";
        $endpoint = "https://{$host}/{$key}";
        $region = 'auto';
        $service = 's3';

        $timestamp = gmdate('Ymd\THis\Z');
        $date = gmdate('Ymd');
        $payloadHash = hash('sha256', $data);

        $canonicalUri = '/' . str_replace('%2F', '/', rawurlencode($key));
        $canonicalQuery = '';

        $canonicalHeaders = "content-type:" . trim($contentType) . "\n"
            . "host:" . $host . "\n"
            . "x-amz-content-sha256:" . $payloadHash . "\n"
            . "x-amz-date:" . $timestamp . "\n";

        $signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

        $canonicalRequest = "PUT\n"
            . $canonicalUri . "\n"
            . $canonicalQuery . "\n"
            . $canonicalHeaders . "\n"
            . $signedHeaders . "\n"
            . $payloadHash;

        $credentialScope = "{$date}/{$region}/{$service}/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n"
            . $timestamp . "\n"
            . $credentialScope . "\n"
            . hash('sha256', $canonicalRequest);

        $kDate = hash_hmac('sha256', $date, 'AWS4' . $this->secretKey, true);
        $kRegion = hash_hmac('sha256', $region, $kDate, true);
        $kService = hash_hmac('sha256', $service, $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authorization = "AWS4-HMAC-SHA256 "
            . "Credential={$this->accessKey}/{$credentialScope}, "
            . "SignedHeaders={$signedHeaders}, "
            . "Signature={$signature}";

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => $data,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Host: {$host}",
                "Content-Type: {$contentType}",
                "x-amz-date: {$timestamp}",
                "x-amz-content-sha256: {$payloadHash}",
                "Authorization: {$authorization}"
            ],
            CURLOPT_TIMEOUT => 20
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            $url = !empty($this->publicUrl)
                ? "{$this->publicUrl}/{$key}"
                : "https://{$this->accountId}.r2.cloudflarestorage.com/{$this->bucket}/{$key}";

            return [
                'success' => true,
                'storage' => 'cloudflare_r2_sigv4',
                'key' => $key,
                'url' => $url
            ];
        }

        return [
            'success' => false,
            'error' => "HTTP {$httpCode}: " . ($curlError ?: $response)
        ];
    }
}
