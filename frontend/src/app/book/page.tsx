// frontend/src/app/book/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, User, Phone, CheckCircle2, Clock, LogIn,
  LogOut, FileText, TestTube2, Download, UserPlus, AlertCircle
} from 'lucide-react';
import {
  getDoctors, getDoctorSlots, bookAppointment,
  loginPatient, registerPatient, getPatientProfile
} from '@/lib/api';
import { Doctor, Patient, TimeSlot, Consultation, LabOrder, Appointment } from '@/lib/types';

export default function PatientPortalPage() {
  // Patient session state
  const [patient, setPatient] = useState<Patient | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginMrNo, setLoginMrNo] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regDob, setRegDob] = useState('1994-03-21');

  // Portal Tabs
  const [portalTab, setPortalTab] = useState<'book' | 'appointments' | 'records'>('book');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

  // Booking & Free Slots state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number>(1);
  const [date, setDate] = useState('2026-11-25');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [symptoms, setSymptoms] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<any | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    getDoctors().then((res) => {
      setDoctors(res.doctors || []);
      if (res.doctors && res.doctors.length > 0) {
        setDoctorId(res.doctors[0].id);
      }
    });

    const savedPatient = localStorage.getItem('sehat_patient');
    if (savedPatient) {
      try {
        const parsed = JSON.parse(savedPatient);
        setPatient(parsed);
        loadPatientDetails(parsed.id);
      } catch {
        // ignore
      }
    }
  }, []);

  const loadPatientDetails = async (patientId: number) => {
    try {
      const profile = await getPatientProfile(patientId);
      setAppointments(profile.appointments || []);
      setConsultations(profile.consultations || []);
      setLabOrders(profile.lab_orders || []);
    } catch (e) {
      console.error('Error loading patient records:', e);
    }
  };

  // Fetch free slots whenever doctorId or date changes
  const fetchSlots = async (docId: number, targetDate: string) => {
    if (!docId || !targetDate) return;
    setLoadingSlots(true);
    try {
      const res = await getDoctorSlots(docId, targetDate);
      setSlots(res.slots || []);
      const firstFree = (res.slots || []).find((s) => s.is_available);
      setSelectedSlot(firstFree ? firstFree.time_slot : '');
    } catch (e) {
      console.error('Error fetching slots:', e);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (date && doctorId) {
      fetchSlots(doctorId, date);
    }
  }, [doctorId, date]);

  const handlePatientLogin = async (mrNo: string, phone: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginPatient({ mr_no: mrNo, phone });
      setPatient(res.patient);
      localStorage.setItem('sehat_patient', JSON.stringify(res.patient));
      loadPatientDetails(res.patient.id);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await registerPatient({
        name: regName,
        phone: regPhone,
        gender: regGender,
        dob: regDob,
      });
      setPatient(res.patient);
      localStorage.setItem('sehat_patient', JSON.stringify(res.patient));
      loadPatientDetails(res.patient.id);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutPatient = () => {
    localStorage.removeItem('sehat_patient');
    setPatient(null);
    setBookingResult(null);
  };

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (!selectedSlot) {
      alert('Please select an available free time slot');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await bookAppointment({
        patient_id: patient.id,
        doctor_id: doctorId,
        booking_source: 'Online',
        appointment_date: date,
        time_slot: selectedSlot,
        symptoms: symptoms || 'Online Patient Portal Booking',
      });
      setBookingResult(res);
      setSymptoms('');
      fetchSlots(doctorId, date);
      loadPatientDetails(patient.id);
    } catch (err: any) {
      alert('Booking error: ' + (err.message || err));
    } finally {
      setBookingLoading(false);
    }
  };

  // 1. Unauthenticated Patient Login / Register View
  if (!patient) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-600 text-white shadow-lg">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">SEHAT Patient Portal</h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sign in with your Medical Record Number (MR No) or register to book online doctor appointments with real-time free slots.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Login / Register Card */}
          <div className="md:col-span-3 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 py-2 rounded-lg transition ${
                  authMode === 'login' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                Patient Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={`flex-1 py-2 rounded-lg transition ${
                  authMode === 'register' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                New Patient Registration
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePatientLogin(loginMrNo, loginPhone);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">MR Number (e.g. MR-2026-0001)</label>
                  <input
                    type="text"
                    value={loginMrNo}
                    onChange={(e) => setLoginMrNo(e.target.value)}
                    placeholder="MR-2026-0001"
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="+1-555-0192"
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  {authLoading ? 'Signing In...' : 'Access My Patient Portal'}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePatientRegister} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+1-555-0777"
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold">Gender</label>
                    <select
                      value={regGender}
                      onChange={(e) => setRegGender(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold">Date of Birth</label>
                    <input
                      type="date"
                      value={regDob}
                      onChange={(e) => setRegDob(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {authLoading ? 'Creating MR No...' : 'Register & Enter Portal'}
                </button>
              </form>
            )}
          </div>

          {/* Quick Demo Patient Logins */}
          <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Quick Demo Patient Login</h3>
            <p className="text-xs text-slate-500">Test the patient portal immediately using a seeded MR No:</p>

            <div className="space-y-2">
              {[
                { mr: 'MR-2026-0001', name: 'John Doe', phone: '+1-555-0192' },
                { mr: 'MR-2026-0002', name: 'Maria Garcia', phone: '+1-555-0143' },
                { mr: 'MR-2026-0004', name: 'Emily Chen', phone: '+1-555-0176' },
              ].map((demo) => (
                <button
                  key={demo.mr}
                  type="button"
                  onClick={() => handlePatientLogin(demo.mr, demo.phone)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40 text-left transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600">
                      {demo.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {demo.mr}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{demo.phone}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const freeSlotsCount = slots.filter((s) => s.is_available).length;

  // 2. Authenticated Patient Portal View
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Patient Welcome Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl">
            {patient.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">{patient.name}</h1>
              <span className="font-mono text-xs px-2.5 py-0.5 bg-white/20 rounded-full font-bold">
                {patient.mr_no}
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              📞 {patient.phone} • 🩸 {patient.blood_group || 'Unknown'} • Patient Self-Service Portal
            </p>
          </div>
        </div>

        <button
          onClick={handleLogoutPatient}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition self-start sm:self-center"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Portal Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
        <button
          onClick={() => setPortalTab('book')}
          className={`px-4 py-2 rounded-xl transition ${
            portalTab === 'book'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Book Doctor Appointment (Free Slots)
        </button>
        <button
          onClick={() => setPortalTab('appointments')}
          className={`px-4 py-2 rounded-xl transition ${
            portalTab === 'appointments'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          My Appointments ({appointments.length})
        </button>
        <button
          onClick={() => setPortalTab('records')}
          className={`px-4 py-2 rounded-xl transition ${
            portalTab === 'records'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          My Lab Reports &amp; Rx ({labOrders.length})
        </button>
      </div>

      {/* Tab 1: Book Appointment with Free Slots */}
      {portalTab === 'book' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          {bookingResult ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center font-bold text-2xl">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Appointment Confirmed!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your slot has been reserved and synced to the Doctor&apos;s Live Queue:
                </p>

                <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-sm mx-auto space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">MR Number:</span>
                    <span className="font-mono font-bold text-blue-600">{patient.mr_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Live Queue Token:</span>
                    <span className="font-mono font-bold text-lg text-purple-600">#{bookingResult.token_number}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setBookingResult(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
              >
                Book Another Appointment
              </button>
            </div>
          ) : (
            <form onSubmit={handleBookSlot} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Doctor &amp; Specialty
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty} • ${Number(d.consultation_fee).toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Real-time Free Time Slots Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Available Free Slots ({freeSlotsCount} Free)
                  </label>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> Free
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-700 inline-block"></span> Booked
                    </span>
                  </div>
                </div>

                {loadingSlots ? (
                  <div className="py-6 text-center text-xs text-slate-400">Checking doctor availability...</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot === slot.time_slot;
                      return (
                        <button
                          key={slot.time_slot}
                          type="button"
                          disabled={!slot.is_available}
                          onClick={() => setSelectedSlot(slot.time_slot)}
                          className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition text-center ${
                            !slot.is_available
                              ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 line-through cursor-not-allowed'
                              : isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-[1.02]'
                              : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 hover:border-emerald-500'
                          }`}
                        >
                          {slot.time_slot}
                          <span className="block text-[9px] font-normal mt-0.5">
                            {slot.is_available ? (isSelected ? 'Selected' : 'Free') : 'Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Symptoms / Reason for Visit
                </label>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms or reason for consultation..."
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={bookingLoading || !selectedSlot}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50"
              >
                {bookingLoading
                  ? 'Confirming Slot...'
                  : selectedSlot
                  ? `Confirm Free Slot (${selectedSlot}) & Get Token`
                  : 'No Free Slots Available'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: My Appointments */}
      {portalTab === 'appointments' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {appointments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No appointments booked yet.</div>
          ) : (
            appointments.map((apt) => (
              <div key={apt.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{apt.doctor_name}</p>
                  <p className="text-slate-500 mt-0.5">
                    {apt.appointment_date} at <strong>{apt.time_slot}</strong> • Source: {apt.booking_source}
                  </p>
                  {apt.symptoms && <p className="text-slate-400 mt-1 italic">{apt.symptoms}</p>}
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full font-bold">
                  {apt.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Lab Reports & Prescriptions */}
      {portalTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-cyan-600" />
              My Laboratory Reports (Cloudflare R2)
            </h3>
            {labOrders.length === 0 ? (
              <p className="text-xs text-slate-400">No lab reports available.</p>
            ) : (
              labOrders.map((lo) => (
                <div key={lo.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{lo.test_name}</p>
                    <p className="text-slate-500">{lo.result_value || 'Pending fulfillment'}</p>
                  </div>
                  {lo.report_file_url ? (
                    <a
                      href={lo.report_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                  ) : (
                    <span className="text-amber-600 font-semibold">{lo.status}</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              My Prescriptions
            </h3>
            {consultations.length === 0 ? (
              <p className="text-xs text-slate-400">No consultations recorded.</p>
            ) : (
              consultations.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold">
                    <span>{c.doctor_name}</span>
                    <span className="text-slate-400">{c.created_at}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">Dx: {c.diagnosis}</p>
                  {c.prescriptions?.map((p, i) => (
                    <div key={i} className="text-slate-500 pl-2 border-l-2 border-purple-400">
                      💊 {p.medicine_name} ({p.dosage}) — {p.frequency} for {p.duration}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
