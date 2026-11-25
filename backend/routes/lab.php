<?php
// backend/routes/lab.php

require_once __DIR__ . '/../services/R2Service.php';

function handleLabRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $r2Service = new R2Service();
    $sub = $uriParts[2] ?? '';

    if ($method === 'GET') {
        // GET /api/lab/catalog
        if ($sub === 'catalog') {
            $stmt = $db->query("SELECT * FROM lab_catalog ORDER BY category ASC, test_name ASC");
            echo json_encode(['success' => true, 'catalog' => $stmt->fetchAll()]);
            return;
        }

        // GET /api/lab/orders
        $stmt = $db->query("
            SELECT lo.*, lc.test_name, lc.category, lc.fee, lc.normal_range, lc.unit,
                   p.mr_no, p.name as patient_name, p.gender, p.phone,
                   d.name as doctor_name
            FROM lab_orders lo
            JOIN lab_catalog lc ON lo.test_catalog_id = lc.id
            JOIN patients p ON lo.patient_id = p.id
            LEFT JOIN doctors d ON lo.doctor_id = d.id
            ORDER BY lo.id DESC
        ");
        $orders = $stmt->fetchAll();
        echo json_encode([
            'success' => true,
            'orders' => $orders,
            'storage_info' => [
                'storage_type' => $r2Service->getStorageType(),
                'is_r2_configured' => $r2Service->isR2Configured()
            ]
        ]);
        return;
    }

    if ($method === 'POST') {
        // POST /api/lab/fulfill
        if ($sub === 'fulfill') {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $orderId = (int)($data['order_id'] ?? 0);
            $resultValue = trim($data['result_value'] ?? '');
            $remarks = trim($data['remarks'] ?? '');
            $generatePdf = !empty($data['generate_demo_pdf']);

            if (!$orderId) {
                http_response_code(400);
                echo json_encode(['error' => 'order_id is required']);
                return;
            }

            // Get order details
            $stmt = $db->prepare("
                SELECT lo.*, lc.test_name, lc.normal_range, lc.unit, p.mr_no, p.name as patient_name
                FROM lab_orders lo
                JOIN lab_catalog lc ON lo.test_catalog_id = lc.id
                JOIN patients p ON lo.patient_id = p.id
                WHERE lo.id = ?
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();

            if (!$order) {
                http_response_code(404);
                echo json_encode(['error' => 'Lab order not found']);
                return;
            }

            $reportUrl = $order['report_file_url'];
            $reportKey = $order['report_file_key'];

            // Generate demo PDF report and upload to Cloudflare R2 / Local
            if ($generatePdf || empty($reportUrl)) {
                $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $order['test_name']);
                $timestamp = time();
                $filename = "report-{$order['mr_no']}-{$safeName}-{$timestamp}.pdf";
                $destinationKey = "lab-reports/{$filename}";

                // Synthesize clean PDF binary stream
                $pdfText = sprintf(
                    "SEHAT HOSPITAL LAB REPORT\nPatient: %s | MR No: %s\nTest: %s\nResult: %s %s\nNormal Range: %s\nRemarks: %s\nGenerated: %s",
                    $order['patient_name'], $order['mr_no'], $order['test_name'],
                    $resultValue ?: 'Normal', $order['unit'] ?: '',
                    $order['normal_range'], $remarks ?: 'Reviewed by Pathologist',
                    date('Y-m-d H:i:s')
                );

                $streamText = str_replace(["\n", "\r"], " ", $pdfText);
                $pdfData = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length " . (strlen($streamText) + 30) . ">>stream\nBT /F1 14 Tf 50 720 Td (" . addslashes($streamText) . ") ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000206 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n340\n%%EOF";

                $uploadResult = $r2Service->uploadContent($pdfData, $destinationKey, 'application/pdf');
                if ($uploadResult['success']) {
                    $reportUrl = $uploadResult['url'];
                    $reportKey = $destinationKey;
                }
            }

            $uStmt = $db->prepare("
                UPDATE lab_orders
                SET status = 'Completed', result_value = ?, remarks = ?, report_file_url = ?, report_file_key = ?, completed_at = datetime('now')
                WHERE id = ?
            ");
            $uStmt->execute([$resultValue, $remarks, $reportUrl, $reportKey, $orderId]);

            echo json_encode([
                'success' => true,
                'message' => 'Lab report fulfilled and stored successfully',
                'report_file_url' => $reportUrl,
                'storage_used' => $r2Service->getStorageType()
            ]);
            return;
        }

        // POST /api/lab/upload (Multipart upload for real PDF files)
        if ($sub === 'upload') {
            $orderId = (int)($_POST['order_id'] ?? 0);
            if (!$orderId || !isset($_FILES['pdf_file'])) {
                http_response_code(400);
                echo json_encode(['error' => 'order_id and pdf_file upload are required']);
                return;
            }

            $file = $_FILES['pdf_file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => 'File upload error code ' . $file['error']]);
                return;
            }

            // Get order and MR No
            $stmt = $db->prepare("
                SELECT lo.*, p.mr_no FROM lab_orders lo
                JOIN patients p ON lo.patient_id = p.id
                WHERE lo.id = ?
            ");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if (!$order) {
                http_response_code(404);
                echo json_encode(['error' => 'Lab order not found']);
                return;
            }

            $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'pdf';
            $destinationKey = "lab-reports/report-{$order['mr_no']}-" . time() . ".{$ext}";

            $uploadResult = $r2Service->uploadFile($file['tmp_name'], $destinationKey, 'application/pdf');
            if (!$uploadResult['success']) {
                http_response_code(500);
                echo json_encode(['error' => 'Upload failed: ' . ($uploadResult['error'] ?? 'Unknown error')]);
                return;
            }

            $reportUrl = $uploadResult['url'];
            $db->prepare("
                UPDATE lab_orders
                SET report_file_url = ?, report_file_key = ?, status = 'Completed', completed_at = datetime('now')
                WHERE id = ?
            ")->execute([$reportUrl, $destinationKey, $orderId]);

            echo json_encode([
                'success' => true,
                'message' => 'PDF report uploaded successfully to ' . $uploadResult['storage'],
                'url' => $reportUrl,
                'storage' => $uploadResult['storage']
            ]);
            return;
        }
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
