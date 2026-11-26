// frontend/src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, Stethoscope, Clock, CheckCircle2, AlertTriangle,
  ArrowRight, Phone, Plus, RefreshCw, Calendar, Tv, Sparkles
} from 'lucide-react';
import { getQueue, getDoctors, callPatientToken, skipPatientToken, fastForward10Min, bookAppointment, getPatients } from '@/lib/api';
import { QueueToken, Doctor, Patient } from '@/lib/types';
import CountdownTimer from '@/components/CountdownTimer';
import PatientProfileModal from '@/components/PatientProfileModal';
import ReceptionistBookModal from '@/components/ReceptionistBookModal';
import PermissionGuard from '@/components/PermissionGuard';

export default function HomePage() {
  const [queue, setQueue] = useState<QueueToken[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [walkinPatientId, setWalkinPatientId] = useState<number>(1);
  const [walkinDoctorId, setWalkinDoctorId] = useState<number>(1);
  const [autoShiftAlert, setAutoShiftAlert] = useState<string | null>(null);

  const fetchLiveQueue = async () => {
    try {
      const qRes = await getQueue(selectedDoctorId || undefined);
      setQueue(qRes.queue || []);
      if (qRes.auto_shifted && qRes.auto_shifted.length > 0) {
        setAutoShiftAlert(
          `Auto-Shift Event: Token #${qRes.auto_shifted[0].skipped_token_number} exceeded 10 mins and was marked Skipped (No-Show). Turn shifted to next waiting patient!`
        );
        setTimeout(() => setAutoShiftAlert(null), 8000);
      }
    } catch (err) {
      console.error('Queue poll error:', err);
    }
  };

  useEffect(() => {
    Promise.all([getDoctors(), getPatients()])
      .then(([docRes, patRes]) => {
        setDoctors(docRes.doctors || []);
        setPatientsList(patRes.patients || []);
      })
      .catch(console.error);

    fetchLiveQueue().finally(() => setLoading(false));

    // Lightweight 5-second polling for real-time synchronization
    const interval = setInterval(fetchLiveQueue, 5000);
    return () => clearInterval(interval);
  }, [selectedDoctorId]);

  const handleCall = async (tokenId: number) => {
    try {
      await callPatientToken(tokenId);
      fetchLiveQueue();
    } catch (e) {
      alert('Error calling patient: ' + e);
    }
  };

  const handleSkip = async (tokenId: number) => {
    try {
      await skipPatientToken(tokenId);
      fetchLiveQueue();
    } catch (e) {
      alert('Error skipping patient: ' + e);
    }
  };

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bookAppointment({
        patient_id: walkinPatientId,
        doctor_id: walkinDoctorId,
        booking_source: 'Walk-in',
        appointment_date: new Date().toISOString().split('T')[0],
        time_slot: 'Walk-in Now',
        symptoms: 'Walk-in Clinic Visit',
      });
      setIsWalkinModalOpen(false);
      fetchLiveQueue();
    } catch (e) {
      alert('Walk-in booking error: ' + e);
    }
  };

  // Queue metrics
  const waitingTokens = queue.filter((t) => t.status === 'Waiting');
  const calledTokens = queue.filter((t) => t.status === 'Called');
  const inConsultationTokens = queue.filter((t) => t.status === 'In Consultation');
  const completedTokens = queue.filter((t) => t.status === 'Completed');

  return (
    <PermissionGuard permission="reception">
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 text-white shadow-lg">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-white/20 rounded-full inline-block mb-1.5">
            Receptionist &amp; QMS Controller
          </span>
          <h1 className="text-2xl font-black tracking-tight">Centralized Doctor Queue &amp; Patient Desk</h1>
          <p className="text-xs text-blue-100 mt-1 max-w-xl">
            Live synchronization between Online bookings, WhatsApp appointments, and Clinic Walk-ins with automated 10-minute turn shifting.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setIsWalkinModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            Search MR &amp; Book Appointment
          </button>
          <button
            onClick={fetchLiveQueue}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
            title="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto Shift Notification Alert */}
      {autoShiftAlert && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="font-semibold">{autoShiftAlert}</span>
          </div>
          <button onClick={() => setAutoShiftAlert(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Waiting in Queue</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{waitingTokens.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ready for consultation</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Called</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{calledTokens.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">10-min countdown running</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">In Consultation</span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{inConsultationTokens.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">With doctor currently</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Completed Today</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedTokens.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Consulted &amp; billed</p>
        </div>
      </div>

      {/* Doctor Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedDoctorId(null)}
          className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
            selectedDoctorId === null
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          All Doctors ({doctors.length})
        </button>
        {doctors.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setSelectedDoctorId(doc.id)}
            className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              selectedDoctorId === doc.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>{doc.name}</span>
            <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-[10px]">
              {doc.room_no}
            </span>
          </button>
        ))}
      </div>

      {/* Live Queue Cards / Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Live Patient Queue Board
          </h2>
          <span className="text-xs text-slate-400">Auto-syncs every 5s</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading Live Queue...</div>
        ) : queue.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No active tokens in queue. Issue a walk-in token or simulate a WhatsApp booking above!
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {queue.map((token) => (
              <div
                key={token.id}
                className="p-4 sm:px-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  {/* Token Number Badge */}
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shadow-sm ${
                    token.status === 'Called'
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse'
                      : token.status === 'In Consultation'
                      ? 'bg-purple-600 text-white'
                      : token.status === 'Skipped (No-Show)'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 line-through'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider leading-none">Token</span>
                    <span className="text-xl leading-none mt-1">#{token.token_number}</span>
                  </div>

                  {/* Patient Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPatientId(token.patient_id)}
                        className="font-bold text-base text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition text-left"
                      >
                        {token.patient_name}
                      </button>
                      <button
                        onClick={() => setSelectedPatientId(token.patient_id)}
                        className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                        title="Click to view full Medical Record profile"
                      >
                        {token.mr_no}
                      </button>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {token.source}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Doctor: <strong className="text-slate-700 dark:text-slate-300">{token.doctor_name}</strong> ({token.room_no}) • {token.phone}
                    </p>
                  </div>
                </div>

                {/* Status & 10-Minute Countdown Timer */}
                <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
                  {/* Status Badge */}
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                    token.status === 'Called'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      : token.status === 'In Consultation'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                      : token.status === 'Skipped (No-Show)'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      : token.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {token.status}
                  </span>

                  {/* 10-Minute Live Auto-Shift Timer for Called Token */}
                  {token.status === 'Called' && token.called_at && (
                    <CountdownTimer
                      calledAt={token.called_at}
                      tokenId={token.id}
                      doctorName={token.doctor_name}
                      onAutoShift={fetchLiveQueue}
                    />
                  )}

                  {/* Quick Receptionist Controls */}
                  {token.status === 'Waiting' && (
                    <button
                      onClick={() => handleCall(token.id)}
                      className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition active:scale-95"
                    >
                      Call Patient
                    </button>
                  )}

                  {token.status === 'Called' && (
                    <button
                      onClick={() => handleSkip(token.id)}
                      className="px-2.5 py-1 text-xs font-semibold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                    >
                      Skip (No-Show)
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedPatientId(token.patient_id)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Profile &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receptionist Search MR & Book Appointment Modal */}
      <ReceptionistBookModal
        isOpen={isWalkinModalOpen}
        onClose={() => setIsWalkinModalOpen(false)}
        onBooked={fetchLiveQueue}
      />

      {/* Patient Profile Modal */}
      {selectedPatientId && (
        <PatientProfileModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          onUpdate={fetchLiveQueue}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
