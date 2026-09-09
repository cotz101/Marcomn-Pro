'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter
} from '@/src/components/ui/dialog';
import { FileText } from 'lucide-react';

export default function ReceiptModal({
  isOpen,
  onClose,
  receipt = null,
}) {
  if (!receipt) return null;

  const issuedTo = receipt.issued_to_company_name || receipt.issued_to_name || 'N/A';
  const issuedDate = receipt.issued_at
    ? new Date(receipt.issued_at).toLocaleString()
    : 'N/A';

  const paymentMethodLabel = receipt.payment_method === 'dummy_manual'
    ? 'Internal Record'
    : (receipt.payment_method ? receipt.payment_method.replace('_', ' ') : 'Card');

  const amountDisplay = Number(receipt.amount || 0).toFixed(2);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
    >
      <DialogContent maxWidth="md" className="max-w-[480px]">
        {/* MarComn Navy Branded Centered Header — No X */}
        <DialogHeader
          title="Payment Receipt"
          onClose={onClose}
        />

        {/* Modal Body with Authoritative Gutters */}
        <DialogBody className="space-y-6 pt-5 pb-6">
          {/* Receipt Top Identity Card */}
          <div className="text-center pb-5 border-b border-dashed border-gray-200">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-3xs">
                <FileText size={24} />
              </div>
            </div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Receipt Number</p>
            <p className="text-sm font-bold text-gray-800 font-mono tracking-tight select-all">
              {receipt.receipt_number || 'N/A'}
            </p>
          </div>

          {/* Key Value Details List */}
          <div className="space-y-3.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-500 font-medium">Date</span>
              <span className="font-semibold text-gray-800 text-right">{issuedDate}</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-500 font-medium">Issued To</span>
              <span className="font-semibold text-gray-800 text-right truncate max-w-[240px]">{issuedTo}</span>
            </div>

            {receipt.issued_to_email && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-500 font-medium">Email</span>
                <span className="font-semibold text-gray-800 text-right truncate max-w-[240px]">{receipt.issued_to_email}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-500 font-medium">Payment Method</span>
              <span className="font-bold text-gray-800 uppercase text-xs tracking-wide text-right">{paymentMethodLabel}</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-500 font-medium">Status</span>
              <span className="font-extrabold text-emerald-600 uppercase text-xs tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {receipt.status || 'Completed'}
              </span>
            </div>
          </div>

          {/* Total Amount Summary Box */}
          <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-end">
            <span className="text-gray-500 font-bold text-sm">Total Amount</span>
            <div className="text-right flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#002b4e]">{amountDisplay}</span>
              <span className="text-xs font-bold text-gray-500">MC</span>
            </div>
          </div>

          {/* Explanatory Notice */}
          <div className="text-center pt-1">
            <p className="text-[11px] text-gray-400 bg-slate-50 border border-slate-150 py-2 px-3 rounded-xl inline-block leading-relaxed font-medium">
              PDF download functionality is planned for a future update.
            </p>
          </div>
        </DialogBody>

        {/* Modal Footer with Styled Close Button */}
        <DialogFooter className="flex justify-center sm:justify-center border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-36 min-h-[44px] px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-250 select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
