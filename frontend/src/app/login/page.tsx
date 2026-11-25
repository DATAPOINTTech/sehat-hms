// frontend/src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ShieldCheck, UserCheck, CalendarCheck, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PermissionKey } from '@/lib/types';

const PERM_DEFAULT_ROUTE: Record<PermissionKey, string> = {
  reception: '/',
  doctor: '/doctor',
  admission: '/rooms',
  lab: '/lab',
  hr: '/hr',
  billing: '/billing',
  admin: '/admin',
  queue_display: '/queue-display',
};

const DEMO_ACCOUNTS = [
  { username: 'admin', label: 'System Admin', role: 'Full Access (All Tabs)', color: 'bg-indigo-600' },
  { username: 'reception', label: 'Aisha Raza', role: 'Reception & Admission', color: 'bg-blue-600' },
  { username: 'dr_jenkins', label: 'Dr. Sarah Jenkins', role: 'Doctor, Lab & Admission', color: 'bg-purple-600' },
  { username: 'lab_tech', label: 'Bilal Tariq', role: 'Lab & R2 Reports Only', color: 'bg-cyan-600' },
  { username: 'hr_manager', label: 'Sanaullah Khan', role: 'HR Management Only', color: 'bg-amber-600' },
  { username: 'billing', label: 'Omar Farooq', role: 'Billing & Reception', color: 'bg-emerald-600' },
];

export default function StaffLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (user: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await login(user, pass);
      const firstPerm = loggedUser.permissions[0];
      const target = firstPerm ? PERM_DEFAULT_ROUTE[firstPerm] || '/' : '/';
      router.push(target);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left: Login Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Staff Portal Sign In</h1>
            <p className="text-xs text-slate-500">Privilege-based access to SEHAT Hospital modules</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin, reception, dr_jenkins"
              className="w-full mt-1 px-3.5 py-2.5 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Default demo password: password123"
              className="w-full mt-1 px-3.5 py-2.5 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 mb-2">Are you a patient looking to book an appointment?</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-xl transition"
          >
            <CalendarCheck className="w-4 h-4" />
            Go to Patient Portal &amp; Free Slots &rarr;
          </Link>
        </div>
      </div>

      {/* Right: 1-Click Quick Demo Accounts */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Quick-Demo User Switcher</h2>
        </div>
        <p className="text-xs text-slate-500">
          Click any staff account below (password: <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">password123</code>) to preview how header tabs and module access adapt to each user&apos;s privileges.
        </p>

        <div className="space-y-2.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.username}
              type="button"
              disabled={loading}
              onClick={() => performLogin(acc.username, 'password123')}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800 transition flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${acc.color} text-white flex items-center justify-center font-bold text-xs shadow-sm`}>
                  {acc.label.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600">
                      {acc.label}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                      @{acc.username}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{acc.role}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 opacity-70 group-hover:opacity-100">
                Sign In &rarr;
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
