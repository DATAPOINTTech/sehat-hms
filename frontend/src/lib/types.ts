// frontend/src/lib/types.ts

export interface Patient {
  id: number;
  mr_no: string;
  name: string;
  gender: string;
  dob: string;
  phone: string;
  email?: string;
  address?: string;
  blood_group?: string;
  emergency_contact?: string;
  created_at?: string;
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  consultation_fee: number;
  room_no: string;
  status: string;
  waiting_count?: number;
  current_called_token?: number | null;
  current_in_consultation_token?: number | null;
}

export interface QueueToken {
  id: number;
  doctor_id: number;
  patient_id: number;
  appointment_id?: number | null;
  token_number: number;
  status: 'Waiting' | 'Called' | 'In Consultation' | 'Skipped (No-Show)' | 'Completed';
  called_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  source: string;
  created_at: string;
  mr_no: string;
  patient_name: string;
  gender: string;
  phone: string;
  blood_group?: string;
  doctor_name: string;
  specialty: string;
  room_no: string;
  countdown_seconds_remaining?: number | null;
  elapsed_seconds?: number | null;
}

export interface Appointment {
  id: number;
  patient_id: number;
  doctor_id: number;
  booking_source: 'Online' | 'WhatsApp' | 'Walk-in';
  appointment_date: string;
  time_slot: string;
  symptoms?: string;
  status: string;
  created_at: string;
  mr_no?: string;
  patient_name?: string;
  patient_phone?: string;
  doctor_name?: string;
  specialty?: string;
}

export interface Prescription {
  id?: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Consultation {
  id: number;
  patient_id: number;
  doctor_id: number;
  queue_token_id?: number;
  vitals?: {
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    spo2?: string;
  };
  chief_complaint?: string;
  diagnosis?: string;
  clinical_notes?: string;
  created_at: string;
  doctor_name?: string;
  specialty?: string;
  prescriptions?: Prescription[];
  lab_orders?: LabOrder[];
}

export interface LabCatalogItem {
  id: number;
  test_name: string;
  category: string;
  fee: number;
  normal_range?: string;
  unit?: string;
}

export interface LabOrder {
  id: number;
  consultation_id?: number | null;
  patient_id: number;
  doctor_id: number;
  test_catalog_id: number;
  status: 'Pending' | 'Sample Collected' | 'Completed';
  result_value?: string;
  remarks?: string;
  report_file_url?: string;
  report_file_key?: string;
  completed_at?: string;
  created_at: string;
  test_name: string;
  category?: string;
  fee?: number;
  normal_range?: string;
  unit?: string;
  mr_no?: string;
  patient_name?: string;
  doctor_name?: string;
}

export interface Room {
  id: number;
  room_number: string;
  ward_category: 'General Ward' | 'Semi-Private' | 'Private Room' | 'ICU';
  daily_rate: number;
  status: 'Available' | 'Occupied' | 'Cleaning';
  current_admission_id?: number | null;
  admission_id?: number | null;
  admitted_at?: string | null;
  diagnosis?: string | null;
  patient_id?: number | null;
  mr_no?: string | null;
  patient_name?: string | null;
  gender?: string | null;
  phone?: string | null;
  doctor_name?: string | null;
  current_stay_days?: number;
  accumulated_room_charges?: number;
}

export interface Admission {
  id: number;
  patient_id: number;
  doctor_id: number;
  consultation_id?: number;
  room_id: number;
  diagnosis: string;
  inpatient_prescriptions?: string;
  admitted_at: string;
  discharged_at?: string | null;
  total_days: number;
  status: 'Active' | 'Discharged';
  notes?: string;
  room_number?: string;
  ward_category?: string;
  daily_rate?: number;
  doctor_name?: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  item_type: 'Consultation' | 'Room' | 'Lab' | 'Medicine' | 'Other';
  item_description: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  reference_id?: number | null;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  patient_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'Unpaid' | 'Partial' | 'Paid';
  payment_method: string;
  notes?: string;
  created_at: string;
  mr_no?: string;
  patient_name?: string;
  patient_phone?: string;
  items?: InvoiceItem[];
}

export type PermissionKey =
  | 'reception'
  | 'doctor'
  | 'admission'
  | 'lab'
  | 'hr'
  | 'billing'
  | 'queue_display'
  | 'admin';

export interface StaffUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
  department?: string;
  email?: string;
  phone?: string;
  shift?: string;
  salary?: number;
  status: string;
  permissions: PermissionKey[];
  doctor_id?: number | null;
  created_at?: string;
}

export interface TimeSlot {
  time_slot: string;
  is_available: boolean;
}
