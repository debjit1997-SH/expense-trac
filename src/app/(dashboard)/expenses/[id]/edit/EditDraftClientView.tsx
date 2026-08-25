"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MasterCategory, MasterGstTreatment, MasterGstRate, ExpenseItemForm } from "@/components/expenses/ExpenseItemForm";
import { TagSummaryView, ExpenseReportView, ExpenseItemView } from "@/components/expenses/TagSummaryView";
import { DuplicateReviewModal, DuplicateItemDetails } from "@/components/expenses/DuplicateReviewModal";
import { SelectApproverModal } from "@/components/workflow/SelectApproverModal";
import {
  addExpenseItemAction,
  updateExpenseItemAction,
  deleteExpenseItemAction,
  getExpenseReportByIdAction,
} from "@/actions/expense.actions";
import { ExpenseItemInput } from "@/lib/validations/expense.schema";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";

interface EditDraftClientViewProps {
  initialReport: ExpenseReportView;
  categories: MasterCategory[];
  gstTreatments: MasterGstTreatment[];
  gstRates: MasterGstRate[];
}

export function EditDraftClientView({
  initialReport,
  categories,
  gstTreatments,
  gstRates,
}: EditDraftClientViewProps) {
  const router = useRouter();
  const [report, setReport] = useState<ExpenseReportView>(initialReport);
  const [viewState, setViewState] = useState<"SUMMARY" | "ADD_ITEM" | "EDIT_ITEM">("SUMMARY");
  const [editingItem, setEditingItem] = useState<ExpenseItemView | null>(null);
  const [formKey, setFormKey] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate modal states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState<string>("");
  const [existingDuplicateItem, setExistingDuplicateItem] = useState<DuplicateItemDetails | null>(null);
  const [candidateItemData, setCandidateItemData] = useState<ExpenseItemInput | null>(null);

  // Approver selection modal
  const [selectApproverModalOpen, setSelectApproverModalOpen] = useState(false);

  const refreshReport = async () => {
    const updated = await getExpenseReportByIdAction(report.id);
    if (updated) setReport(updated as any);
  };

  const handleSaveItem = async (
    itemData: ExpenseItemInput,
    options?: { allowDuplicate?: boolean }
  ) => {
    try {
      setIsSaving(true);
      let res: any;

      if (viewState === "EDIT_ITEM" && itemData.id) {
        res = await updateExpenseItemAction(itemData, options);
      } else {
        res = await addExpenseItemAction(itemData, options);
      }

      if (!res.success && res.isDuplicate && res.matchedItem) {
        const cat = categories.find((c) => c.id === itemData.categoryId);
        const sub = cat?.subcategories.find((s) => s.id === itemData.subcategoryId);

        setCandidateItemData(itemData);
        setDuplicateReason(res.reason || "Possible duplicate item identified in this report");
        setExistingDuplicateItem({
          id: res.matchedItem.id,
          expenseDate: res.matchedItem.expenseDate,
          vendorName: res.matchedItem.vendorName,
          invoiceNumber: res.matchedItem.invoiceNumber,
          categoryName: res.matchedItem.categoryName,
          subcategoryName: res.matchedItem.subcategoryName,
          amount: res.matchedItem.totalAmount,
          receiptName: res.matchedItem.evidenceOriginalName,
        });
        setDuplicateModalOpen(true);
        return;
      }

      if (!res.success) {
        alert(res.error || "Failed to save item.");
        return;
      }

      await refreshReport();
      setEditingItem(null);
      setCandidateItemData(null);
      setDuplicateModalOpen(false);
      setFormKey((k) => k + 1);
      setViewState("SUMMARY");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverrideDuplicate = async () => {
    if (!candidateItemData) return;
    await handleSaveItem(candidateItemData, { allowDuplicate: true });
  };

  const handleDeleteItem = async (itemId: string) => {
    const res = await deleteExpenseItemAction({ itemId, reportId: report.id });
    if (res.success) {
      await refreshReport();
    } else {
      alert(res.error || "Failed to delete item.");
    }
  };

  const handleSubmitReport = () => {
    if (report.items.length === 0) {
      alert("Cannot submit an empty expense report. Add at least one expense item.");
      return;
    }
    setSelectApproverModalOpen(true);
  };

  const candidateCategory = categories.find((c) => c.id === candidateItemData?.categoryId);
  const candidateSubcategory = candidateCategory?.subcategories.find(
    (s) => s.id === candidateItemData?.subcategoryId
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/expenses/${report.id}`}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Report Details
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Edit className="w-6 h-6 text-blue-600" />
            Edit Draft: {report.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add, update, or remove receipts and expense items before submission
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-900 text-white">
          {report.reportNumber}
        </span>
      </div>

      {viewState === "SUMMARY" && (
        <TagSummaryView
          report={report}
          onAddAnother={() => {
            setEditingItem(null);
            setFormKey((k) => k + 1);
            setViewState("ADD_ITEM");
          }}
          onEditItem={(item) => {
            setEditingItem(item);
            setFormKey((k) => k + 1);
            setViewState("EDIT_ITEM");
          }}
          onDeleteItem={handleDeleteItem}
          onSubmitReport={handleSubmitReport}
          onSaveDraft={() => router.push(`/expenses/${report.id}`)}
          isSubmitting={isSubmitting}
        />
      )}

      {(viewState === "ADD_ITEM" || viewState === "EDIT_ITEM") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50/70 border border-blue-200">
            <h3 className="text-sm font-bold text-blue-950 uppercase">
              {viewState === "EDIT_ITEM" ? "Edit Expense Item" : "Add New Expense Item"}
            </h3>
            <button
              type="button"
              onClick={() => setViewState("SUMMARY")}
              className="text-xs text-blue-700 font-semibold hover:underline"
            >
              Cancel &amp; Return to Summary
            </button>
          </div>

          <ExpenseItemForm
            key={`edit-draft-form-${formKey}`}
            reportId={report.id}
            categories={categories}
            gstTreatments={gstTreatments}
            gstRates={gstRates}
            initialItem={editingItem as any}
            onSave={handleSaveItem}
            onCancel={() => setViewState("SUMMARY")}
            isLoading={isSaving}
          />
        </div>
      )}

      {/* Duplicate Review Modal */}
      {existingDuplicateItem && candidateItemData && (
        <DuplicateReviewModal
          isOpen={duplicateModalOpen}
          reason={duplicateReason}
          existingItem={existingDuplicateItem}
          newItem={{
            expenseDate: candidateItemData.expenseDate,
            vendorName: candidateItemData.vendorName,
            invoiceNumber: candidateItemData.invoiceNumber,
            categoryName: candidateCategory?.name,
            subcategoryName: candidateSubcategory?.name,
            amount: candidateItemData.totalAmount,
            receiptName: candidateItemData.evidence?.originalName,
          }}
          onReviewExisting={(existingId) => {
            setDuplicateModalOpen(false);
            const found = report.items.find((i) => i.id === existingId);
            if (found) {
              setEditingItem(found);
              setFormKey((k) => k + 1);
              setViewState("EDIT_ITEM");
            } else {
              setViewState("SUMMARY");
            }
          }}
          onCancel={() => setDuplicateModalOpen(false)}
          onAddAnyway={handleOverrideDuplicate}
          isLoading={isSaving}
        />
      )}

      {/* Select Approver Modal */}
      <SelectApproverModal
        isOpen={selectApproverModalOpen}
        onClose={() => setSelectApproverModalOpen(false)}
        reportId={report.id}
        reportTitle={report.title}
        onSuccess={() => {
          setSelectApproverModalOpen(false);
          router.push(`/expenses/${report.id}`);
        }}
      />
    </div>
  );
}
