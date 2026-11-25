// frontend/src/app/lab/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  TestTube2, Cloud, UploadCloud, Download, CheckCircle2,
  FileText, Clock, AlertCircle, RefreshCw, FileUp
} from 'lucide-react';
import { getLabOrders, fulfillLabOrder, uploadLabPdf } from '@/lib/api';
import { LabOrder } from '@/lib/types';
import PatientProfileModal from '@/components/PatientProfileModal';
import PermissionGuard from '@/components/PermissionGuard';

export default function LabManagementPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ storage_type: string; is_r2_configured: boolean }>({
    storage_type: 'Local Storage Fallback',
    is_r2_configured: false,
  });
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultValue, setResultValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fulfilling, setFulfilling] = useState(false);
  const [selectedPatientModalId, setSelectedPatientModalId] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await getLabOrders();
      setOrders(res.orders || []);
      if (res.storage_info) setStorageInfo(res.storage_info);
    } catch (err) {
      console.error('Fetch lab orders error:', err);
    }
  };

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenFulfill = (order: LabOrder) => {
    setSelectedOrder(order);
    setResultValue(order.result_value || '');
    setRemarks(order.remarks || 'Reviewed and authorized by Pathologist');
    setFileToUpload(null);
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setFulfilling(true);
    try {
      // 1. Digital Result entry + Demo PDF generation in Cloudflare R2
      await fulfillLabOrder({
        order_id: selectedOrder.id,
        result_value: resultValue,
        remarks: remarks,
        generate_demo_pdf: true,
      });

      // 2. If a custom PDF file was chosen, upload it
      if (fileToUpload) {
        await uploadLabPdf(selectedOrder.id, fileToUpload);
      }

      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      alert('Lab fulfillment error: ' + (err.message || err));
    } finally {
      setFulfilling(false);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'Pending');
  const completedOrders = orders.filter((o) => o.status === 'Completed');

  return (
    <PermissionGuard permission="lab">
    <div className="space-y-6">
      {/* Top Banner with Cloudflare R2 Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-md">
            <TestTube2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Laboratory Diagnostic Desk</h1>
            <p className="text-xs text-slate-500">
              Fulfill diagnostic test orders and upload PDF reports directly to <strong>Cloudflare R2</strong>.
            </p>
          </div>
        </div>

        {/* Cloudflare R2 Storage Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-xs flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-bold text-blue-900 dark:text-blue-200 block">
                {storageInfo.storage_type}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">
                {storageInfo.is_r2_configured ? 'S3-Compatible Cloud Active' : 'Zero-config local fallback ready'}
              </span>
            </div>
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Tabs / Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Pending Fulfillment</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingOrders.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Completed Reports</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedOrders.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 md:col-span-1">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Lab Tests</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{orders.length}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">Active Test Orders</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading Laboratory Queue...</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No lab orders recorded.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {orders.map((o) => (
              <div
                key={o.id}
                className="p-4 sm:px-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-white">{o.test_name}</span>
                    <button
                      onClick={() => setSelectedPatientModalId(o.patient_id)}
                      className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                    >
                      {o.mr_no}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      o.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {o.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    Patient: <strong className="text-slate-700 dark:text-slate-300">{o.patient_name}</strong> |
                    Doctor: {o.doctor_name || 'OPD Desk'} | Fee: ${Number(o.fee).toFixed(2)} | Ordered: {o.created_at}
                  </p>

                  {o.result_value && (
                    <div className="mt-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                      <strong>Result:</strong> {o.result_value} {o.unit} (Ref: {o.normal_range})
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-start md:self-center">
                  {o.status !== 'Completed' ? (
                    <button
                      onClick={() => handleOpenFulfill(o)}
                      className="px-3.5 py-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Fulfill &amp; Upload PDF
                    </button>
                  ) : (
                    <>
                      {o.report_file_url && (
                        <a
                          href={o.report_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          View R2 PDF
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenFulfill(o)}
                        className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300"
                      >
                        Update
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fulfill Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Fulfill Lab Report: {selectedOrder.test_name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Patient: {selectedOrder.patient_name} ({selectedOrder.mr_no})
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleFulfillSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Quantitative / Qualitative Result *
                </label>
                <input
                  type="text"
                  required
                  value={resultValue}
                  onChange={(e) => setResultValue(e.target.value)}
                  placeholder={`e.g. 5.4 ${selectedOrder.unit || ''} (Normal: ${selectedOrder.normal_range || 'Normal'})`}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Technician / Pathologist Remarks
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Verified by Clinical Biochemist. Normal parameters observed."
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* PDF Upload option */}
              <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileUp className="w-4 h-4 text-cyan-600" />
                  Cloudflare R2 Report Document (Optional PDF Upload)
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                />
                <p className="text-[11px] text-slate-400">
                  If no PDF is uploaded, a synthesized official Lab Report PDF will be automatically generated and saved to Cloudflare R2!
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fulfilling}
                  className="px-4 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {fulfilling ? 'Saving & Uploading to R2...' : 'Complete & Save to R2'}
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
          onUpdate={fetchOrders}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
