// frontend/src/app/queue-display/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Clock, Activity, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { getQueue, getDoctors } from '@/lib/api';
import { QueueToken, Doctor } from '@/lib/types';
import CountdownTimer from '@/components/CountdownTimer';

export default function QueueDisplayPage() {
  const [queue, setQueue] = useState<QueueToken[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  const fetchDisplay = async () => {
    try {
      const [qRes, dRes] = await Promise.all([getQueue(), getDoctors()]);
      setQueue(qRes.queue || []);
      setDoctors(dRes.doctors || []);
    } catch (e) {
      console.error('Queue display fetch error:', e);
    }
  };

  useEffect(() => {
    fetchDisplay();
    const interval = setInterval(fetchDisplay, 4000);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col p-6 z-50 overflow-hidden select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg">
            <Activity className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              SEHAT HOSPITAL <span className="text-xs px-2.5 py-0.5 bg-blue-500/30 text-blue-300 rounded font-mono font-bold">OPD WAITING ROOM TV</span>
            </h1>
            <p className="text-xs text-slate-400">Live Doctor Queues &amp; Turn Indicators</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-500 block font-semibold">Standard Wall Clock</span>
            <span className="font-mono text-xl font-bold text-cyan-400">{currentTime || 'Live'}</span>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
        </div>
      </header>

      {/* Main Doctor Queue Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {doctors.map((doc) => {
          const docQueue = queue.filter((t) => t.doctor_id === doc.id);
          const currentCalled = docQueue.find((t) => t.status === 'Called');
          const currentInConsult = docQueue.find((t) => t.status === 'In Consultation');
          const activeTurn = currentInConsult || currentCalled;
          const nextWaiting = docQueue.filter((t) => t.status === 'Waiting');

          return (
            <div
              key={doc.id}
              className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur p-6 flex flex-col justify-between shadow-2xl"
            >
              <div>
                {/* Doctor Header */}
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white">{doc.name}</h2>
                    <span className="px-3 py-1 bg-blue-900/60 text-blue-300 font-mono font-bold text-xs rounded-xl border border-blue-700">
                      {doc.room_no}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{doc.specialty}</p>
                </div>

                {/* Now Serving Big Box */}
                <div className="my-6 p-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 text-center space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs uppercase font-bold tracking-widest text-emerald-400">
                      NOW CALLING / SERVING
                    </span>
                  </div>

                  {activeTurn ? (
                    <div className="space-y-2">
                      <div className="text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
                        #{activeTurn.token_number}
                      </div>
                      <div className="text-base font-bold text-cyan-300">
                        {activeTurn.patient_name}
                      </div>
                      <div className="font-mono text-xs text-slate-400">
                        MR: {activeTurn.mr_no}
                      </div>

                      {activeTurn.status === 'Called' && activeTurn.called_at && (
                        <div className="pt-2">
                          <CountdownTimer
                            calledAt={activeTurn.called_at}
                            tokenId={activeTurn.id}
                            onAutoShift={fetchDisplay}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-slate-500 text-sm italic">
                      Doctor Ready • Next Patient Summoning
                    </div>
                  )}
                </div>

                {/* Up Next in Queue */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Upcoming Turns ({nextWaiting.length})
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {nextWaiting.slice(0, 4).map((t, idx) => (
                      <div
                        key={t.id}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-sm">#{t.token_number}</span>
                          <span className="font-medium text-slate-200">{t.patient_name}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{t.mr_no}</span>
                      </div>
                    ))}
                    {nextWaiting.length === 0 && (
                      <p className="text-xs text-slate-600 italic py-2 text-center">No additional patients waiting</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Room Directive */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-center text-xs text-slate-400">
                Please proceed directly to <strong>{doc.room_no}</strong> when your token is called.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
