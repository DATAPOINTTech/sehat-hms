// frontend/src/components/PatientProfileModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  X, User, Phone, Mail, MapPin, Calendar, Heart, FileText,
  Activity, Bed, CreditCard, Download, ExternalLink, Printer, CheckCircle2, CalendarPlus
} from 'lucide-react';
import { getPatientProfile, recordPayment } from '@/lib/api';
import { Patient, Consultation, LabOrder, Invoice, Appointment } from '@/lib/types';
import ReceptionistBookModal from './ReceptionistBookModal';

interface PatientProfileModalProps {
  patientId: number | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function PatientProfileModal({ patientId, onClose, onUpdate }: PatientProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'consultations' | 'labs' | 'admissions' | 'billing'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payingInvoiceId, setPayingInvoiceId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    getPatientProfile(patientId)
      .then((data) => {
        setPatient(data.patient);
        setConsultations(data.consultations || []);
        setLabOrders(data.lab_orders || []);
        setAdmissions(data.admissions || []);
        setInvoices(data.invoices || []);
        setAppointments(data.appointments || []);
      })
      .catch((err) => console.error('Error fetching patient profile:', err))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (!patientId) return null;

  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paid_amount), 0);
  const balanceDue = Math.max(0, totalBilled - totalPaid);

  const handlePay = async (invoiceId: number, due: number) => {
    const amount = parseFloat(payAmount) || due;
    if (amount <= 0) return;
    try {
      await recordPayment({ invoice_id: invoiceId, amount, payment_method: 'Cash Desk' });
      setPayingInvoiceId(null);
      setPayAmount('');
      // Reload profile
      const data = await getPatientProfile(patientId);
      setInvoices(data.invoices || []);
      if (onUpdate) onUpdate();
    } catch (e) {
      alert('Payment failed: ' + e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {patient?.name ? patient.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {patient?.name || 'Patient Profile'}
                </h2>
                <span className="font-mono text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-full border border-blue-200 dark:border-blue-700">
                  {patient?.mr_no}
                </span>
                <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium">
                  {patient?.gender}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                📞 {patient?.phone} | 🩸 {patient?.blood_group || 'Unknown'} | DOB: {patient?.dob}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {patient && (
              <button
                onClick={() => setIsBookModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Book Appointment
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Overview & Vitals
          </button>
          <button
            onClick={() => setActiveTab('consultations')}
            className={`py-3 px-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'consultations'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Consultations ({consultations.length})
          </button>
          <button
            onClick={() => setActiveTab('labs')}
            className={`py-3 px-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'labs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Lab Reports & R2 ({labOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('admissions')}
            className={`py-3 px-4 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'admissions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Admissions ({admissions.length})
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`py-3 px-4 font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'billing'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Billing Ledger
            {balanceDue > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 rounded font-bold">
                Due: ${balanceDue.toFixed(2)}
              </span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading Medical Record...</div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && patient && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Medical Record No</p>
                      <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">{patient.mr_no}</p>
                      <p className="text-xs text-slate-500 mt-1">Unique Global Identifier</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Blood Group</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">{patient.blood_group || 'O+'}</p>
                      <p className="text-xs text-slate-500 mt-1">Emergency Matched</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Account Balance</p>
                      <p className={`text-xl font-bold mt-1 ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                        ${balanceDue.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Total Billed: ${totalBilled.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Demographics & Contact Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-4 h-4 text-slate-400" /> {patient.address || 'Address not registered'}
                      </p>
                      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Mail className="w-4 h-4 text-slate-400" /> {patient.email || 'No email provided'}
                      </p>
                      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Heart className="w-4 h-4 text-slate-400" /> Emergency: {patient.emergency_contact || 'None noted'}
                      </p>
                      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-slate-400" /> Registered: {patient.created_at?.split(' ')[0]}
                      </p>
                    </div>
                  </div>

                  {/* Recent Activity summary */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Recent Clinical Engagements</h3>
                    <div className="space-y-2">
                      {consultations.slice(0, 2).map((c) => (
                        <div key={c.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-sm flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">{c.doctor_name}</span>
                            <span className="text-xs text-slate-500 ml-2">({c.created_at})</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Dx: {c.diagnosis || 'General Consultation'}</p>
                          </div>
                          <button
                            onClick={() => setActiveTab('consultations')}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Rx &rarr;
                          </button>
                        </div>
                      ))}
                      {consultations.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No previous consultations recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Consultations Tab */}
              {activeTab === 'consultations' && (
                <div className="space-y-4">
                  {consultations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No clinical consultations recorded yet.</div>
                  ) : (
                    consultations.map((c) => (
                      <div key={c.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">{c.doctor_name}</h4>
                            <p className="text-xs text-slate-500">{c.specialty} • {c.created_at}</p>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-md">
                            Completed
                          </span>
                        </div>

                        {c.vitals && Object.keys(c.vitals).length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {c.vitals.bp && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-medium">BP: {c.vitals.bp}</span>}
                            {c.vitals.hr && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-medium">HR: {c.vitals.hr} bpm</span>}
                            {c.vitals.temp && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-medium">Temp: {c.vitals.temp} °F</span>}
                            {c.vitals.spo2 && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-medium">SpO2: {c.vitals.spo2}%</span>}
                            {c.vitals.weight && <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-medium">Wt: {c.vitals.weight} kg</span>}
                          </div>
                        )}

                        <div className="text-sm">
                          <p><strong className="text-slate-700 dark:text-slate-300">Diagnosis:</strong> {c.diagnosis}</p>
                          {c.chief_complaint && (
                            <p className="text-slate-600 dark:text-slate-400 mt-1"><strong className="text-slate-700 dark:text-slate-300">Complaint:</strong> {c.chief_complaint}</p>
                          )}
                          {c.clinical_notes && (
                            <p className="text-slate-600 dark:text-slate-400 mt-1"><strong className="text-slate-700 dark:text-slate-300">Notes:</strong> {c.clinical_notes}</p>
                          )}
                        </div>

                        {c.prescriptions && c.prescriptions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Prescribed Medications</p>
                            <div className="space-y-1.5">
                              {c.prescriptions.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
                                  <span className="font-semibold text-slate-900 dark:text-white">💊 {p.medicine_name} ({p.dosage})</span>
                                  <span className="text-slate-500">{p.frequency} for {p.duration}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Lab Reports & Cloudflare R2 Tab */}
              {activeTab === 'labs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs">
                    <span className="text-blue-800 dark:text-blue-300 font-medium">
                      ☁️ Documents & Lab PDFs stored securely on <strong>Cloudflare R2</strong> storage (with local fallback).
                    </span>
                  </div>

                  {labOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No laboratory tests ordered for this patient.</div>
                  ) : (
                    labOrders.map((lo) => (
                      <div key={lo.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{lo.test_name}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              lo.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}>
                              {lo.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Category: {lo.category} | Fee: ${Number(lo.fee).toFixed(2)} | Ordered: {lo.created_at}
                          </p>
                          {lo.result_value && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 font-mono bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                              <strong>Result:</strong> {lo.result_value} {lo.unit} (Normal: {lo.normal_range})
                            </p>
                          )}
                          {lo.remarks && (
                            <p className="text-xs text-slate-500 mt-1 italic">Remarks: {lo.remarks}</p>
                          )}
                        </div>

                        {lo.report_file_url ? (
                          <a
                            href={lo.report_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition whitespace-nowrap self-start md:self-center"
                          >
                            <Download className="w-3.5 h-3.5" />
                            View R2 PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic self-start md:self-center">
                            PDF Pending Fulfillment
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Admissions Tab */}
              {activeTab === 'admissions' && (
                <div className="space-y-4">
                  {admissions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No inpatient admission history recorded.</div>
                  ) : (
                    admissions.map((adm) => (
                      <div key={adm.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            Room {adm.room_number} ({adm.ward_category})
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            adm.status === 'Active'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {adm.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Admitted: {adm.admitted_at} | Tariff: ${Number(adm.daily_rate).toFixed(2)}/day
                          {adm.discharged_at && ` | Discharged: ${adm.discharged_at} (${adm.total_days} days)`}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <strong>Diagnosis:</strong> {adm.diagnosis}
                        </p>
                        {adm.inpatient_prescriptions && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            <strong>Inpatient Rx:</strong> {adm.inpatient_prescriptions}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Billing Ledger Tab */}
              {activeTab === 'billing' && (
                <div className="space-y-6">
                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 font-semibold">Total Invoiced</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">${totalBilled.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 font-semibold">Total Paid</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">${totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 font-semibold">Outstanding Balance</p>
                      <p className={`text-lg font-bold mt-1 ${balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
                        ${balanceDue.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Invoices List */}
                  <div className="space-y-4">
                    {invoices.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">No invoices recorded for this patient.</div>
                    ) : (
                      invoices.map((inv) => {
                        const due = Number(inv.total_amount) - Number(inv.paid_amount);
                        return (
                          <div key={inv.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div>
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                  {inv.invoice_no}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">({inv.created_at})</span>
                              </div>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                                inv.payment_status === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : inv.payment_status === 'Partial'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              }`}>
                                {inv.payment_status}
                              </span>
                            </div>

                            {/* Itemized lines */}
                            <div className="space-y-1 text-xs">
                              {inv.items?.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-300">
                                  <span>{it.item_description} x {it.quantity}</span>
                                  <span className="font-mono font-medium">${Number(it.total_price).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                              <div>
                                <span className="text-slate-500 text-xs">Paid: ${Number(inv.paid_amount).toFixed(2)} | </span>
                                <strong className="text-slate-900 dark:text-white font-mono">
                                  Total: ${Number(inv.total_amount).toFixed(2)}
                                </strong>
                              </div>

                              {inv.payment_status !== 'Paid' && (
                                <div className="flex items-center gap-2">
                                  {payingInvoiceId === inv.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        placeholder={`$${due.toFixed(2)}`}
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                        className="w-24 px-2 py-1 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 font-mono"
                                      />
                                      <button
                                        onClick={() => handlePay(inv.id, due)}
                                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setPayingInvoiceId(null)}
                                        className="text-xs text-slate-400 hover:text-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setPayingInvoiceId(inv.id);
                                        setPayAmount(due.toFixed(2));
                                      }}
                                      className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                    >
                                      Record Payment
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {patient && (
        <ReceptionistBookModal
          isOpen={isBookModalOpen}
          onClose={() => setIsBookModalOpen(false)}
          preselectedPatient={patient}
          onBooked={() => {
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}
