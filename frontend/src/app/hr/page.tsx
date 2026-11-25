// frontend/src/app/hr/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Clock, DollarSign, CheckCircle2, RefreshCw, Briefcase
} from 'lucide-react';
import PermissionGuard from '@/components/PermissionGuard';
import { getHrStaff, addHrStaff, updateHrStaff } from '@/lib/api';
import { StaffUser } from '@/lib/types';

export default function HrPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState({ total_staff: 0, active_staff: 0, monthly_payroll: 0 });
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  const [newEmp, setNewEmp] = useState({
    full_name: '',
    username: '',
    role: 'Staff Nurse',
    department: 'ICU & Critical Care',
    phone: '+1-555-0190',
    email: '',
    shift: 'Morning (08:00 - 16:00)',
    salary: 3800,
  });

  const fetchStaff = async () => {
    try {
      const res = await getHrStaff();
      setStaff(res.staff || []);
      if (res.stats) setStats(res.stats);
    } catch (e) {
      console.error('Error fetching HR staff:', e);
    }
  };

  useEffect(() => {
    fetchStaff().finally(() => setLoading(false));
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addHrStaff(newEmp);
      setIsAddOpen(false);
      setNewEmp({
        full_name: '',
        username: '',
        role: 'Staff Nurse',
        department: 'ICU & Critical Care',
        phone: '+1-555-0190',
        email: '',
        shift: 'Morning (08:00 - 16:00)',
        salary: 3800,
      });
      fetchStaff();
    } catch (err: any) {
      alert('Failed to onboard employee: ' + (err.message || err));
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await updateHrStaff({
        user_id: editingStaff.id,
        department: editingStaff.department,
        shift: editingStaff.shift,
        salary: Number(editingStaff.salary || 0),
        status: editingStaff.status,
      });
      setEditingStaff(null);
      fetchStaff();
    } catch (err: any) {
      alert('Failed to update employee: ' + (err.message || err));
    }
  };

  return (
    <PermissionGuard permission="hr">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Human Resources (HR) &amp; Shift Roster</h1>
              <p className="text-xs text-slate-500">
                Manage hospital staff directory, duty shifts, leave status, and monthly payroll.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Onboard Employee
            </button>
            <button
              onClick={fetchStaff}
              className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* HR KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Hospital Staff</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total_staff}</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active On-Duty</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active_staff}</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Monthly Payroll</span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              ${Number(stats.monthly_payroll).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-base text-slate-900 dark:text-white">Employee Directory &amp; Shifts</h2>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Loading HR directory...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Role &amp; Department</th>
                    <th className="px-6 py-3">Duty Shift</th>
                    <th className="px-6 py-3">Monthly Salary</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {staff.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{emp.full_name}</div>
                        <div className="text-slate-400 font-mono">@{emp.username} • {emp.phone || emp.email}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">{emp.role}</span>
                        <span className="text-slate-500">{emp.department}</span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {emp.shift || 'Morning (08:00 - 16:00)'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(emp.salary || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          emp.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setEditingStaff(emp)}
                          className="px-3 py-1 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                          Manage Shift
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Onboard Employee Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Onboard New Hospital Employee</h3>
              <form onSubmit={handleAddEmployee} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newEmp.full_name}
                      onChange={(e) => setNewEmp({ ...newEmp, full_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Username *</label>
                    <input
                      type="text"
                      required
                      value={newEmp.username}
                      onChange={(e) => setNewEmp({ ...newEmp, username: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Role</label>
                    <input
                      type="text"
                      value={newEmp.role}
                      onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Department</label>
                    <input
                      type="text"
                      value={newEmp.department}
                      onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Shift</label>
                    <select
                      value={newEmp.shift}
                      onChange={(e) => setNewEmp({ ...newEmp, shift: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
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
                      value={newEmp.salary}
                      onChange={(e) => setNewEmp({ ...newEmp, salary: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-xs text-slate-500">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-xl">Onboard</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Shift / Payroll Modal */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Manage HR Record: {editingStaff.full_name}
              </h3>
              <form onSubmit={handleUpdateEmployee} className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Department</label>
                  <input
                    type="text"
                    value={editingStaff.department || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Shift Schedule</label>
                  <select
                    value={editingStaff.shift || 'Morning (08:00 - 16:00)'}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shift: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option>Morning (08:00 - 16:00)</option>
                    <option>Evening (16:00 - 00:00)</option>
                    <option>Night (00:00 - 08:00)</option>
                    <option>Day (09:00 - 17:00)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Salary ($)</label>
                    <input
                      type="number"
                      value={editingStaff.salary || 0}
                      onChange={(e) => setEditingStaff({ ...editingStaff, salary: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Duty Status</label>
                    <select
                      value={editingStaff.status}
                      onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option>Active</option>
                      <option>On Leave</option>
                      <option>Suspended</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingStaff(null)} className="px-4 py-2 text-xs text-slate-500">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-amber-600 text-white rounded-xl">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
