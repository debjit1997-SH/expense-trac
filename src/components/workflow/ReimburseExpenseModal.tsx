"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { reimburseExpenseReportAction } from "@/actions/workflow.actions";
import { CheckCircle, AlertCircle, Banknote } from "lucide-react";

interface ReimburseExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  reportAmount: number | string;
  netPayableAmount?: number | string;
  advanceAdjustedAmount?: number | string;
  onSuccess: (updatedReport: any) => void;
}

export function ReimburseExpenseModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  reportAmount,
  netPayableAmount,
  advanceAdjustedAmount,
  onSuccess,
}: ReimburseExpenseModalProps) {
  const isAdvanceSettled = Number(advanceAdjustedAmount) > 0;
  const netPayable = netPayableAmount !== undefined ? Number(netPayableAmount) : Number(reportAmount);
  const isZeroNet = netPayable === 0;

  const [reimbursementDate, setReimbursementDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(isZeroNet ? "ADVANCE_SETTLEMENT" : "BANK_TRANSFER");
  const [reimbursementRef, setReimbursementRef] = useState<string>(isZeroNet ? "ADV-SETTLED-CONFIRM" : "");
  const [transactionId, setTransactionId] = useState<string>("");
  const [reimbursementNote, setReimbursementNote] = useState<string>(
    isZeroNet ? "Zero-net payable expense report fully settled against employee company advance." : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimbursementDate) {
      setError("Please select the reimbursement settlement date.");
      return;
    }
    if (!paymentMethod) {
      setError("Please select the payment method / settlement type.");
      return;
    }
    if (!reimbursementRef.trim()) {
      setError("Please enter the payment reference number / settlement confirmation.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await reimburseExpenseReportAction({
        reportId,
        reimbursementDate,
        paymentMethod,
        reimbursementRef: reimbursementRef.trim(),
        transactionId: transactionId.trim() || undefined,
        reimbursementNote: reimbursementNote.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to mark as reimbursed.");
      } else {
        onSuccess(res.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to mark as reimbursed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isZeroNet ? "Confirm Zero-Net Advance Settlement" : "Disburse & Mark Expense Reimbursed"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Reimbursing Report:
            </span>
            <span className="text-xs font-bold text-slate-900">{reportTitle}</span>
          </div>

          <div className="pt-1 border-t border-emerald-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600">Total Expense:</span>
            <span className="font-bold text-slate-800">
              ₹{Number(reportAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {isAdvanceSettled && (
            <div className="flex items-center justify-between text-xs text-amber-800">
              <span>Less Advance Adjusted:</span>
              <span className="font-bold">
                -₹{Number(advanceAdjustedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="pt-1 border-t border-emerald-300 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase">Net Payable to Employee:</span>
            <span className="text-base font-black text-emerald-950 font-mono">
              ₹{netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payment / Disbursement Date"
            type="date"
            required
            value={reimbursementDate}
            onChange={(e) => setReimbursementDate(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="UPI">Corporate UPI / Virtual Payment</option>
              <option value="CORPORATE_CARD">Corporate Credit Card Settlement</option>
              <option value="CHEQUE">Company Account Cheque</option>
              <option value="CASH">Petty Cash Disbursement</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Bank Reference / UTR Number"
            required
            placeholder="e.g. UTR-HDFC-998231"
            value={reimbursementRef}
            onChange={(e) => setReimbursementRef(e.target.value)}
          />

          <Input
            label="Optional Gateway / Txn ID"
            placeholder="e.g. TXN-898234-A"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Optional Disbursement Note:
          </label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="e.g. Processed via HDFC Corporate Batch Payment #412"
            value={reimbursementNote}
            onChange={(e) => setReimbursementNote(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Banknote className="w-4 h-4 mr-1.5" />
            Confirm Payment &amp; Mark REIMBURSED
          </Button>
        </div>
      </form>
    </Modal>
  );
}
