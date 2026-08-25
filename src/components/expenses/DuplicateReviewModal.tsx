"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, AlertOctagon, CheckCircle2, ArrowRight } from "lucide-react";
import { DateDisplay } from "@/components/common/DateDisplay";

export interface DuplicateItemDetails {
  id?: string;
  expenseDate: string | Date;
  vendorName: string;
  invoiceNumber?: string | null;
  categoryName?: string;
  subcategoryName?: string;
  amount: number | string;
  receiptName?: string | null;
}

interface DuplicateReviewModalProps {
  isOpen: boolean;
  reason: string;
  existingItem: DuplicateItemDetails;
  newItem: DuplicateItemDetails;
  onReviewExisting?: (existingItemId: string) => void;
  onCancel: () => void;
  onAddAnyway: () => Promise<void>;
  isLoading?: boolean;
}

export function DuplicateReviewModal({
  isOpen,
  reason,
  existingItem,
  newItem,
  onReviewExisting,
  onCancel,
  onAddAnyway,
  isLoading = false,
}: DuplicateReviewModalProps) {
  const [showConfirmOverride, setShowConfirmOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmAddAnyway = async () => {
    try {
      setIsSubmitting(true);
      await onAddAnyway();
    } finally {
      setIsSubmitting(false);
      setShowConfirmOverride(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !showConfirmOverride}
        onClose={onCancel}
        title="POSSIBLE DUPLICATE EXPENSE FOUND"
        maxWidth="2xl"
      >
        <div className="space-y-5">
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Duplicate Item Detected</p>
              <p className="mt-0.5 text-amber-800">{reason}</p>
            </div>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Existing Item Card */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Existing Expense Item</span>
                <span className="text-[10px] font-mono text-slate-500">SAVED</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Vendor</span>
                <span className="font-bold text-slate-900">{existingItem.vendorName}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Expense Date</span>
                <span className="font-medium text-slate-800">
                  <DateDisplay date={existingItem.expenseDate} />
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Invoice Number</span>
                <span className="font-mono text-slate-800">{existingItem.invoiceNumber || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Category / Subcategory</span>
                <span className="font-medium text-slate-800">
                  {existingItem.categoryName || "—"} &bull; {existingItem.subcategoryName || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Total Amount</span>
                <span className="font-bold text-slate-900 text-sm">₹{Number(existingItem.amount).toFixed(2)}</span>
              </div>
              {existingItem.receiptName && (
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] font-semibold">Receipt File</span>
                  <span className="font-mono text-[11px] text-blue-700 truncate block">
                    {existingItem.receiptName}
                  </span>
                </div>
              )}
            </div>

            {/* New Candidate Item Card */}
            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200 space-y-2.5">
              <div className="font-bold text-blue-900 uppercase tracking-wider border-b border-blue-200 pb-1.5 flex items-center justify-between">
                <span>New Candidate Item</span>
                <span className="text-[10px] font-mono text-blue-600">UNSAVED</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Vendor</span>
                <span className="font-bold text-slate-900">{newItem.vendorName}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Expense Date</span>
                <span className="font-medium text-slate-800">
                  <DateDisplay date={newItem.expenseDate} />
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Invoice Number</span>
                <span className="font-mono text-slate-800">{newItem.invoiceNumber || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Category / Subcategory</span>
                <span className="font-medium text-slate-800">
                  {newItem.categoryName || "—"} &bull; {newItem.subcategoryName || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">Total Amount</span>
                <span className="font-bold text-blue-950 text-sm">₹{Number(newItem.amount).toFixed(2)}</span>
              </div>
              {newItem.receiptName && (
                <div>
                  <span className="text-slate-400 block uppercase text-[10px] font-semibold">Receipt File</span>
                  <span className="font-mono text-[11px] text-blue-700 truncate block">
                    {newItem.receiptName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {onReviewExisting && existingItem.id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onReviewExisting(existingItem.id!)}
                className="w-full sm:w-auto text-xs"
              >
                REVIEW EXISTING EXPENSE
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isLoading || isSubmitting}
                className="w-full sm:w-auto text-xs"
              >
                CANCEL NEW EXPENSE
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setShowConfirmOverride(true)}
                disabled={isLoading || isSubmitting}
                className="w-full sm:w-auto text-xs"
              >
                ADD ANYWAY
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Second Confirmation Dialog for ADD ANYWAY */}
      <Modal
        isOpen={showConfirmOverride}
        onClose={() => setShowConfirmOverride(false)}
        title="Confirm Duplicate Expense Creation"
        maxWidth="md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Are you sure you want to add this duplicate expense?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              This action will create an additional expense record and log an override entry in the system audit trail.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmOverride(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Go Back
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmAddAnyway}
              isLoading={isSubmitting}
              className="text-xs font-semibold"
            >
              Yes, Confirm &amp; Save Expense
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
