// frontend/src/components/CountdownTimer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Clock, FastForward, AlertTriangle } from 'lucide-react';
import { fastForward10Min } from '@/lib/api';

interface CountdownTimerProps {
  calledAt: string;
  tokenId: number;
  doctorName?: string;
  onAutoShift?: () => void;
}

export default function CountdownTimer({ calledAt, tokenId, doctorName, onAutoShift }: CountdownTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isFastForwarding, setIsFastForwarding] = useState<boolean>(false);

  useEffect(() => {
    function calculateRemaining() {
      if (!calledAt) return 600;
      const calledTime = new Date(calledAt.replace(' ', 'T')).getTime();
      const now = new Date().getTime();
      const elapsed = Math.floor((now - calledTime) / 1000);
      const remaining = Math.max(0, 600 - elapsed);
      return remaining;
    }

    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        if (onAutoShift) onAutoShift();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calledAt, onAutoShift]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = secondsRemaining < 120; // less than 2 mins

  const handleFastForward = async () => {
    try {
      setIsFastForwarding(true);
      await fastForward10Min();
      if (onAutoShift) onAutoShift();
    } catch (err) {
      console.error('Fast forward error:', err);
    } finally {
      setIsFastForwarding(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border text-sm font-medium ${
      isUrgent
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse'
        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
    }`}>
      <Clock className="w-4 h-4 animate-spin text-inherit" style={{ animationDuration: '8s' }} />
      <span>Auto-Shift: <strong className="font-mono text-base">{formattedTime}</strong></span>
      
      <button
        onClick={handleFastForward}
        disabled={isFastForwarding}
        title="Demo: Fast-Forward 10 minutes to test auto-skip & next patient call"
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded shadow-sm transition-transform active:scale-95 disabled:opacity-50"
      >
        <FastForward className="w-3 h-3" />
        {isFastForwarding ? 'Shifting...' : 'Fast-Forward 10m'}
      </button>
    </div>
  );
}
