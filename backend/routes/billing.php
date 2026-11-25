<?php
// backend/routes/billing.php

function handleBillingRoutes(PDO $db, string $method, array $uriParts, ?string $queryString): void {
    $sub = $uriParts[2] ?? '';

    if ($method === 'GET') {
        // GET /api/billing/patient/:id - unified ledger for MR No
        if ($sub === 'patient' && isset($uriParts[3])) {
            $patientId = (int)$uriParts[3];

            $stmt = $db->prepare("SELECT * FROM patients WHERE id = ?");
            $stmt->execute([$patientId]);
            $patient = $stmt->fetch();
            if (!$patient) {
                http_response_code(404);
                echo json_encode(['error' => 'Patient not found']);
                return;
            }

            // Invoices
            $stmt = $db->prepare("SELECT * FROM invoices WHERE patient_id = ? ORDER BY id DESC");
            $stmt->execute([$patientId]);
            $invoices = $stmt->fetchAll();

            $totalBilled = 0.0;
            $totalPaid = 0.0;

            foreach ($invoices as &$inv) {
                $totalBilled += (float)$inv['total_amount'];
                $totalPaid += (float)$inv['paid_amount'];

                $itStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                $itStmt->execute([$inv['id']]);
                $inv['items'] = $itStmt->fetchAll();
            }

            echo json_encode([
                'success' => true,
                'patient' => $patient,
                'invoices' => $invoices,
                'summary' => [
                    'total_billed' => $totalBilled,
                    'total_paid' => $totalPaid,
                    'balance_due' => max(0, $totalBilled - $totalPaid)
                ]
            ]);
            return;
        }

        // GET /api/billing - all invoices overview
        $stmt = $db->query("
            SELECT i.*, p.mr_no, p.name as patient_name, p.phone as patient_phone
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            ORDER BY i.id DESC
        ");
        $invoices = $stmt->fetchAll();

        $totalRevenue = 0.0;
        $totalCollected = 0.0;
        $totalPending = 0.0;

        foreach ($invoices as &$inv) {
            $totalRevenue += (float)$inv['total_amount'];
            $totalCollected += (float)$inv['paid_amount'];

            $itStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
            $itStmt->execute([$inv['id']]);
            $inv['items'] = $itStmt->fetchAll();
        }
        $totalPending = max(0, $totalRevenue - $totalCollected);

        echo json_encode([
            'success' => true,
            'invoices' => $invoices,
            'stats' => [
                'total_revenue' => $totalRevenue,
                'total_collected' => $totalCollected,
                'total_pending' => $totalPending
            ]
        ]);
        return;
    }

    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // Record payment: POST /api/billing/pay
        if ($sub === 'pay') {
            $invoiceId = (int)($data['invoice_id'] ?? 0);
            $paymentAmount = (float)($data['amount'] ?? 0.0);
            $paymentMethod = trim($data['payment_method'] ?? 'Cash');

            if (!$invoiceId || $paymentAmount <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'invoice_id and positive payment amount are required']);
                return;
            }

            $stmt = $db->prepare("SELECT * FROM invoices WHERE id = ?");
            $stmt->execute([$invoiceId]);
            $invoice = $stmt->fetch();
            if (!$invoice) {
                http_response_code(404);
                echo json_encode(['error' => 'Invoice not found']);
                return;
            }

            $newPaid = (float)$invoice['paid_amount'] + $paymentAmount;
            $total = (float)$invoice['total_amount'];

            $newStatus = 'Partial';
            if ($newPaid >= $total) {
                $newStatus = 'Paid';
                $newPaid = $total; // Cap at total
            }

            $uStmt = $db->prepare("
                UPDATE invoices
                SET paid_amount = ?, payment_status = ?, payment_method = ?
                WHERE id = ?
            ");
            $uStmt->execute([$newPaid, $newStatus, $paymentMethod, $invoiceId]);

            echo json_encode([
                'success' => true,
                'message' => "Payment of \${$paymentAmount} recorded. Status is now {$newStatus}.",
                'invoice_id' => $invoiceId,
                'paid_amount' => $newPaid,
                'payment_status' => $newStatus
            ]);
            return;
        }

        // Billing Correction & Invoice Adjustment: POST /api/billing/correct
        if ($sub === 'correct') {
            $invoiceId = (int)($data['invoice_id'] ?? 0);
            if (!$invoiceId) {
                http_response_code(400);
                echo json_encode(['error' => 'invoice_id is required']);
                return;
            }

            $stmt = $db->prepare("SELECT * FROM invoices WHERE id = ?");
            $stmt->execute([$invoiceId]);
            $invoice = $stmt->fetch();
            if (!$invoice) {
                http_response_code(404);
                echo json_encode(['error' => 'Invoice not found']);
                return;
            }

            // Optional remove item
            if (!empty($data['remove_item_id'])) {
                $db->prepare("DELETE FROM invoice_items WHERE id = ? AND invoice_id = ?")
                   ->execute([(int)$data['remove_item_id'], $invoiceId]);
            }

            // Optional add adjustment / correction item
            if (!empty($data['add_item']) && !empty($data['add_item']['item_description'])) {
                $it = $data['add_item'];
                $uPrice = (float)($it['unit_price'] ?? 0);
                $qty = max(1, (int)($it['quantity'] ?? 1));
                $tPrice = $uPrice * $qty;
                $db->prepare("
                    INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                ")->execute([
                    $invoiceId,
                    trim($it['item_type'] ?? 'Other'),
                    trim($it['item_description']),
                    $uPrice,
                    $qty,
                    $tPrice
                ]);
            }

            // Recalculate subtotal from invoice_items
            $sumStmt = $db->prepare("SELECT COALESCE(SUM(total_price), 0) FROM invoice_items WHERE invoice_id = ?");
            $sumStmt->execute([$invoiceId]);
            $newSubtotal = (float)$sumStmt->fetchColumn();

            $discount = isset($data['discount']) ? (float)$data['discount'] : (float)$invoice['discount'];
            $tax = isset($data['tax']) ? (float)$data['tax'] : (float)$invoice['tax'];
            $paidAmount = isset($data['paid_amount']) ? (float)$data['paid_amount'] : (float)$invoice['paid_amount'];
            $notes = isset($data['notes']) ? trim($data['notes']) : ($invoice['notes'] ?? '');

            $newTotal = max(0.0, $newSubtotal - $discount + $tax);
            if ($paidAmount >= $newTotal && $newTotal > 0) {
                $newStatus = 'Paid';
            } elseif ($newTotal == 0.0) {
                $newStatus = 'Paid';
            } elseif ($paidAmount > 0) {
                $newStatus = 'Partial';
            } else {
                $newStatus = 'Unpaid';
            }

            $db->prepare("
                UPDATE invoices
                SET subtotal = ?, discount = ?, tax = ?, total_amount = ?, paid_amount = ?, payment_status = ?, notes = ?
                WHERE id = ?
            ")->execute([$newSubtotal, $discount, $tax, $newTotal, $paidAmount, $newStatus, $notes, $invoiceId]);

            echo json_encode([
                'success' => true,
                'message' => "Invoice {$invoice['invoice_no']} corrected. New Total: \$" . number_format($newTotal, 2),
                'invoice_id' => $invoiceId,
                'subtotal' => $newSubtotal,
                'total_amount' => $newTotal,
                'payment_status' => $newStatus
            ]);
            return;
        }

        // Create Manual Invoice: POST /api/billing/invoices
        $patientId = (int)($data['patient_id'] ?? 0);
        $items = $data['items'] ?? [];
        $notes = trim($data['notes'] ?? '');

        if (!$patientId || empty($items)) {
            http_response_code(400);
            echo json_encode(['error' => 'patient_id and items array are required']);
            return;
        }

        $subtotal = 0.0;
        foreach ($items as $item) {
            $subtotal += ((float)($item['unit_price'] ?? 0)) * ((int)($item['quantity'] ?? 1));
        }

        $year = date('Y');
        $invoiceNo = sprintf("INV-%s-%04d", $year, rand(1000, 9999));

        $stmt = $db->prepare("
            INSERT INTO invoices (invoice_no, patient_id, subtotal, discount, tax, total_amount, paid_amount, payment_status, notes)
            VALUES (?, ?, ?, 0.00, 0.00, ?, 0.00, 'Unpaid', ?)
        ");
        $stmt->execute([$invoiceNo, $patientId, $subtotal, $subtotal, $notes]);
        $newId = (int)$db->lastInsertId();

        $itemStmt = $db->prepare("
            INSERT INTO invoice_items (invoice_id, item_type, item_description, unit_price, quantity, total_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        foreach ($items as $item) {
            $price = (float)($item['unit_price'] ?? 0);
            $qty = (int)($item['quantity'] ?? 1);
            $total = $price * $qty;
            $itemStmt->execute([
                $newId,
                $item['item_type'] ?? 'Other',
                $item['item_description'] ?? 'Hospital Service',
                $price,
                $qty,
                $total
            ]);
        }

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => "Invoice {$invoiceNo} created successfully",
            'invoice_id' => $newId,
            'invoice_no' => $invoiceNo,
            'total_amount' => $subtotal
        ]);
        return;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
