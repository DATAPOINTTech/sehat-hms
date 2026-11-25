// frontend/src/app/billing/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt, DollarSign, CreditCard, Printer, CheckCircle2,
  Clock, AlertCircle, RefreshCw, X, Wrench
} from 'lucide-react';
import { getBillingOverview, recordPayment } from '@/lib/api';
import { Invoice } from '@/lib/types';
import PatientProfileModal from '@/components/PatientProfileModal';
import BillingCorrectionModal from '@/components/BillingCorrectionModal';
import PermissionGuard from '@/components/PermissionGuard';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState({ total_revenue: 0, total_collected: 0, total_pending: 0 });
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [correctingInvoice, setCorrectingInvoice] = useState<Invoice | null>(null);
  const [selectedPatientModalId, setSelectedPatientModalId] = useState<number | null>(null);

  const fetchBilling = async () => {
    try {
      const res = await getBillingOverview();
      setInvoices(res.invoices || []);
      if (res.stats) setStats(res.stats);
    } catch (e) {
      console.error('Error fetching billing:', e);
    }
  };

  useEffect(() => {
    fetchBilling().finally(() => setLoading(false));
    const interval = setInterval(fetchBilling, 6000);
    return () => clearInterval(interval);
  }, []);

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await recordPayment({
        invoice_id: payingInvoice.id,
        amount: amt,
        payment_method: paymentMethod,
      });
      setPayingInvoice(null);
      setPaymentAmount('');
      fetchBilling();
    } catch (err: any) {
      alert('Payment recording failed: ' + (err.message || err));
    }
  };

  return (
    <PermissionGuard permission="billing">
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Unified Billing &amp; Revenue Ledger</h1>
            <p className="text-xs text-slate-500">
              Aggregated charges under patient MR No (Doctor Consultations, Room Tariffs, Lab Tests) with itemized receipts.
            </p>
          </div>
        </div>

        <button
          onClick={fetchBilling}
          className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 self-start sm:self-center"
          title="Refresh Ledger"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Invoiced Volume</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ${stats.total_revenue.toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Cash Collected</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ${stats.total_collected.toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Outstanding Receivables</span>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            ${stats.total_pending.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">All Itemized Invoices</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading Billing Ledger...</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No invoices recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {invoices.map((inv) => {
              const due = Number(inv.total_amount) - Number(inv.paid_amount);
              return (
                <div
                  key={inv.id}
                  className="p-4 sm:px-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                        {inv.invoice_no}
                      </span>
                      <button
                        onClick={() => setSelectedPatientModalId(inv.patient_id)}
                        className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                      >
                        {inv.mr_no}
                      </button>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        inv.payment_status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : inv.payment_status === 'Partial'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Patient: <strong className="text-slate-700 dark:text-slate-300">{inv.patient_name}</strong> ({inv.patient_phone}) • Date: {inv.created_at}
                    </p>

                    {/* Breakdown badge chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {inv.items?.map((it, idx) => (
                        <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {it.item_description}: ${Number(it.total_price).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Amounts & Action buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 self-start md:self-center">
                    <div className="text-right sm:pr-2">
                      <p className="text-xs text-slate-400">Total Billed</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        ${Number(inv.total_amount).toFixed(2)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Paid: ${Number(inv.paid_amount).toFixed(2)}
                        {due > 0 && <span className="text-red-500 font-bold ml-1">(Due: ${due.toFixed(2)})</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {inv.payment_status !== 'Paid' && (
                        <button
                          onClick={() => {
                            setPayingInvoice(inv);
                            setPaymentAmount(due.toFixed(2));
                          }}
                          className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition active:scale-95"
                        >
                          Collect Payment
                        </button>
                      )}

                      <button
                        onClick={() => setCorrectingInvoice(inv)}
                        className="px-3 py-1.5 text-xs font-semibold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 rounded-xl text-amber-700 dark:text-amber-300 flex items-center gap-1 transition"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Correct
                      </button>

                      <button
                        onClick={() => setPrintingInvoice(inv)}
                        className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Receipt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Record Payment: {payingInvoice.invoice_no}
            </h3>
            <p className="text-xs text-slate-500">
              Patient: {payingInvoice.patient_name} ({payingInvoice.mr_no})
            </p>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option>Cash</option>
                  <option>Credit / Debit Card</option>
                  <option>Online Bank Transfer</option>
                  <option>Insurance Third-Party</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print-Friendly Receipt Modal */}
      {printingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 text-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-black tracking-tight">SEHAT HOSPITAL</h3>
                <p className="text-xs text-slate-500">Official Patient Invoice &amp; Payment Receipt</p>
              </div>
              <button onClick={() => setPrintingInvoice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-2 text-xs gap-2 py-2 border-b">
              <div>
                <p><strong>Invoice No:</strong> {printingInvoice.invoice_no}</p>
                <p><strong>Patient:</strong> {printingInvoice.patient_name}</p>
                <p><strong>MR No:</strong> {printingInvoice.mr_no}</p>
              </div>
              <div className="text-right">
                <p><strong>Date:</strong> {printingInvoice.created_at}</p>
                <p><strong>Status:</strong> {printingInvoice.payment_status}</p>
                <p><strong>Method:</strong> {printingInvoice.payment_method}</p>
              </div>
            </div>

            <div className="space-y-2 py-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Itemized Charges</p>
              <div className="space-y-1 text-xs">
                {printingInvoice.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-slate-100">
                    <span>{it.item_description} x {it.quantity}</span>
                    <span className="font-mono font-semibold">${Number(it.total_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t space-y-1 text-xs text-right">
              <p>Total Amount: <strong>${Number(printingInvoice.total_amount).toFixed(2)}</strong></p>
              <p>Paid Amount: <strong className="text-emerald-600">${Number(printingInvoice.paid_amount).toFixed(2)}</strong></p>
              <p className="text-sm font-bold">
                Balance Due: ${Math.max(0, Number(printingInvoice.total_amount) - Number(printingInvoice.paid_amount)).toFixed(2)}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
              <button
                onClick={() => setPrintingInvoice(null)}
                className="px-4 py-2 border text-slate-700 font-semibold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Correction Modal */}
      {correctingInvoice && (
        <BillingCorrectionModal
          invoice={correctingInvoice}
          onClose={() => setCorrectingInvoice(null)}
          onCorrected={fetchBilling}
        />
      )}

      {/* Patient Profile Modal */}
      {selectedPatientModalId && (
        <PatientProfileModal
          patientId={selectedPatientModalId}
          onClose={() => setSelectedPatientModalId(null)}
          onUpdate={fetchBilling}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
