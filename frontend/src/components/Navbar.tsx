// frontend/src/components/Navbar.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, MessageSquare, Tv, UserPlus, LogIn, LogOut,
  Stethoscope, TestTube2, Bed, Receipt, CalendarCheck,
  Users, ShieldCheck, ClipboardList
} from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import WhatsAppSimulator from './WhatsAppSimulator';
import { registerPatient } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PermissionKey } from '@/lib/types';

interface NavbarProps {
  onRefresh?: () => void;
}

export default function Navbar({ onRefresh }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();

  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    gender: 'Male',
    dob: '1992-06-15',
    phone: '',
    email: '',
    blood_group: 'O+',
    address: '',
    emergency_contact: ''
  });
  const [registering, setRegistering] = useState(false);
  const [registeredResult, setRegisteredResult] = useState<any | null>(null);

  // Separate header tabs with privilege mapping
  const staffTabs: { href: string; label: string; icon: any; permission: PermissionKey }[] = [
    { href: '/', label: 'Reception', icon: ClipboardList, permission: 'reception' },
    { href: '/doctor', label: 'Doctor', icon: Stethoscope, permission: 'doctor' },
    { href: '/rooms', label: 'Admission', icon: Bed, permission: 'admission' },
    { href: '/lab', label: 'Lab', icon: TestTube2, permission: 'lab' },
    { href: '/hr', label: 'HR', icon: Users, permission: 'hr' },
    { href: '/billing', label: 'Billing', icon: Receipt, permission: 'billing' },
    { href: '/admin', label: 'Admin', icon: ShieldCheck, permission: 'admin' },
  ];

  const permittedTabs = staffTabs.filter((tab) => hasPermission(tab.permission));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name.trim() || !newPatient.phone.trim()) {
      alert('Patient name and phone are required');
      return;
    }
    setRegistering(true);
    try {
      const res = await registerPatient(newPatient);
      setRegisteredResult(res);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert('Registration error: ' + (err.message || err));
    } finally {
      setRegistering(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Hospital Logo + Name (Left), Global Search (Center), User/Actions (Right) */}
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Hospital Logo & Name on Top Left */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href={user ? (permittedTabs[0]?.href || '/book') : '/login'} className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    SEHAT <span className="text-blue-600 dark:text-blue-400">HOSPITAL</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block font-semibold tracking-wide uppercase">
                    Hospital Management System
                  </span>
                </div>
              </Link>
            </div>

            {/* Global MR No Search (Visible for logged-in staff) */}
            {user && (
              <div className="flex-1 max-w-md hidden md:block">
                <GlobalSearch />
              </div>
            )}

            {/* Right Actions & Auth Status */}
            <div className="flex items-center gap-2">
              {user && hasPermission('reception') && (
                <>
                  <button
                    onClick={() => setIsWhatsAppOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">WhatsApp</span>
                  </button>

                  <button
                    onClick={() => {
                      setRegisteredResult(null);
                      setIsRegisterOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">New Patient</span>
                  </button>
                </>
              )}

              {user ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                  <div className="hidden sm:block text-right leading-tight">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{user.full_name}</span>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">{user.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Logout / Switch User"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 hover:border-red-300 rounded-xl transition text-slate-700 dark:text-slate-300"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Staff Login
                </Link>
              )}
            </div>
          </div>

          {/* Separate Module Tabs Bar */}
          <nav className="flex items-center justify-between gap-2 py-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-medium overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5">
              {permittedTabs.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}

              {user && hasPermission('queue_display') && (
                <Link
                  href="/queue-display"
                  target="_blank"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                    pathname === '/queue-display'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 text-amber-500" />
                  TV Display
                </Link>
              )}
            </div>

            {/* Always-accessible Patient Portal Tab */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-200 dark:border-slate-800">
              <Link
                href="/book"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  pathname === '/book'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Patient Portal
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* WhatsApp Simulator Drawer */}
      <WhatsAppSimulator
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onSyncTriggered={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Register Patient Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Register New Patient (Auto MR No)
              </h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {registeredResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center font-bold text-2xl">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Patient Successfully Registered!</h4>
                    <p className="text-sm text-slate-500 mt-1">Generated Global Medical Record Number:</p>
                    <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 mt-2">
                      {registeredResult.mr_no}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsRegisterOpen(false);
                      setRegisteredResult(null);
                      if (onRefresh) onRefresh();
                    }}
                    className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                      placeholder="e.g. Zainab Malik"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Gender</label>
                      <select
                        value={newPatient.gender}
                        onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Blood Group</label>
                      <select
                        value={newPatient.blood_group}
                        onChange={(e) => setNewPatient({ ...newPatient, blood_group: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option>A+</option>
                        <option>A-</option>
                        <option>B+</option>
                        <option>B-</option>
                        <option>O+</option>
                        <option>O-</option>
                        <option>AB+</option>
                        <option>AB-</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Mobile Phone *</label>
                      <input
                        type="text"
                        required
                        value={newPatient.phone}
                        onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                        placeholder="+1-555-0999"
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Date of Birth</label>
                      <input
                        type="date"
                        value={newPatient.dob}
                        onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Address</label>
                    <input
                      type="text"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                      placeholder="City, District"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={registering}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {registering ? 'Generating MR Number...' : 'Complete Registration'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
