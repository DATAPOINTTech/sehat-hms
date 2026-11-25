// frontend/src/components/WhatsAppSimulator.tsx
'use client';

import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, Sparkles, X, Smartphone, ArrowRight } from 'lucide-react';
import { simulateWhatsAppMessage } from '@/lib/api';

interface WhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTriggered?: () => void;
}

export default function WhatsAppSimulator({ isOpen, onClose, onSyncTriggered }: WhatsAppSimulatorProps) {
  const [patientName, setPatientName] = useState('Tariq Mansoor');
  const [patientPhone, setPatientPhone] = useState('+1-555-0871');
  const [doctorId, setDoctorId] = useState<number>(1);
  const [message, setMessage] = useState('Hello Doctor, I have had high blood pressure and chest discomfort since morning. Can I get a consultation token today?');
  const [loading, setLoading] = useState(false);
  const [responseLog, setResponseLog] = useState<any | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      title: '🫀 Cardiology Booking',
      doctor_id: 1,
      name: 'Tariq Mansoor',
      phone: '+1-555-0871',
      msg: 'Need urgent appointment with Dr. Sarah Jenkins for chest heaviness and palpitations.'
    },
    {
      title: '👶 Pediatrics / Child Fever',
      doctor_id: 3,
      name: 'Amina Begum (Mother)',
      phone: '+1-555-0632',
      msg: 'Booking for my 4yo daughter who has high fever and cough for 2 days.'
    },
    {
      title: '🩺 General Medicine Follow-up',
      doctor_id: 2,
      name: 'Kamran Siddiqui',
      phone: '+1-555-0455',
      msg: 'Need consultation token for routine fasting blood sugar and diabetes check.'
    }
  ];

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim() || !message.trim()) return;

    setLoading(true);
    try {
      const res = await simulateWhatsAppMessage({
        patient_name: patientName,
        patient_phone: patientPhone,
        doctor_id: doctorId,
        message: message,
      });
      setResponseLog(res);
      if (onSyncTriggered) onSyncTriggered();
    } catch (err: any) {
      alert('Simulation error: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                WhatsApp Webhook Simulator
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-white/20 rounded-full">
                  Meta / Twilio API Mock
                </span>
              </h3>
              <p className="text-xs text-emerald-100">
                Simulates real-time incoming patient messages &amp; auto-enqueues into QMS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Preset Buttons */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">
              Quick Test Scenarios
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPatientName(preset.name);
                    setPatientPhone(preset.phone);
                    setDoctorId(preset.doctor_id);
                    setMessage(preset.msg);
                  }}
                  className="p-2.5 text-left border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition text-xs group"
                >
                  <p className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {preset.title}
                  </p>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Patient Name
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  WhatsApp Phone Number
                </label>
                <input
                  type="text"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Doctor / Department
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              >
                <option value={1}>Dr. Sarah Jenkins - Cardiology (Room 101)</option>
                <option value={2}>Dr. Farhan Ahmed - General Medicine (Room 102)</option>
                <option value={3}>Dr. Priya Patel - Pediatrics &amp; Pulmonology (Room 103)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Incoming WhatsApp Chat Message
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Posting to /api/webhooks/whatsapp...' : 'Dispatch Simulated WhatsApp Message'}
            </button>
          </form>

          {/* Simulated WhatsApp Phone Screen Response */}
          {responseLog && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Webhook Success &amp; Live Synchronization Confirmed!
              </div>

              {/* Chat bubble simulation */}
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 text-xs font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {responseLog.whatsapp_reply}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Created:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded font-mono font-bold">
                  MR No: {responseLog.mr_no}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded font-mono font-bold">
                  Token: #{responseLog.token_number}
                </span>
                <span className="text-slate-500">
                  (Visible now in Doctor Console &amp; Receptionist Queue)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
