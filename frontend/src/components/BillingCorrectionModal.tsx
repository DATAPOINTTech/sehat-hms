// frontend/src/components/BillingCorrectionModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Wrench, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Invoice } from '@/lib/types';
import { correctInvoice } from '@/lib/api';

interface BillingCorrectionModalProps {
  invoice: Invoice;
  onClose: () => void;
  onCorrected: () => void;
}

export default function BillingCorrectionModal({ invoice, onClose, onCorrected }: BillingCorrectionModalProps) {
  const [discount, setDiscount] = useState<string>(String(invoice.discount ?? 0));
  const [tax, setTax] = useState<string>(String(invoice.tax ?? 0));
  const [paidAmount, setPaidAmount] = useState<string>(String(invoice.paid_amount ?? 0));
  const [notes, setNotes] = useState<string>(invoice.notes || '');

  // Optional new adjustment item
  const [addItemDesc, setAddItemDesc] = useState('');
  const [addItemType, setAddItemType] = useState('Other');
  const [addItemPrice, setAddItemPrice] = useState('');
  const [addItemQty, setAddItemQty] = useState('1');
  const [saving, setSaving] = useState(false);

  const handleRemoveItem = async (itemId: number) => {
    if (!confirm('Remove this line item from the invoice?')) return;
    setSaving(true);
    try {
      await correctInvoice({
        invoice_id: invoice.id,
        remove_item_id: itemId,
      });
      onCorrected();
      onClose();
    } catch (err: any) {
      alert('Error removing item: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await correctInvoice({
        invoice_id: invoice.id,
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        paid_amount: parseFloat(paidAmount) || 0,
        notes,
        add_item: addItemDesc.trim()
          ? {
              item_type: addItemType,
              item_description: addItemDesc.trim(),
              unit_price: parseFloat(addItemPrice) || 0,
              quantity: parseInt(addItemQty, 10) || 1,
            }
          : undefined,
      });
      onCorrected();
      onClose();
    } catch (err: any) {
      alert('Billing correction failed: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Billing Correction: {invoice.invoice_no}
              </h3>
              <p className="text-xs text-slate-500">
                Patient: {invoice.patient_name} ({invoice.mr_no}) • Current Subtotal: ${Number(invoice.subtotal).toFixed(2)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Line Items with Delete */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Existing Line Items
          </span>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {invoice.items?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{item.item_description}</span>
                  <span className="text-slate-400 ml-2">
                    ({item.item_type} • ${Number(item.unit_price).toFixed(2)} × {item.quantity})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">${Number(item.total_price).toFixed(2)}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-red-500 hover:text-red-700"
                    title="Remove erroneous line item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSaveCorrection} className="space-y-4">
          {/* Add Optional Correction Item */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              Add Adjustment / Missed Charge (Optional)
            </span>
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-5">
                <input
                  type="text"
                  placeholder="Description (e.g. Dressing Fee)"
                  value={addItemDesc}
                  onChange={(e) => setAddItemDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={addItemType}
                  onChange={(e) => setAddItemType(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  <option>Other</option>
                  <option>Consultation</option>
                  <option>Room</option>
                  <option>Lab</option>
                  <option>Medicine</option>
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price $"
                  value={addItemPrice}
                  onChange={(e) => setAddItemPrice(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={addItemQty}
                  onChange={(e) => setAddItemQty(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Discount, Tax, Paid Amount */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Discount / Waiver ($)</label>
              <input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Tax ($)</label>
              <input
                type="number"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Paid Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Correction / Audit Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for billing adjustment..."
              className="w-full mt-1 px-3 py-2 text-xs border rounded-xl dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? 'Applying Correction...' : 'Apply Billing Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
