// frontend/src/app/rooms/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Bed, ArrowRightLeft, LogOut, CheckCircle2, UserPlus,
  RefreshCw, DollarSign, Calendar, Clock, AlertCircle
} from 'lucide-react';
import { getRooms, admitPatientToRoom, transferRoom, dischargePatient, updateRoomStatus, getPatients, getDoctors } from '@/lib/api';
import { Room, Patient, Doctor } from '@/lib/types';
import PatientProfileModal from '@/components/PatientProfileModal';
import PermissionGuard from '@/components/PermissionGuard';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientModalId, setSelectedPatientModalId] = useState<number | null>(null);

  // Modals state
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferAdmissionId, setTransferAdmissionId] = useState<number | null>(null);
  const [newRoomId, setNewRoomId] = useState<number>(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [admitData, setAdmitData] = useState({
    patient_id: 1,
    doctor_id: 1,
    room_id: 1,
    diagnosis: 'Severe respiratory distress observation',
    inpatient_prescriptions: 'Salbutamol Nebulization TDS, IV Ceftriaxone 1g BD',
    notes: 'Admitted via Emergency Ward',
  });

  const [dischargeResult, setDischargeResult] = useState<any | null>(null);

  const fetchRooms = async () => {
    try {
      const res = await getRooms();
      setRooms(res.rooms || []);
    } catch (e) {
      console.error('Error fetching rooms:', e);
    }
  };

  useEffect(() => {
    Promise.all([getRooms(), getPatients(), getDoctors()])
      .then(([rRes, pRes, dRes]) => {
        setRooms(rRes.rooms || []);
        setPatients(pRes.patients || []);
        setDoctors(dRes.doctors || []);
      })
      .finally(() => setLoading(false));

    const interval = setInterval(fetchRooms, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await admitPatientToRoom(admitData);
      setIsAdmitOpen(false);
      fetchRooms();
    } catch (err: any) {
      alert('Admission error: ' + (err.message || err));
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAdmissionId) return;
    try {
      await transferRoom({ admission_id: transferAdmissionId, new_room_id: newRoomId });
      setIsTransferOpen(false);
      setTransferAdmissionId(null);
      fetchRooms();
    } catch (err: any) {
      alert('Transfer error: ' + (err.message || err));
    }
  };

  const handleDischarge = async (admissionId: number) => {
    if (!confirm('Discharge this patient and generate final room stay bill?')) return;
    try {
      const res = await dischargePatient(admissionId);
      setDischargeResult(res);
      fetchRooms();
    } catch (err: any) {
      alert('Discharge error: ' + (err.message || err));
    }
  };

  const handleStatusChange = async (roomId: number, status: 'Available' | 'Cleaning') => {
    try {
      await updateRoomStatus(roomId, status);
      fetchRooms();
    } catch (err: any) {
      alert('Status update error: ' + (err.message || err));
    }
  };

  const occupiedRooms = rooms.filter((r) => r.status === 'Occupied');
  const availableRooms = rooms.filter((r) => r.status === 'Available');
  const cleaningRooms = rooms.filter((r) => r.status === 'Cleaning');

  return (
    <PermissionGuard permission="admission">
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Bed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Inpatient Ward &amp; Bed Management</h1>
            <p className="text-xs text-slate-500">
              Track General Ward, Semi-Private, Private Suite, and ICU beds. Allot, transfer, and discharge with auto-calculated tariffs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setIsAdmitOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Admit Patient
          </button>
          <button
            onClick={fetchRooms}
            className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            title="Refresh Beds"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Discharge bill alert */}
      {dischargeResult && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dischargeResult.message}</span>
          </div>
          <button onClick={() => setDischargeResult(null)} className="font-bold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Occupancy stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Hospital Beds</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{rooms.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Available Beds</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{availableRooms.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Occupied Beds</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{occupiedRooms.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Cleaning / Turnover</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{cleaningRooms.length}</p>
        </div>
      </div>

      {/* Bed Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rooms.map((room) => {
          const isOccupied = room.status === 'Occupied';
          const isCleaning = room.status === 'Cleaning';
          return (
            <div
              key={room.id}
              className={`p-4 rounded-2xl border transition shadow-sm flex flex-col justify-between ${
                isOccupied
                  ? 'border-indigo-300 dark:border-indigo-900/60 bg-white dark:bg-slate-900'
                  : isCleaning
                  ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {room.room_number}
                  </span>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                    isOccupied
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : isCleaning
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  }`}>
                    {room.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                  <span>{room.ward_category}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    ${Number(room.daily_rate).toFixed(2)}/day
                  </span>
                </div>

                {/* Patient Occupancy Info */}
                {isOccupied && room.patient_name && (
                  <div className="mt-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 dark:text-indigo-200">
                        {room.patient_name}
                      </span>
                      <button
                        onClick={() => setSelectedPatientModalId(room.patient_id || null)}
                        className="font-mono font-bold text-[10px] text-blue-600 dark:text-blue-400 underline"
                      >
                        {room.mr_no}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      Dx: {room.diagnosis}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                      <span>Stay: {room.current_stay_days || 1} day(s)</span>
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        ${Number(room.accumulated_room_charges || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {isCleaning && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-100/50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                    <p className="text-[11px] font-medium">Bed being sanitized &amp; prepared by housekeeping.</p>
                    <button
                      onClick={() => handleStatusChange(room.id, 'Available')}
                      className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition text-[11px]"
                    >
                      Mark Clean &amp; Ready
                    </button>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {isOccupied && room.admission_id ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      onClick={() => {
                        setTransferAdmissionId(room.admission_id!);
                        setIsTransferOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 transition"
                      title="Transfer patient to another room"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Transfer
                    </button>
                    <button
                      onClick={() => handleDischarge(room.admission_id!)}
                      className="flex-1 py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 transition shadow-sm"
                      title="Discharge and calculate final room tariff"
                    >
                      <LogOut className="w-3 h-3" />
                      Discharge
                    </button>
                  </div>
                ) : room.status === 'Available' ? (
                  <button
                    onClick={() => {
                      setAdmitData({ ...admitData, room_id: room.id });
                      setIsAdmitOpen(true);
                    }}
                    className="w-full py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg transition"
                  >
                    + Allot Bed
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Turnover in progress</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admit Patient Modal */}
      {isAdmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Bed className="w-5 h-5 text-indigo-600" />
              Inpatient Admission &amp; Bed Allotment
            </h3>

            <form onSubmit={handleAdmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Patient (MR No)</label>
                <select
                  value={admitData.patient_id}
                  onChange={(e) => setAdmitData({ ...admitData, patient_id: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.mr_no} - {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Room / Bed</label>
                  <select
                    value={admitData.room_id}
                    onChange={(e) => setAdmitData({ ...admitData, room_id: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number} ({r.ward_category} - ${Number(r.daily_rate).toFixed(0)}/day)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Attending Doctor</label>
                  <select
                    value={admitData.doctor_id}
                    onChange={(e) => setAdmitData({ ...admitData, doctor_id: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Admission Diagnosis *</label>
                <input
                  type="text"
                  required
                  value={admitData.diagnosis}
                  onChange={(e) => setAdmitData({ ...admitData, diagnosis: e.target.value })}
                  placeholder="e.g. Acute exacerbation of COPD, post-op monitoring"
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Inpatient Orders &amp; Rx</label>
                <textarea
                  rows={2}
                  value={admitData.inpatient_prescriptions}
                  onChange={(e) => setAdmitData({ ...admitData, inpatient_prescriptions: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdmitOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition"
                >
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Room Modal */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              Transfer Patient to Different Room
            </h3>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Select Target Available Room</label>
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number} - {r.ward_category} (${Number(r.daily_rate).toFixed(0)}/day)
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-slate-500">
                The current room will automatically be scheduled for <strong>Housekeeping Cleaning</strong>.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Profile Modal */}
      {selectedPatientModalId && (
        <PatientProfileModal
          patientId={selectedPatientModalId}
          onClose={() => setSelectedPatientModalId(null)}
          onUpdate={fetchRooms}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
