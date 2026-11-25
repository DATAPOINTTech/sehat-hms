# SEHAT - Hospital Management System (HMS)

> A modern, centralized **Quick-Demo Hospital Management System** built with **Next.js (React, TypeScript, Tailwind CSS)**, a lightweight **PHP 8+ REST API**, **SQLite** database, and **Cloudflare R2** document storage (with zero-config local fallback).

---

## 🌟 Architecture & Key Highlights

* **MR No Centralization:** Every patient has a permanent, sequential **Medical Record Number** (`MR-YYYY-XXXX`) that links their appointments, queue turns, vitals history, digital prescriptions, lab reports, inpatient admissions, and billing invoices.
* **Doctor Queue Management System (QMS) + 10-Minute Auto-Shift:**
  * Real-time doctor queues (`Waiting`, `Called`, `In Consultation`, `Skipped / No-Show`, `Completed`).
  * Live **10:00 countdown timer** on `Called` patient tokens.
  * If a patient does not arrive within 10 minutes, their token is automatically marked `Skipped (No-Show)` and the active turn **auto-shifts to the next waiting patient**.
  * Includes a **"Fast-Forward 10 Min"** button for immediate testing of the timeout auto-shift.
* **Unified Appointment Sync (Online + WhatsApp):**
  * Online web booking portal (`/book`).
  * WhatsApp Webhook endpoint (`POST /api/webhooks/whatsapp.php`) compatible with Meta Cloud API / Twilio.
  * Built-in **"Simulate WhatsApp Booking"** drawer in the UI with one-click test presets.
  * Centralized queue auto-enqueue: Online and WhatsApp bookings instantly appear on Receptionist and Doctor boards.
* **Cloudflare R2 Document Storage:**
  * Official S3-compatible service (`backend/services/R2Service.php`) utilizing AWS SigV4 / `aws/aws-sdk-php` to upload, persist, and download Lab Test PDF reports.
  * Automatic local fallback directory (`backend/uploads/lab-reports/`) if R2 credentials are unset during local testing.
* **Doctor Consultation Console (`/doctor`):**
  * Real-time patient selection, vitals entry (BP, HR, Temp, SpO2, Weight), chief complaint, and diagnosis.
  * Digital Prescription pad (e-Rx) with dosage, frequency, and instructions.
  * Prescribe Lab Tests from catalog (auto-added to billing).
  * Direct 1-click **Inpatient Bed Allotment** during consultation.
* **Inpatient Ward & Bed Board (`/rooms`):**
  * 8 pre-seeded rooms across categories: `General Ward` ($35/day), `Semi-Private` ($70/day), `Private Room` ($140/day), and `ICU` ($300/day).
  * Live statuses: `Available`, `Occupied`, `Cleaning`.
  * Room transfer and discharge flows with automated stay calculation and invoice generation.
* **Unified Billing Desk (`/billing`):**
  * Auto-aggregates Doctor consultation fees, Daily room stay tariffs, and Lab diagnostic fees under the patient's MR No.
  * Cashier payment collection (`Paid`, `Partial`, `Unpaid`) and printable patient receipts.
* **Waiting Room TV View (`/queue-display`):**
  * High-contrast clinic waiting room screen with large token indicators, audio-visual alerts, and upcoming turns.

---

## 📁 Project Folder Structure

```
sehat-app/
├── backend/
│   ├── config/
│   │   ├── config.php            # Environment loader & config
│   │   └── db.php                # SQLite PDO singleton with auto-init
│   ├── routes/
│   │   ├── patients.php          # MR No lookup, global search & registration
│   │   ├── appointments.php      # Appointment bookings & queue sync
│   │   ├── queue.php             # QMS, 10-min countdown & auto-shift logic
│   │   ├── consultations.php     # Doctor encounter, e-Rx & lab test orders
│   │   ├── lab.php               # Lab fulfillment & Cloudflare R2 PDF upload
│   │   ├── rooms.php             # Bed management, transfer & discharge
│   │   ├── billing.php           # Aggregated invoices & payment recording
│   │   └── webhooks.php          # WhatsApp Meta/Twilio webhook endpoint
│   ├── services/
│   │   └── R2Service.php         # Cloudflare R2 S3 SigV4 uploader & local fallback
│   ├── uploads/lab-reports/      # Local fallback folder for PDF reports
│   ├── data/hms.sqlite           # Zero-config SQLite database file
│   ├── init_db.php               # Schema tables & realistic seed data
│   ├── index.php                 # Central REST router & CORS handler
│   ├── composer.json             # PHP dependencies
│   └── .env.example              # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Shell layout & persistent navigation
│   │   │   ├── page.tsx          # Receptionist & Live Queue Board
│   │   │   ├── doctor/page.tsx   # Doctor Clinical Console & e-Rx
│   │   │   ├── lab/page.tsx      # Lab Desk & Cloudflare R2 Reports
│   │   │   ├── rooms/page.tsx    # Inpatient Ward & Bed Board
│   │   │   ├── billing/page.tsx  # Unified Billing Desk & Cashier
│   │   │   ├── book/page.tsx     # Public Patient Booking Portal
│   │   │   └── queue-display/    # Waiting Room TV View
│   │   ├── components/
│   │   │   ├── Navbar.tsx        # Brand header & role navigation
│   │   │   ├── GlobalSearch.tsx  # Real-time MR No / Name / Phone search
│   │   │   ├── WhatsAppSimulator.tsx # Meta/Twilio incoming simulator
│   │   │   ├── CountdownTimer.tsx    # 10-min timer with Fast-Forward
│   │   │   └── PatientProfileModal.tsx # Unified MR No clinical record
│   │   └── lib/
│   │       ├── api.ts            # Typed client API requests
│   │       └── types.ts          # TypeScript domain interfaces
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## ⚡ Quickstart Guide (Under 2 Minutes)

### Prerequisites
* **PHP 8.0+** with `pdo_sqlite` and `curl` extensions enabled
* **Node.js 18+** and **npm**

---

### Step 1: Start the PHP Backend API (Port 8000)

Open a terminal in the root directory:

```bash
# Navigate to backend and copy environment file
cd backend
cp .env.example .env

