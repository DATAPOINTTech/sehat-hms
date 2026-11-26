// frontend/src/components/ReceptionistBookModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, CalendarCheck, CheckCircle2, Clock, UserCheck, Stethoscope } from 'lucide-react';
import { getPatients, getDoctors, getDoctorSlots, bookAppointment } from '@/lib/api';
import { Patient, Doctor, TimeSlot } from '@/lib/types';

interface ReceptionistBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBooked?: () => void;
  preselectedPatient?: Patient | null;
}

export default function ReceptionistBookModal({
  isOpen,
  onClose,
  onBooked,
  preselectedPatient = null,
}: ReceptionistBookModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(preselectedPatient);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number>(1);
  const [bookingMode, setBookingMode] = useState<'walkin' | 'slot'>('walkin');
  const [date, setDate] = useState('2026-11-26');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('Walk-in Now');
  const [symptoms, setSymptoms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedPatient(preselectedPatient);
    setBookingConfirmation(null);
    setSearchQuery('');

    getDoctors().then((res) => {
      setDoctors(res.doctors || []);
      if (res.doctors && res.doctors.length > 0) {
        setDoctorId(res.doctors[0].id);
      }
    });

    // Load initial recent patients
    getPatients().then((res) => setSearchResults(res.patients || []));
  }, [isOpen, preselectedPatient]);

  // Debounced MR No / Name / Phone search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getPatients(searchQuery.trim() || undefined);
        setSearchResults(res.patients || []);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Load free slots when slot mode is active
  useEffect(() => {
    if (!isOpen || bookingMode !== 'slot' || !doctorId || !date) return;
    getDoctorSlots(doctorId, date)
      .then((res) => {
        setSlots(res.slots || []);
        const firstFree = (res.slots || []).find((s) => s.is_available);
        setSelectedSlot(firstFree ? firstFree.time_slot : '');
      })
      .catch(console.error);
  }, [isOpen, bookingMode, doctorId, date]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('Please search and select an existing patient (MR No) first.');
      return;
    }
    if (bookingMode === 'slot' && !selectedSlot) {
      alert('Please select an available time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bookAppointment({
        patient_id: selectedPatient.id,
        doctor_id: doctorId,
        booking_source: 'Walk-in',
        appointment_date: date,
        time_slot: bookingMode === 'walkin' ? 'Walk-in Now' : selectedSlot,
        symptoms: symptoms.trim() || (bookingMode === 'walkin' ? 'Walk-in Consultation' : 'Scheduled Reception Booking'),
      });
      setBookingConfirmation(res);
      if (onBooked) onBooked();
    } catch (err: any) {
      alert('Booking failed: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <CalendarCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Receptionist Booking &amp; Walk-In Token
              </h3>
              <p className="text-[11px] text-slate-500">
                Search existing patient by MR No, Name, or Phone and book into live queue
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {bookingConfirmation ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">Appointment &amp; Token Issued!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Patient <strong>{selectedPatient?.name}</strong> ({selectedPatient?.mr_no}) has been queued.
                </p>
                <div className="mt-4 inline-flex items-center gap-4 px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-left">
                    <span className="text-[10px] uppercase text-slate-400 block">MR Number</span>
                    <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                      {selectedPatient?.mr_no}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-left">
                    <span className="text-[10px] uppercase text-slate-400 block">Live Queue Token</span>
                    <span className="font-mono font-black text-xl text-purple-600 dark:text-purple-400">
                      #{bookingConfirmation.token_number}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Search & Select Existing MR No Patient */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  1. Patient Lookup (Search by MR No, Name, or Phone) *
                </label>

                {selectedPatient ? (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {selectedPatient.name}
                          </span>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800">
                            {selectedPatient.mr_no}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {selectedPatient.phone} • {selectedPatient.gender} • Blood: {selectedPatient.blood_group || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {!preselectedPatient && (
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type MR-2026-0001, patient name, or phone..."
                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-blue-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {searching ? (
                        <div className="p-3 text-center text-xs text-slate-400">Searching MR records...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          No matching patient found. Use &ldquo;New Patient&rdquo; in header to register.
                        </div>
                      ) : (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPatient(p)}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50/70 dark:hover:bg-slate-800 flex items-center justify-between text-xs transition"
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                              <span className="text-slate-400 ml-2">{p.phone}</span>
                            </div>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                              {p.mr_no}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Select Doctor */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  2. Select Doctor &amp; Room *
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty} - {d.room_no} • ${Number(d.consultation_fee).toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Walk-In Now vs Scheduled Time Slot */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  3. Appointment Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingMode('walkin');
                      setSelectedSlot('Walk-in Now');
                    }}
                    className={`py-2 rounded-lg transition ${
                      bookingMode === 'walkin'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    Walk-In Now (Immediate Queue)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode('slot')}
                    className={`py-2 rounded-lg transition ${
                      bookingMode === 'slot'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    Select Free Time Slot
                  </button>
                </div>

                {bookingMode === 'slot' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {slots.map((slot) => (
                        <button
                          key={slot.time_slot}
                          type="button"
                          disabled={!slot.is_available}
                          onClick={() => setSelectedSlot(slot.time_slot)}
                          className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold transition ${
                            !slot.is_available
                              ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 line-through cursor-not-allowed'
                              : selectedSlot === slot.time_slot
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {slot.time_slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Reason / Symptoms */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  4. Chief Complaint / Notes
                </label>
                <input
                  type="text"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Follow-up checkup, fever, prescription renewal"
                  className="w-full px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedPatient}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Booking & Generating Token...' : 'Book Appointment & Issue Token'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
