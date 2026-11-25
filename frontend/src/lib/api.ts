// frontend/src/lib/api.ts
import {
  Patient,
  Doctor,
  QueueToken,
  Appointment,
  Consultation,
  LabCatalogItem,
  LabOrder,
  Room,
  Invoice,
  StaffUser,
  PermissionKey,
  TimeSlot,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Health & Storage Info
export async function getHealthInfo() {
  return fetchJson<{
    status: string;
    database: string;
    storage: string;
    is_r2_configured: boolean;
    timestamp: string;
  }>('/health');
}

// Patients API
export async function getPatients(search?: string): Promise<{ success: boolean; patients: Patient[] }> {
  const query = search ? `?q=${encodeURIComponent(search)}` : '';
  return fetchJson(`/patients${query}`);
}

export async function getPatientProfile(id: number): Promise<{
  success: boolean;
  patient: Patient;
  consultations: Consultation[];
  lab_orders: LabOrder[];
  admissions: any[];
  invoices: Invoice[];
  appointments: Appointment[];
}> {
  return fetchJson(`/patients/${id}`);
}

export async function registerPatient(data: Partial<Patient>): Promise<{ success: boolean; patient: Patient; mr_no: string }> {
  return fetchJson('/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Doctors API
export async function getDoctors(): Promise<{ success: boolean; doctors: Doctor[] }> {
  return fetchJson('/doctors');
}

// Appointments API
export async function getAppointments(): Promise<{ success: boolean; appointments: Appointment[] }> {
  return fetchJson('/appointments');
}

export async function bookAppointment(data: {
  patient_id?: number;
  patient_name?: string;
  patient_phone?: string;
  patient_gender?: string;
  patient_dob?: string;
  doctor_id: number;
  booking_source?: string;
  appointment_date?: string;
  time_slot?: string;
  symptoms?: string;
}): Promise<any> {
  return fetchJson('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Queue API & 10-Minute Auto Shift
export async function getQueue(doctorId?: number): Promise<{
  success: boolean;
  queue: QueueToken[];
  auto_shifted?: any[];
  server_time: string;
}> {
  const query = doctorId ? `?doctor_id=${doctorId}` : '';
  return fetchJson(`/queue${query}`);
}

export async function callPatientToken(tokenId: number) {
  return fetchJson('/queue/call', {
    method: 'POST',
    body: JSON.stringify({ token_id: tokenId }),
  });
}

export async function startConsultationToken(tokenId: number) {
  return fetchJson('/queue/start', {
    method: 'POST',
    body: JSON.stringify({ token_id: tokenId }),
  });
}

export async function skipPatientToken(tokenId: number) {
  return fetchJson('/queue/skip', {
    method: 'POST',
    body: JSON.stringify({ token_id: tokenId }),
  });
}

export async function completePatientToken(tokenId: number) {
  return fetchJson('/queue/complete', {
    method: 'POST',
    body: JSON.stringify({ token_id: tokenId }),
  });
}

export async function fastForward10Min(doctorId?: number) {
  return fetchJson('/queue/fast-forward-10m', {
    method: 'POST',
    body: JSON.stringify({ doctor_id: doctorId }),
  });
}

// Consultations API
export async function saveConsultation(data: {
  patient_id: number;
  doctor_id: number;
  queue_token_id?: number;
  vitals?: any;
  chief_complaint?: string;
  diagnosis?: string;
  clinical_notes?: string;
  prescriptions?: any[];
  lab_tests?: number[];
  admit_patient?: {
    room_id: number;
    inpatient_prescriptions?: string;
    notes?: string;
  };
}) {
  return fetchJson('/consultations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Lab API & Cloudflare R2
export async function getLabCatalog(): Promise<{ success: boolean; catalog: LabCatalogItem[] }> {
  return fetchJson('/lab/catalog');
}

export async function getLabOrders(): Promise<{
  success: boolean;
  orders: LabOrder[];
  storage_info: { storage_type: string; is_r2_configured: boolean };
}> {
  return fetchJson('/lab/orders');
}

export async function fulfillLabOrder(data: {
  order_id: number;
  result_value: string;
  remarks?: string;
  generate_demo_pdf?: boolean;
}) {
  return fetchJson('/lab/fulfill', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function uploadLabPdf(orderId: number, file: File) {
  const formData = new FormData();
  formData.append('order_id', orderId.toString());
  formData.append('pdf_file', file);

  const res = await fetch(`${API_BASE}/lab/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Rooms & Admissions API
export async function getRooms(): Promise<{ success: boolean; rooms: Room[] }> {
  return fetchJson('/rooms');
}

export async function admitPatientToRoom(data: {
  patient_id: number;
  doctor_id?: number;
  room_id: number;
  diagnosis: string;
  inpatient_prescriptions?: string;
  notes?: string;
}) {
  return fetchJson('/rooms/admit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function transferRoom(data: {
  admission_id: number;
  new_room_id: number;
}) {
  return fetchJson('/rooms/transfer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function dischargePatient(admissionId: number) {
  return fetchJson('/rooms/discharge', {
    method: 'POST',
    body: JSON.stringify({ admission_id: admissionId }),
  });
}

export async function updateRoomStatus(roomId: number, status: 'Available' | 'Cleaning' | 'Occupied') {
  return fetchJson('/rooms/status', {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId, status }),
  });
}

// Billing API
export async function getBillingOverview(): Promise<{
  success: boolean;
  invoices: Invoice[];
  stats: { total_revenue: number; total_collected: number; total_pending: number };
}> {
  return fetchJson('/billing');
}

export async function getPatientBilling(patientId: number): Promise<{
  success: boolean;
  patient: Patient;
  invoices: Invoice[];
  summary: { total_billed: number; total_paid: number; balance_due: number };
}> {
  return fetchJson(`/billing/patient/${patientId}`);
}

export async function recordPayment(data: {
  invoice_id: number;
  amount: number;
  payment_method?: string;
}) {
  return fetchJson('/billing/pay', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createInvoice(data: {
  patient_id: number;
  items: { item_type: string; item_description: string; unit_price: number; quantity: number }[];
  notes?: string;
}) {
  return fetchJson('/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// WhatsApp Webhook Simulator
export async function simulateWhatsAppMessage(data: {
  patient_name: string;
  patient_phone: string;
  message: string;
  doctor_id?: number;
}) {
  return fetchJson('/webhooks/whatsapp', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Available Slots API
export async function getDoctorSlots(doctorId: number, date: string): Promise<{
  success: boolean;
  doctor_id: number;
  date: string;
  slots: TimeSlot[];
}> {
  return fetchJson(`/appointments/slots?doctor_id=${doctorId}&date=${encodeURIComponent(date)}`);
}

// Auth API
export async function loginStaff(username: string, password: string): Promise<{
  success: boolean;
  token: string;
  user: StaffUser;
}> {
  return fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function loginPatient(credentials: { mr_no?: string; phone?: string }): Promise<{
  success: boolean;
  patient: Patient;
}> {
  return fetchJson('/auth/patient-login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getMe(token: string): Promise<{ success: boolean; user: StaffUser }> {
  return fetchJson('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Admin RBAC API
export async function getAdminUsers(): Promise<{
  success: boolean;
  users: StaffUser[];
  available_permissions: { key: PermissionKey; label: string }[];
}> {
  return fetchJson('/admin/users');
}

export async function createAdminUser(data: {
  username: string;
  password?: string;
  full_name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  shift?: string;
  salary?: number;
  permissions: PermissionKey[];
}) {
  return fetchJson('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addDoctor(data: {
  name: string;
  specialty: string;
  consultation_fee: number;
  room_no: string;
  status?: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  salary?: number;
  permissions?: PermissionKey[];
}) {
  return fetchJson('/admin/doctors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDoctor(data: {
  id: number;
  name?: string;
  specialty?: string;
  consultation_fee?: number;
  room_no?: string;
  status?: string;
}) {
  return fetchJson('/admin/doctors/update', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function correctInvoice(data: {
  invoice_id: number;
  discount?: number;
  tax?: number;
  paid_amount?: number;
  notes?: string;
  remove_item_id?: number;
  add_item?: {
    item_type: string;
    item_description: string;
    unit_price: number;
    quantity: number;
  };
}) {
  return fetchJson('/billing/correct', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUserPermissions(data: {
  user_id: number;
  permissions: PermissionKey[];
  role?: string;
  status?: string;
}) {
  return fetchJson('/admin/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// HR API
export async function getHrStaff(): Promise<{
  success: boolean;
  staff: StaffUser[];
  stats: { total_staff: number; active_staff: number; monthly_payroll: number };
}> {
  return fetchJson('/hr');
}

export async function addHrStaff(data: {
  full_name: string;
  username: string;
  role: string;
  department: string;
  phone?: string;
  email?: string;
  shift?: string;
  salary?: number;
}) {
  return fetchJson('/hr/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHrStaff(data: {
  user_id: number;
  department?: string;
  shift?: string;
  salary?: number;
  status?: string;
}) {
  return fetchJson('/hr/update', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
