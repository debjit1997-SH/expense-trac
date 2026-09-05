"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { getNormalizedAdvanceSummary } from "@/lib/advance-summary";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  Send,
  Save,
  Receipt,
  Layers,
  ArrowRight,
} from "lucide-react";

export interface ExpenseItemView {
  id: string;
  expenseDate: Date | string;
  vendorName: string;
  invoiceNumber?: string | null;
  description: string;
  totalAmount: any;
  currency: string;
  category: { name: string; code: string };
  subcategory: { name: string; code: string };
  evidences?: { id: string; originalName: string; storagePath: string; fileSize: number }[];
}

export interface ExpenseReportView {
  id: string;
  reportNumber: string;
  title: string;
  description?: string | null;
  status: any;
  totalAmount: any;
  advanceAdjustedAmount?: any;
  netPayableAmount?: any;
  advanceAllocation?: {
    allocatedAmount: any;
    status: string;
    advanceRequest?: {
      id: string;
      advanceNumber: string;
      purpose: string;
    };
  } | null;
  currency: string;
  items: ExpenseItemView[];
  createdAt: Date | string;
}

interface TagSummaryViewProps {
  report: ExpenseReportView;
  onAddAnother: () => void;
  onEditItem: (item: ExpenseItemView) => void;
  onDeleteItem: (itemId: string) => Promise<void> | void;
  onSubmitReport: () => Promise<void> | void;
  onSaveDraft?: () => void;
  isSubmitting?: boolean;
}

export function TagSummaryView({
  report,
  onAddAnother,
  onEditItem,
  onDeleteItem,
  onSubmitReport,
  onSaveDraft,
  isSubmitting = false,
}: TagSummaryViewProps) {
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteCandidateId) return;
    try {
      setIsDeleting(true);
      await onDeleteItem(deleteCandidateId);
      setDeleteCandidateId(null);
    } finally {
      setIsDeleting(false);
    }
  };

    const calculatedTotal = report.items.reduce((acc, item) => {
    const val = Number(item.totalAmount) || 0;
    return acc + val;
  }, 0);

  const advanceSummary = getNormalizedAdvanceSummary({
    ...report,
    totalAmount: calculatedTotal,
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-sm border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-900 text-white tracking-wider">
                  {report.reportNumber}
                </span>
                <StatusBadge status={report.status} />
                {advanceSummary.hasLinkedAdvance && advanceSummary.advanceNumber && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                    Linked Advance: {advanceSummary.advanceNumber}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-2 uppercase tracking-wide">
                {report.title}
              </h2>
              {report.description && (
                <p className="text-sm text-slate-500 mt-1">{report.description}</p>
              )}
            </div>

            <div className="flex flex-col md:items-end p-4 rounded-lg bg-slate-50 border border-slate-200 min-w-[260px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Expense Amount
              </span>
              <span className="text-2xl font-extrabold text-blue-700 mt-0.5">
                {formatCurrencyINR(calculatedTotal)}
              </span>

              {advanceSummary.hasLinkedAdvance && (
                <div className="w-full mt-2 pt-2 border-t border-slate-200 text-right space-y-1">
                  <div className="text-[11px] text-slate-600 flex justify-between gap-3">
                    <span>Advance Disbursed:</span>
                    <strong className="font-mono">{formatCurrencyINR(advanceSummary.disbursedAmount)}</strong>
                  </div>
                  <div className="text-xs text-amber-700 font-semibold flex justify-between gap-3">
                    <span>{advanceSummary.allocationLabel}:</span>
                    <span className="font-mono">-{formatCurrencyINR(advanceSummary.allocatedAmount)}</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-700 flex justify-between gap-3 pt-0.5 border-t border-slate-200/60">
                    <span>{advanceSummary.netPayableLabel}:</span>
                    <span className="font-mono">{formatCurrencyINR(advanceSummary.expectedNetReimbursement)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between gap-3 pt-0.5">
                    <span>Remaining Available:</span>
                    <span className="font-mono font-medium text-slate-700">
                      {formatCurrencyINR(advanceSummary.remainingAvailableBalance)}
                    </span>
                  </div>
                </div>
              )}

              <span className="text-[11px] text-slate-500 mt-1">
                {report.items.length} {report.items.length === 1 ? "Expense Item" : "Expense Items"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-slate-900">
              Expense Items in this Tag ({report.items.length})
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onAddAnother}
            className="text-xs font-semibold border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Another Expense
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {report.items.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No expense items added yet</p>
              <p className="text-xs text-slate-500">
                You must add at least one expense item before submitting this report.
              </p>
              <Button size="sm" variant="primary" onClick={onAddAnother}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add First Expense Item
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Vendor &amp; Invoice</th>
                    <th className="py-3 px-4">Category / Subcategory</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Receipt</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {report.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-slate-800">
                        <DateDisplay date={item.expenseDate} includeTime={false} />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.vendorName}</div>
                        {item.invoiceNumber && (
                          <div className="text-xs text-slate-500 font-mono">
                            Inv: {item.invoiceNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          {item.category?.name}
                        </div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">
                          {item.subcategory?.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.evidences && item.evidences.length > 0 ? (
                          <a
                            href={`/api/storage/view?path=${encodeURIComponent(
                              item.evidences[0].storagePath
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View ({item.evidences.length})
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No receipt</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-900">
                        {formatCurrencyINR(item.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                            title="Edit Item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCandidateId(item.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
        <Button
          type="button"
          variant="outline"
          onClick={onAddAnother}
          className="w-full sm:w-auto font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Expense Under Tag
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onSaveDraft && (
            <Button
              type="button"
              variant="secondary"
              onClick={onSaveDraft}
              className="w-full sm:w-auto"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save as Draft
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={() => setShowSubmitConfirm(true)}
            disabled={report.items.length === 0}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="w-4 h-4 mr-1.5" />
            Submit for Approval
          </Button>
        </div>
      </div>

      {/* Delete Item Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteCandidateId)}
        onClose={() => setDeleteCandidateId(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Expense Item"
        message="Are you sure you want to delete this expense item? The total report amount will be automatically recalculated."
        confirmLabel="Remove Item"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Submit Report Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={async (reason) => {
          setShowSubmitConfirm(false);
          await onSubmitReport();
        }}
        title="Submit Expense Report for Approval"
        message={`Are you ready to submit "${report.title}" with ${report.items.length} items totaling ${formatCurrencyINR(
          calculatedTotal
        )}? Once submitted, it will be forwarded to administrators for review.`}
        confirmLabel="Submit Report"
        variant="success"
        askReason={true}
        reasonPlaceholder="Add optional submission comments for the reviewer..."
        isLoading={isSubmitting}
      />
    </div>
  );
}