# Initialize and seed SQLite database (auto-initializes on first run)
php init_db.php

# Start the PHP built-in REST API server
php -S localhost:8000
```

> **API Health Check:** Open [http://localhost:8000/api/health](http://localhost:8000/api/health) to verify SQLite connection and Cloudflare R2 status.

---

### Step 2: Start the Next.js Frontend (Port 3000)

In a new terminal window:

```bash
# Navigate to frontend
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Next.js development server
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## ☁️ Cloudflare R2 Configuration (Optional)

The application includes zero-config **local fallback storage**, so PDF reports work immediately without any setup.

To connect your real **Cloudflare R2** bucket:
1. Log into your **Cloudflare Dashboard** &rarr; **R2 Object Storage**.
2. Create a bucket (e.g. `sehat-reports`).
3. Under **Manage R2 API Tokens**, create a token with `Admin Read & Write` permissions.
4. Update `backend/.env`:

```ini
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=sehat-reports
R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev
```

Restart the PHP server (`php -S localhost:8000`). Uploads will automatically route directly to Cloudflare R2.

---

## 🧪 Pre-Seeded Demo Data

The database comes pre-seeded with realistic clinical data:

### Doctors (3 Clinical Specialists)
* **Dr. Sarah Jenkins** - Cardiology & Internal Medicine (Room 101, Fee: $80)
* **Dr. Farhan Ahmed** - General Medicine & Family Health (Room 102, Fee: $45)
* **Dr. Priya Patel** - Pediatrics & Pulmonology (Room 103, Fee: $60)

### Patients (6 Sequential MR Numbers)
* `MR-2026-0001`: John Doe (Male, B+, +1-555-0192) - Active `Called` token with running 10-min countdown timer!
* `MR-2026-0002`: Maria Garcia (Female, A+, +1-555-0143) - Waiting in Queue
* `MR-2026-0003`: Ahmed Khan (Male, O+, +1-555-0188) - Admitted to General Ward GW-202
* `MR-2026-0004`: Emily Chen (Female, AB+, +1-555-0176) - In Consultation with Dr. Farhan Ahmed
* `MR-2026-0005`: Robert Taylor (Male, O-, +1-555-0121) - Admitted to ICU-402
* `MR-2026-0006`: Fatima Zahra (Female, A-, +1-555-0165) - Pediatrics Queue

### Inpatient Rooms (8 Beds)
* **General Ward:** `GW-201` (Available, $35/day), `GW-202` (Occupied, $35/day)
* **Semi-Private:** `SP-203` (Available, $70/day), `SP-204` (Cleaning / Housekeeping, $70/day)
* **Private Room:** `PV-301` (Available, $140/day), `PV-302` (Occupied, $140/day)
* **ICU:** `ICU-401` (Available, $300/day), `ICU-402` (Occupied, $300/day)

---

## 🩺 Step-by-Step Testing & Verification Walkthrough

1. **Global MR No Search:**
   * In the top navbar, type `MR-2026-0001` or `John` or `555-0192`.
   * Click the result to inspect John Doe's unified medical record: consultations, vitals, lab reports, admissions, and billing invoices.
2. **10-Minute Auto-Shift QMS Test:**
   * On the home page (`/`), find Token #1 (`Called` status).
   * Notice the live **10:00 countdown timer** ticking down.
   * Click **"Fast-Forward 10m"** on the token card:
     * Token #1 immediately updates to `Skipped (No-Show)`.
     * Turn automatically shifts to Token #2 (Maria Garcia), starting a fresh 10:00 timer!
3. **Simulate WhatsApp Booking:**
   * Click **"Simulate WhatsApp"** in the navbar.
   * Select a quick preset (e.g. *Cardiology Booking*) and click **"Dispatch"**.
   * Notice the instant WhatsApp response bubble confirming the newly assigned MR No and Token #.
   * Notice the token instantly appear in Dr. Sarah Jenkins' live queue without page refresh!
4. **Doctor Consultation & e-Rx:**
   * Navigate to **Doctor Console** (`/doctor`).
   * Select Dr. Sarah Jenkins. Click **"Start Consultation Now"** on the active patient.
   * Review vitals, enter chief complaint, add medicines on the digital prescription pad, and check diagnostic tests (e.g. ECG & Lipid Profile).
   * Click **"Finalize Consultation & Bill to MR No"**.
5. **Lab Report Fulfillment & Cloudflare R2:**
   * Go to **Lab & R2 Reports** (`/lab`).
   * Click **"Fulfill & Upload PDF"** on the newly ordered test.
   * Enter test values and remarks, then click **"Complete & Save to R2"**.
   * Click **"View R2 PDF"** to view the generated PDF report.
6. **Room Allotment & Discharge:**
   * Go to **Rooms & Beds** (`/rooms`).
   * Click **"+ Allot Bed"** on an Available bed to admit a patient.
   * On an occupied bed, click **"Discharge"**:
     * Calculates total days stayed.
     * Sets room to `Cleaning`.
     * Automatically generates room tariff invoice under the patient's MR No!
7. **Waiting Room TV Display:**
   * Click **"TV View"** in the navbar or open `/queue-display` in a separate window to view the clinic screen.
