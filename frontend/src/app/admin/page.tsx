// frontend/src/app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, UserPlus, CheckCircle2, Save, RefreshCw,
  Stethoscope, Receipt, Wrench, Users, Plus
} from 'lucide-react';
import PermissionGuard from '@/components/PermissionGuard';
import BillingCorrectionModal from '@/components/BillingCorrectionModal';
import {
  getAdminUsers, createAdminUser, updateUserPermissions,
  getDoctors, addDoctor, updateDoctor, getBillingOverview
} from '@/lib/api';
import { StaffUser, PermissionKey, Doctor, Invoice } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

export default function AdminAccessPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [adminTab, setAdminTab] = useState<'staff' | 'doctors' | 'billing'>('staff');

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [availablePerms, setAvailablePerms] = useState<{ key: PermissionKey; label: string }[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Add Staff Modal
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: 'password123',
    full_name: '',
    role: 'Staff',
    department: 'General OPD',
    email: '',
    phone: '',
    shift: 'Morning (08:00 - 16:00)',
    salary: 3500,
    permissions: ['reception'] as PermissionKey[],
  });

  // Add Doctor Modal
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    name: '',
    specialty: '',
    consultation_fee: 65,
    room_no: 'Room 104',
    create_login: true,
    username: '',
    password: 'password123',
    email: '',
    phone: '',
    salary: 12000,
  });

  // Edit Doctor Modal
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);

  // Billing Correction Modal
  const [correctingInvoice, setCorrectingInvoice] = useState<Invoice | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAllAdminData = async () => {
    try {
      const [uRes, dRes, bRes] = await Promise.all([
        getAdminUsers(),
        getDoctors(),
        getBillingOverview(),
      ]);
      setUsers(uRes.users || []);
      setAvailablePerms(uRes.available_permissions || []);
      setDoctors(dRes.doctors || []);
      setInvoices(bRes.invoices || []);
    } catch (e) {
      console.error('Error loading admin data:', e);
    }
  };

  useEffect(() => {
    fetchAllAdminData().finally(() => setLoading(false));
  }, []);

  const togglePermission = (userId: number, permKey: PermissionKey) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const exists = u.permissions.includes(permKey);
        const updated = exists
          ? u.permissions.filter((p) => p !== permKey)
          : [...u.permissions, permKey];
        return { ...u, permissions: updated };
      })
    );
  };

  const toggleStatus = (userId: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' } : u
      )
    );
  };

  const handleSaveUser = async (targetUser: StaffUser) => {
    setSavingUserId(targetUser.id);
    try {
      await updateUserPermissions({
        user_id: targetUser.id,
        permissions: targetUser.permissions,
        role: targetUser.role,
        status: targetUser.status,
      });
      if (currentUser && currentUser.id === targetUser.id) {
        await refreshUser();
      }
      showToast(`Saved privileges for ${targetUser.full_name} (@${targetUser.username})`);
    } catch (err: any) {
      alert('Failed to update privileges: ' + (err.message || err));
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminUser(newUser);
      setIsAddStaffOpen(false);
      setNewUser({
        username: '',
        password: 'password123',
        full_name: '',
        role: 'Staff',
        department: 'General OPD',
        email: '',
        phone: '',
        shift: 'Morning (08:00 - 16:00)',
        salary: 3500,
        permissions: ['reception'],
      });
      fetchAllAdminData();
      showToast('New staff member created with assigned permissions.');
    } catch (err: any) {
      alert('Error creating user: ' + (err.message || err));
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoctor({
        name: newDoc.name,
        specialty: newDoc.specialty,
        consultation_fee: Number(newDoc.consultation_fee),
        room_no: newDoc.room_no,
        username: newDoc.create_login ? newDoc.username : undefined,
        password: newDoc.create_login ? newDoc.password : undefined,
        email: newDoc.email,
        phone: newDoc.phone,
        salary: Number(newDoc.salary),
      });
      setIsAddDoctorOpen(false);
      setNewDoc({
        name: '',
        specialty: '',
        consultation_fee: 65,
        room_no: 'Room 104',
        create_login: true,
        username: '',
        password: 'password123',
        email: '',
        phone: '',
        salary: 12000,
      });
      fetchAllAdminData();
      showToast('New doctor added to clinical directory and appointment booking.');
    } catch (err: any) {
      alert('Error adding doctor: ' + (err.message || err));
    }
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    try {
      await updateDoctor({
        id: editingDoc.id,
        name: editingDoc.name,
        specialty: editingDoc.specialty,
        consultation_fee: Number(editingDoc.consultation_fee),
        room_no: editingDoc.room_no,
        status: editingDoc.status,
      });
      setEditingDoc(null);
      fetchAllAdminData();
      showToast('Doctor profile updated.');
    } catch (err: any) {
      alert('Error updating doctor: ' + (err.message || err));
    }
  };

  return (
    <PermissionGuard permission="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Admin Control Center</h1>
              <p className="text-xs text-slate-500">
                Add Doctors &amp; Staff, manage tab privileges, and perform billing corrections.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setIsAddDoctorOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Stethoscope className="w-4 h-4" />
              Add Doctor
            </button>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff
            </button>
            <button
              onClick={fetchAllAdminData}
              className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setAdminTab('staff')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              adminTab === 'staff'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            All Staff &amp; Privileges ({users.length})
          </button>
          <button
            onClick={() => setAdminTab('doctors')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              adminTab === 'doctors'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Doctors Directory ({doctors.length})
          </button>
          <button
            onClick={() => setAdminTab('billing')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              adminTab === 'billing'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Billing Corrections ({invoices.length})
          </button>
        </div>

        {toast && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {toast}
          </div>
        )}

        {/* TAB 1: Staff & Privileges */}
        {adminTab === 'staff' && (
          <div className="space-y-4">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading staff privilege matrix...</div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                        {u.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white">{u.full_name}</h3>
                          <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                            @{u.username}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold rounded">
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Department: {u.department || 'General'} • Shift: {u.shift || 'Day'} • Salary: ${Number(u.salary || 0).toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStatus(u.id)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                          u.status === 'Active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                        }`}
                      >
                        {u.status}
                      </button>

                      <button
                        type="button"
                        disabled={savingUserId === u.id}
                        onClick={() => handleSaveUser(u)}
                        className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingUserId === u.id ? 'Saving...' : 'Save Privileges'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Granted Module Privileges
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {availablePerms.map((perm) => {
                        const checked = u.permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                              checked
                                ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(u.id, perm.key)}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                            <span className="truncate">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Doctors Directory */}
        {adminTab === 'doctors' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">{doc.name}</h3>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">{doc.specialty}</p>
                    </div>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {doc.status}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    <p>Consultation Room: <strong>{doc.room_no}</strong></p>
                    <p>Consultation Fee: <strong className="font-mono">${Number(doc.consultation_fee).toFixed(2)}</strong></p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingDoc(doc)}
                  className="w-full py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Edit Doctor Profile / Fee
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Billing Corrections */}
        {adminTab === 'billing' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{inv.invoice_no}</span>
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">{inv.mr_no}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      inv.payment_status === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inv.payment_status === 'Partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {inv.payment_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {inv.patient_name} • Subtotal: ${Number(inv.subtotal).toFixed(2)} | Discount: ${Number(inv.discount).toFixed(2)} | Tax: ${Number(inv.tax).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="font-mono font-black text-base text-slate-900 dark:text-white block">
                      ${Number(inv.total_amount).toFixed(2)}
                    </span>
                    <span className="text-slate-400">Paid: ${Number(inv.paid_amount).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => setCorrectingInvoice(inv)}
                    className="px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Correct Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Staff Modal */}
        {isAddStaffOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Staff Member &amp; Privileges</h3>
                <button onClick={() => setIsAddStaffOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      placeholder="e.g. Nadia Hussain"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Username *</label>
                    <input
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="e.g. nadia_rn"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium">Password</label>
                    <input
                      type="text"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option>Receptionist</option>
                      <option>Staff Nurse</option>
                      <option>Ward Manager</option>
                      <option>Lab Tech</option>
                      <option>HR</option>
                      <option>Billing</option>
                      <option>Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Department</label>
                    <input
                      type="text"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Shift</label>
                    <select
                      value={newUser.shift}
                      onChange={(e) => setNewUser({ ...newUser, shift: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option>Morning (08:00 - 16:00)</option>
                      <option>Evening (16:00 - 00:00)</option>
                      <option>Night (00:00 - 08:00)</option>
                      <option>Day (09:00 - 17:00)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Monthly Salary ($)</label>
                    <input
                      type="number"
                      value={newUser.salary}
                      onChange={(e) => setNewUser({ ...newUser, salary: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Select Privileges
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePerms.map((p) => {
                      const checked = newUser.permissions.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-center gap-2 text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? newUser.permissions.filter((k) => k !== p.key)
                                : [...newUser.permissions, p.key];
                              setNewUser({ ...newUser, permissions: next });
                            }}
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddStaffOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-500">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow">
                    Create Staff
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Doctor Modal */}
        {isAddDoctorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-purple-600" />
                  Add New Doctor
                </h3>
                <button onClick={() => setIsAddDoctorOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateDoctor} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Doctor Name *</label>
                    <input
                      type="text"
                      required
                      value={newDoc.name}
                      onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                      placeholder="Dr. Imran Qureshi"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Specialty *</label>
                    <input
                      type="text"
                      required
                      value={newDoc.specialty}
                      onChange={(e) => setNewDoc({ ...newDoc, specialty: e.target.value })}
                      placeholder="Neurology / Orthopedics"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium">Consultation Fee ($)</label>
                    <input
                      type="number"
                      required
                      value={newDoc.consultation_fee}
                      onChange={(e) => setNewDoc({ ...newDoc, consultation_fee: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Room No</label>
                    <input
                      type="text"
                      required
                      value={newDoc.room_no}
                      onChange={(e) => setNewDoc({ ...newDoc, room_no: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Salary ($)</label>
                    <input
                      type="number"
                      value={newDoc.salary}
                      onChange={(e) => setNewDoc({ ...newDoc, salary: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDoc.create_login}
                      onChange={(e) => setNewDoc({ ...newDoc, create_login: e.target.checked })}
                    />
                    Also create Doctor Console login account
                  </label>

                  {newDoc.create_login && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium">Username *</label>
                        <input
                          type="text"
                          required
                          value={newDoc.username}
                          onChange={(e) => setNewDoc({ ...newDoc, username: e.target.value })}
                          placeholder="dr_qureshi"
                          className="w-full mt-1 px-3 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Password</label>
                        <input
                          type="text"
                          value={newDoc.password}
                          onChange={(e) => setNewDoc({ ...newDoc, password: e.target.value })}
                          className="w-full mt-1 px-3 py-1.5 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddDoctorOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-500">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow">
                    Save Doctor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Doctor Modal */}
        {editingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Doctor: {editingDoc.name}</h3>
              <form onSubmit={handleUpdateDoctor} className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Specialty</label>
                  <input
                    type="text"
                    value={editingDoc.specialty}
                    onChange={(e) => setEditingDoc({ ...editingDoc, specialty: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Consultation Fee ($)</label>
                    <input
                      type="number"
                      value={editingDoc.consultation_fee}
                      onChange={(e) => setEditingDoc({ ...editingDoc, consultation_fee: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Room No</label>
                    <input
                      type="text"
                      value={editingDoc.room_no}
                      onChange={(e) => setEditingDoc({ ...editingDoc, room_no: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Status</label>
                  <select
                    value={editingDoc.status}
                    onChange={(e) => setEditingDoc({ ...editingDoc, status: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option>Available</option>
                    <option>On Leave</option>
                    <option>In Surgery</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingDoc(null)} className="px-4 py-2 text-xs text-slate-500">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-purple-600 text-white rounded-xl">Update Doctor</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Billing Correction Modal */}
        {correctingInvoice && (
          <BillingCorrectionModal
            invoice={correctingInvoice}
            onClose={() => setCorrectingInvoice(null)}
            onCorrected={() => {
              fetchAllAdminData();
              showToast(`Invoice ${correctingInvoice.invoice_no} updated.`);
            }}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
