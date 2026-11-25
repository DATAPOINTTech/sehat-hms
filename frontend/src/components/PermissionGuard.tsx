// frontend/src/components/PermissionGuard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PermissionKey } from '@/lib/types';

interface PermissionGuardProps {
  permission: PermissionKey;
  children: React.ReactNode;
}

const PERMISSION_ROUTES: { key: PermissionKey; label: string; href: string }[] = [
  { key: 'reception', label: 'Reception', href: '/' },
  { key: 'doctor', label: 'Doctor', href: '/doctor' },
  { key: 'admission', label: 'Admission', href: '/rooms' },
  { key: 'lab', label: 'Lab', href: '/lab' },
  { key: 'hr', label: 'HR', href: '/hr' },
  { key: 'billing', label: 'Billing', href: '/billing' },
  { key: 'admin', label: 'Admin', href: '/admin' },
];

export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-400">
        Verifying user privileges...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Staff Authentication Required</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            SEHAT Hospital uses privilege-based access control. Sign in with your staff account, or use the Patient Portal for online appointment booking.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <LogIn className="w-4 h-4" />
            Staff Login
          </Link>
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            Patient Portal &amp; Booking
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    const allowedLinks = PERMISSION_ROUTES.filter((r) => user.permissions.includes(r.key));
    return (
      <div className="max-w-lg mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 shadow-lg text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Your account (<strong>{user.full_name}</strong> — {user.role}) does not have the{' '}
            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-red-600">{permission}</code>{' '}
            privilege. Please contact the <strong>Admin</strong> user to grant access.
          </p>
        </div>

        {allowedLinks.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Your Permitted Tabs</p>
            <div className="flex flex-wrap justify-center gap-2">
              {allowedLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
                >
                  Go to {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
