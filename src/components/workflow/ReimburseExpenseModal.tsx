"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { reimburseExpenseReportAction } from "@/actions/workflow.actions";
import { formatCurrencyINR } from "@/lib/formatters";
import { CheckCircle2, AlertCircle, Banknote, ShieldCheck, HandCoins } from "lucide-react";

interface ReimburseExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  reportAmount: number | string;
  netPayableAmount?: number | string;
  advanceAdjustedAmount?: number | string;
  advanceRequestNumber?: string | null;
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
  advanceRequestNumber,
  onSuccess,
}: ReimburseExpenseModalProps) {
  const totalAmt = Number(reportAmount) || 0;
  const advAdj = Number(advanceAdjustedAmount) || 0;
  const netPayable =
    netPayableAmount !== undefined && netPayableAmount !== null
      ? Number(netPayableAmount)
      : Math.max(0, totalAmt - advAdj);
  const isZeroNet = netPayable === 0 && advAdj > 0;

  const [reimbursementDate, setReimbursementDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [reimbursementRef, setReimbursementRef] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [settlementNote, setSettlementNote] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isZeroNet) {
      if (!reimbursementDate) {
        setError("Please select the payment / disbursement date.");
        return;
      }
      if (!paymentMethod || !paymentMethod.trim()) {
        setError("Please select the payment method.");
        return;
      }
      if (!reimbursementRef.trim()) {
        setError("Please enter the bank reference / UTR number.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await reimburseExpenseReportAction({
        reportId,
        reimbursementDate: isZeroNet ? (reimbursementDate || undefined) : reimbursementDate,
        paymentMethod: isZeroNet ? "ADVANCE_ADJUSTMENT" : paymentMethod,
        reimbursementRef: isZeroNet ? (advanceRequestNumber || "ADVANCE_ADJUSTED") : reimbursementRef.trim(),
        transactionId: isZeroNet ? undefined : (transactionId.trim() || undefined),
        reimbursementNote: settlementNote.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to complete settlement.");
      } else {
        onSuccess(res.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to complete settlement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isZeroNet ? "Complete Advance-Adjusted Settlement" : "Disburse & Mark Expense Reimbursed"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Financial Summary Card */}
        <div className={`p-4 rounded-lg border space-y-2 ${isZeroNet ? "bg-emerald-50/70 border-emerald-200" : "bg-purple-50/60 border-purple-200"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Expense Report:
            </span>
            <span className="text-xs font-bold text-slate-900">{reportTitle}</span>
          </div>

          <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600">Approved Expense Total:</span>
            <span className="font-bold text-slate-900 font-mono">
              {formatCurrencyINR(totalAmt)}
            </span>
          </div>

          {advAdj > 0 && (
            <div className="flex items-center justify-between text-xs text-amber-800 font-medium">
              <span className="flex items-center gap-1">
                <HandCoins className="w-3.5 h-3.5 text-amber-600" />
                Less Advance Adjusted {advanceRequestNumber ? `(${advanceRequestNumber})` : ""}:
              </span>
              <span className="font-bold font-mono">
                -{formatCurrencyINR(advAdj)}
              </span>
            </div>
          )}

          <div className="pt-1.5 border-t border-slate-300 flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Net Payable to Employee:
            </span>
            <span className={`text-base font-black font-mono ${isZeroNet ? "text-emerald-700" : "text-purple-900"}`}>
              {formatCurrencyINR(netPayable)}
            </span>
          </div>

          {isZeroNet && (
            <div className="pt-2 border-t border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 bg-emerald-100/60 p-2.5 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Settlement Type: Fully Adjusted Against Company Advance</strong>
                <span className="text-[11px] text-emerald-700 leading-relaxed block mt-0.5">
                  No employee payment is required because the approved expense has been fully adjusted against the linked company advance.
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Case A: netPayable > 0 requires Payment Inputs */}
        {!isZeroNet ? (
          <>
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
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium"
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
                className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="e.g. Processed via Corporate Net Banking Batch"
                value={settlementNote}
                onChange={(e) => setSettlementNote(e.target.value)}
              />
            </div>
          </>
        ) : (
          /* Case B: netPayable === 0 dedicated Zero-Net Settlement Form */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Optional Settlement Note:
              </label>
              <textarea
                rows={2}
                className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Optional sign-off remarks (e.g. Fully adjusted against ADV-2026-000003)"
                value={settlementNote}
                onChange={(e) => setSettlementNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className={isZeroNet ? "bg-emerald-600 hover:bg-emerald-700" : "bg-purple-600 hover:bg-purple-700"}
          >
            {isZeroNet ? (
              <>
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                Confirm ₹0 Settlement
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4 mr-1.5" />
                Confirm Payment &amp; Mark REIMBURSED
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
