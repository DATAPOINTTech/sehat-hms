// frontend/src/app/doctor/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Stethoscope, User, Heart, Activity, Plus, Trash2,
  FileText, TestTube2, Bed, CheckCircle2, Clock, FastForward, AlertCircle
} from 'lucide-react';
import {
  getDoctors, getQueue, startConsultationToken, saveConsultation,
  getLabCatalog, getRooms, getPatientProfile, fastForward10Min
} from '@/lib/api';
import { Doctor, QueueToken, LabCatalogItem, Room, Patient } from '@/lib/types';
import CountdownTimer from '@/components/CountdownTimer';
import PatientProfileModal from '@/components/PatientProfileModal';
import PermissionGuard from '@/components/PermissionGuard';

export default function DoctorConsolePage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(1);
  const [queue, setQueue] = useState<QueueToken[]>([]);
  const [activeToken, setActiveToken] = useState<QueueToken | null>(null);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [labCatalog, setLabCatalog] = useState<LabCatalogItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedPatientModalId, setSelectedPatientModalId] = useState<number | null>(null);

  // Clinical form state
  const [vitals, setVitals] = useState({ bp: '120/80', hr: '75', temp: '98.6', spo2: '99', weight: '70' });
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState([
    { medicine_name: 'Paracetamol', dosage: '500mg', frequency: 'TDS (3 times/day)', duration: '5 days', instructions: 'After meals' }
  ]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<number[]>([]);
  const [shouldAdmit, setShouldAdmit] = useState(false);
  const [admitRoomId, setAdmitRoomId] = useState<number>(1);
  const [inpatientMeds, setInpatientMeds] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDoctorState = async () => {
    try {
      const qRes = await getQueue(selectedDoctorId);
      const q = qRes.queue || [];
      setQueue(q);

      // Check if there is an in-consultation or called token
      const inCons = q.find((t) => t.status === 'In Consultation');
      const called = q.find((t) => t.status === 'Called');
      const current = inCons || called || null;
      setActiveToken(current);

      if (current) {
        const pRes = await getPatientProfile(current.patient_id);
        setActivePatient(pRes.patient);
      } else {
        setActivePatient(null);
      }
    } catch (e) {
      console.error('Doctor console fetch error:', e);
    }
  };

  useEffect(() => {
    Promise.all([getDoctors(), getLabCatalog(), getRooms()])
      .then(([dRes, lRes, rRes]) => {
        setDoctors(dRes.doctors || []);
        setLabCatalog(lRes.catalog || []);
        setRooms(rRes.rooms || []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchDoctorState();
    const interval = setInterval(fetchDoctorState, 5000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  const handleStartConsultation = async (tokenId: number) => {
    try {
      await startConsultationToken(tokenId);
      fetchDoctorState();
    } catch (e) {
      alert('Error starting consultation: ' + e);
    }
  };

  const addPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      { medicine_name: '', dosage: '1 Tab', frequency: 'OD (Once daily)', duration: '5 days', instructions: 'Take with water' }
    ]);
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const toggleLabTest = (testId: number) => {
    if (selectedLabTestIds.includes(testId)) {
      setSelectedLabTestIds(selectedLabTestIds.filter((id) => id !== testId));
    } else {
      setSelectedLabTestIds([...selectedLabTestIds, testId]);
    }
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken) {
      alert('No active patient selected for consultation');
      return;
    }
    if (!diagnosis.trim()) {
      alert('Clinical diagnosis is required');
      return;
    }

    setSaving(true);
    try {
      await saveConsultation({
        patient_id: activeToken.patient_id,
        doctor_id: selectedDoctorId,
        queue_token_id: activeToken.id,
        vitals,
        chief_complaint: chiefComplaint,
        diagnosis,
        clinical_notes: clinicalNotes,
        prescriptions: prescriptions.filter((p) => p.medicine_name.trim() !== ''),
        lab_tests: selectedLabTestIds,
        admit_patient: shouldAdmit
          ? {
              room_id: admitRoomId,
              inpatient_prescriptions: inpatientMeds,
              notes: 'Admitted from consultation desk',
            }
          : undefined,
      });

      setSuccessMessage('Consultation finalized! Invoices and lab orders generated under MR No.');
      // Reset form
      setChiefComplaint('');
      setDiagnosis('');
      setClinicalNotes('');
      setSelectedLabTestIds([]);
      setShouldAdmit(false);
      setTimeout(() => {
        setSuccessMessage(null);
        fetchDoctorState();
      }, 2500);
    } catch (err: any) {
      alert('Error saving consultation: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const availableRooms = rooms.filter((r) => r.status === 'Available');

  return (
    <PermissionGuard permission="doctor">
    <div className="space-y-6">
      {/* Header & Doctor Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Doctor Clinical Console</h1>
            <p className="text-xs text-slate-500">
              Select your consultation room to attend queued patients, prescribe meds, and order lab tests.
            </p>
          </div>
        </div>

        {/* Doctor Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoctorId(doc.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex flex-col text-left ${
                selectedDoctorId === doc.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-purple-400'
              }`}
            >
              <span>{doc.name}</span>
              <span className="text-[10px] opacity-80">{doc.specialty} • {doc.room_no}</span>
            </button>
          ))}
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Main Grid: Left = Queue & Patient Info, Right = Clinical Pad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Patient & Doctor's Queue */}
        <div className="space-y-6">
          {/* Active Consultation Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Now Serving</span>
              {activeToken && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  activeToken.status === 'In Consultation'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse'
                }`}>
                  {activeToken.status}
                </span>
              )}
            </div>

            {activeToken ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex flex-col items-center justify-center font-black">
                    <span className="text-[10px] uppercase">Token</span>
                    <span className="text-xl">#{activeToken.token_number}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {activeToken.patient_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {activeToken.mr_no}
                      </span>
                      <span className="text-xs text-slate-500">{activeToken.gender}</span>
                    </div>
                  </div>
                </div>

                {/* 10-Minute Timer if Called */}
                {activeToken.status === 'Called' && activeToken.called_at && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Patient has been called. Auto-shifts if not started:</p>
                    <CountdownTimer
                      calledAt={activeToken.called_at}
                      tokenId={activeToken.id}
                      onAutoShift={fetchDoctorState}
                    />
                    <button
                      onClick={() => handleStartConsultation(activeToken.id)}
                      className="w-full mt-2 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition"
                    >
                      Start Consultation Now
                    </button>
                  </div>
                )}

                {/* Full Profile Quick Peek */}
                <button
                  type="button"
                  onClick={() => setSelectedPatientModalId(activeToken.patient_id)}
                  className="w-full py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  View Past History &amp; Lab PDFs &rarr;
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No patient currently called. Pick from your waiting queue below.
              </div>
            )}
          </div>

          {/* Doctor's Queue List */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
              <span>Waiting Patients ({queue.filter(q => q.status === 'Waiting').length})</span>
              <span className="text-xs font-normal text-slate-400 font-mono">{currentDoctor?.room_no}</span>
            </h3>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {queue
                .filter((t) => t.status === 'Waiting')
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-purple-600 dark:text-purple-400">#{t.token_number}</span>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">{t.patient_name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{t.mr_no} • {t.source}</span>
                    </div>

                    <button
                      onClick={() => handleStartConsultation(t.id)}
                      className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                      Call
                    </button>
                  </div>
                ))}
              {queue.filter((t) => t.status === 'Waiting').length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No waiting patients.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Clinical Consultation Pad */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSaveConsultation} className="space-y-6 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Clinical Encounter &amp; Digital Rx
              </h2>
              {activeToken && (
                <span className="text-xs font-mono text-slate-500">
                  MR No: <strong className="text-blue-600 dark:text-blue-400">{activeToken.mr_no}</strong>
                </span>
              )}
            </div>

            {/* Vitals Input Strip */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Patient Vitals
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Blood Pressure</span>
                  <input
                    type="text"
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                    placeholder="120/80"
                    className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Heart Rate (bpm)</span>
                  <input
                    type="text"
                    value={vitals.hr}
                    onChange={(e) => setVitals({ ...vitals, hr: e.target.value })}
                    placeholder="72"
                    className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Temp (°F)</span>
                  <input
                    type="text"
                    value={vitals.temp}
                    onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                    placeholder="98.6"
                    className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">SpO2 (%)</span>
                  <input
                    type="text"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                    placeholder="99"
                    className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Weight (kg)</span>
                  <input
                    type="text"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                    placeholder="70"
                    className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Complaints & Diagnosis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Chief Complaint *
                </label>
                <textarea
                  rows={2}
                  required
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Sharp chest pain on exertion, breathlessness since 2 days"
                  className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Diagnosis / Assessment *
                </label>
                <textarea
                  rows={2}
                  required
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Unstable Angina / Acute Coronary Syndrome rule out"
                  className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Clinical Examination Notes
              </label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="e.g. S1 S2 heard, bilateral air entry equal, no pedal edema. Advised cardiac enzymes and rest."
                className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-purple-500"
              />
            </div>

            {/* Digital Prescription Pad */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Digital Prescription (e-Rx)
                </label>
                <button
                  type="button"
                  onClick={addPrescriptionRow}
                  className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Medicine
                </button>
              </div>

              <div className="space-y-2">
                {prescriptions.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Medicine Name (e.g. Atorvastatin)"
                        value={p.medicine_name}
                        onChange={(e) => {
                          const updated = [...prescriptions];
                          updated[idx].medicine_name = e.target.value;
                          setPrescriptions(updated);
                        }}
                        className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Dosage (20mg)"
                        value={p.dosage}
                        onChange={(e) => {
                          const updated = [...prescriptions];
                          updated[idx].dosage = e.target.value;
                          setPrescriptions(updated);
                        }}
                        className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Frequency (OD / BD / TDS)"
                        value={p.frequency}
                        onChange={(e) => {
                          const updated = [...prescriptions];
                          updated[idx].frequency = e.target.value;
                          setPrescriptions(updated);
                        }}
                        className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Duration (7 days)"
                        value={p.duration}
                        onChange={(e) => {
                          const updated = [...prescriptions];
                          updated[idx].duration = e.target.value;
                          setPrescriptions(updated);
                        }}
                        className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removePrescriptionRow(idx)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prescribe Diagnostic & Lab Tests */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Order Diagnostic &amp; Lab Tests (Automated Billing &amp; Cloudflare R2 Report)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {labCatalog.map((test) => {
                  const isChecked = selectedLabTestIds.includes(test.id);
                  return (
                    <button
                      key={test.id}
                      type="button"
                      onClick={() => toggleLabTest(test.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition ${
                        isChecked
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="line-clamp-1">{test.test_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">${Number(test.fee).toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inpatient Admission Section */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldAdmit}
                  onChange={(e) => setShouldAdmit(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-purple-600" />
                  Direct Inpatient Admission (Allot Hospital Ward / Bed)
                </span>
              </label>

              {shouldAdmit && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Select Available Bed</label>
                    <select
                      value={admitRoomId}
                      onChange={(e) => setAdmitRoomId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.room_number} - {r.ward_category} (${Number(r.daily_rate).toFixed(2)}/day)
                        </option>
                      ))}
                      {availableRooms.length === 0 && (
                        <option disabled>No beds currently available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Inpatient Prescriptions &amp; Nursing Orders</label>
                    <textarea
                      rows={2}
                      value={inpatientMeds}
                      onChange={(e) => setInpatientMeds(e.target.value)}
                      placeholder="e.g. IV Normal Saline 100ml/hr, monitor vitals 2-hourly, NPO until morning"
                      className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !activeToken}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving Encounter & Generating Invoices...' : 'Finalize Consultation & Bill to MR No'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Patient Profile Modal */}
      {selectedPatientModalId && (
        <PatientProfileModal
          patientId={selectedPatientModalId}
          onClose={() => setSelectedPatientModalId(null)}
          onUpdate={fetchDoctorState}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
