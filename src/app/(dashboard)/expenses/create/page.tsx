"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ExpenseItemForm, MasterCategory, MasterGstTreatment, MasterGstRate } from "@/components/expenses/ExpenseItemForm";
import { TagSummaryView, ExpenseReportView, ExpenseItemView } from "@/components/expenses/TagSummaryView";
import { DuplicateReviewModal, DuplicateItemDetails } from "@/components/expenses/DuplicateReviewModal";
import { SelectApproverModal } from "@/components/workflow/SelectApproverModal";
import {
  createExpenseTagAction,
  addExpenseItemAction,
  updateExpenseItemAction,
  deleteExpenseItemAction,
  getExpenseReportByIdAction,
} from "@/actions/expense.actions";
import { submitExpenseReportAction } from "@/actions/workflow.actions";
import { getCategoriesAction, getGstMastersAction } from "@/actions/master.actions";
import { getEligibleAdvancesForExpenseAction } from "@/actions/advance.actions";
import { ExpenseItemInput } from "@/lib/validations/expense.schema";
import { FolderPlus, CheckCircle2, AlertCircle, Plus, Wallet } from "lucide-react";
import Link from "next/link";

export default function CreateExpensePage() {
  const router = useRouter();

  // Workflow Stage: "TAG_CREATION" | "ADD_ITEM" | "EDIT_ITEM" | "SUMMARY"
  const [stage, setStage] = useState<"TAG_CREATION" | "ADD_ITEM" | "EDIT_ITEM" | "SUMMARY">("TAG_CREATION");

  // Unique Form Instance Key to guarantee clean component remount
  const [formInstanceKey, setFormInstanceKey] = useState<number>(1);

  // Tag Form States
  const [tagTitle, setTagTitle] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Company Advance States
  const [activeAdvances, setActiveAdvances] = useState<any[]>([]);
  const [useAdvance, setUseAdvance] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState("");

  // Active Report State
  const [activeReport, setActiveReport] = useState<ExpenseReportView | null>(null);
  const [editingItem, setEditingItem] = useState<ExpenseItemView | null>(null);

  // Master Data
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [gstTreatments, setGstTreatments] = useState<MasterGstTreatment[]>([]);
  const [gstRates, setGstRates] = useState<MasterGstRate[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);

  // Item Save States
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [showAddAnotherModal, setShowAddAnotherModal] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Duplicate Review States
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState<string>("");
  const [existingDuplicateItem, setExistingDuplicateItem] = useState<DuplicateItemDetails | null>(null);
  const [candidateItemData, setCandidateItemData] = useState<ExpenseItemInput | null>(null);

  // Load active master data and advances on mount
  useEffect(() => {
    async function loadMasters() {
      try {
        const [cats, { treatments, rates }, advances] = await Promise.all([
          getCategoriesAction(true),
          getGstMastersAction(true),
          getEligibleAdvancesForExpenseAction(),
        ]);
        setCategories(cats as any);
        setGstTreatments(treatments as any);
        setGstRates(rates as any);
        setActiveAdvances(advances || []);
        if (advances && advances.length > 0) {
          setSelectedAdvanceId(advances[0].id);
        }
      } catch (err) {
        console.error("Failed to load masters:", err);
      } finally {
        setIsLoadingMasters(false);
      }
    }
    loadMasters();
  }, []);

  // Step 1: Initialize Expense Tag
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setTagError(null);

    if (!tagTitle.trim() || tagTitle.trim().length < 3) {
      setTagError("Expense Tag title must be at least 3 characters");
      return;
    }

    try {
      setIsCreatingTag(true);
      const res = await createExpenseTagAction({
        title: tagTitle.trim().toUpperCase(),
        description: tagDescription.trim() || null,
        advanceRequestId: useAdvance && selectedAdvanceId ? selectedAdvanceId : undefined,
      });

      if (!res.success || !res.report) {
        setTagError(res.error || "Failed to create expense tag.");
      } else {
        setActiveReport({
          id: res.report.id,
          reportNumber: res.report.reportNumber,
          title: res.report.title,
          description: res.report.description,
          status: res.report.status,
          totalAmount: res.report.totalAmount,
          advanceAdjustedAmount: res.report.advanceAdjustedAmount,
          netPayableAmount: res.report.netPayableAmount,
          advanceAllocation: res.report.advanceAllocation,
          currency: res.report.currency,
          items: [],
          createdAt: res.report.createdAt,
        });
        setEditingItem(null);
        setFormInstanceKey((k) => k + 1);
        setStage("ADD_ITEM");
      }
    } catch (err: any) {
      setTagError(err.message || "Failed to create expense tag.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Step 2: Save Item (Add or Update) with Duplicate Detection
  const handleSaveItem = async (
    itemData: ExpenseItemInput,
    options?: { allowDuplicate?: boolean }
  ) => {
    if (!activeReport) return;

    try {
      setIsSavingItem(true);

      let res: any;
      if (stage === "EDIT_ITEM" && itemData.id) {
        res = await updateExpenseItemAction(itemData, options);
      } else {
        res = await addExpenseItemAction(itemData, options);
      }

      // Check for duplicate response
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
        alert(res.error || "Failed to save expense item.");
        return;
      }

      // Refresh complete report from server
      const updatedReport = await getExpenseReportByIdAction(activeReport.id);
      if (updatedReport) {
        setActiveReport(updatedReport as any);
      }

      setEditingItem(null);
      setCandidateItemData(null);
      setDuplicateModalOpen(false);

      // Section 12 requirement: Display prompt modal: "Do you want to add another expense under this Expense Tag?"
      setShowAddAnotherModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to save expense item.");
    } finally {
      setIsSavingItem(false);
    }
  };

  // Override duplicate and save anyway
  const handleOverrideDuplicate = async () => {
    if (!candidateItemData) return;
    await handleSaveItem(candidateItemData, { allowDuplicate: true });
  };

  // Delete Item handler
  const handleDeleteItem = async (itemId: string) => {
    if (!activeReport) return;
    const res = await deleteExpenseItemAction({ itemId, reportId: activeReport.id });
    if (res.success) {
      const updatedReport = await getExpenseReportByIdAction(activeReport.id);
      if (updatedReport) setActiveReport(updatedReport as any);
    } else {
      alert(res.error || "Failed to delete item.");
    }
  };

  // Approver Selection State
  const [selectApproverModalOpen, setSelectApproverModalOpen] = useState(false);

  // Submit Report handler: Opens Approver Selection Modal
  const handleSubmitReport = () => {
    if (!activeReport) return;
    if (activeReport.items.length === 0) {
      alert("Cannot submit an empty expense report. Add at least one item.");
      return;
    }
    setSelectApproverModalOpen(true);
  };

  if (isLoadingMasters) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">
        Loading expense categories &amp; GST master settings...
      </div>
    );
  }

  const candidateCategory = categories.find((c) => c.id === candidateItemData?.categoryId);
  const candidateSubcategory = candidateCategory?.subcategories.find(
    (s) => s.id === candidateItemData?.subcategoryId
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Create Expense Tag
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Group multiple expense receipts under a single tagged reimbursement report
          </p>
        </div>

        {activeReport && (
          <div className="text-right">
            <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-900 text-white rounded">
              {activeReport.reportNumber}
            </span>
          </div>
        )}
      </div>

      {/* STAGE 1: Tag Details Creation */}
      {stage === "TAG_CREATION" && (
        <Card className="shadow-sm border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200/80">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-blue-600" />
              Step 1: Enter Expense Tag Title
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Provide a clear title to identify this reimbursement bundle (e.g. AUGUST EXPENSE SUMMARY, CLIENT TRIP MUMBAI)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateTag} className="space-y-4">
              {tagError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{tagError}</span>
                </div>
              )}

              <Input
                label="Expense Tag Title"
                required
                placeholder="e.g. AUGUST EXPENSE SUMMARY"
                value={tagTitle}
                onChange={(e) => setTagTitle(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 tracking-wide">
                  Optional Tag Description
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional context, project name, or client details..."
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                />
              </div>

              {/* Company Advance Toggle */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useAdvance}
                    onChange={(e) => {
                      setUseAdvance(e.target.checked);
                      if (e.target.checked && activeAdvances.length > 0 && !selectedAdvanceId) {
                        setSelectedAdvanceId(activeAdvances[0].id);
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Use Company Advance for this Expense Tag?
                    </span>
                  </div>
                </label>

                {useAdvance && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-md space-y-2.5">
                    {activeAdvances.length === 0 ? (
                      <div className="text-xs text-amber-800">
                        You have no active disbursed company advances with available balances.
                        <Link href="/advances/create" className="ml-1 text-emerald-700 underline font-semibold">
                          Request an advance here.
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                            Select Disbursed Advance
                          </label>
                          <select
                            value={selectedAdvanceId}
                            onChange={(e) => setSelectedAdvanceId(e.target.value)}
                            className="w-full text-xs p-2 border border-emerald-300 rounded bg-white font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          >
                            {activeAdvances.map((adv) => {
                              const avail = adv.computedBalances?.availableBalance ?? (adv.disbursedAmount - adv.adjustedAmount - adv.returnedAmount - adv.reservedAmount);
                              return (
                                <option key={adv.id} value={adv.id}>
                                  {adv.advanceNumber} — {adv.purpose} (Available: ₹{Number(avail).toFixed(2)})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          The approved expense amount under this tag will automatically be deducted from your advance balance upon approval.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button type="submit" variant="primary" isLoading={isCreatingTag}>
                  Create Tag &amp; Add First Expense Item &rarr;
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STAGE 2: Add or Edit Expense Item */}
      {(stage === "ADD_ITEM" || stage === "EDIT_ITEM") && activeReport && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50/70 border border-blue-200">
            <div>
              <span className="text-xs font-bold text-blue-900 uppercase">Active Expense Tag:</span>
              <h3 className="text-base font-extrabold text-blue-950 uppercase">{activeReport.title}</h3>
            </div>
            {activeReport.items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStage("SUMMARY")}
                className="text-xs font-semibold"
              >
                View Tag Summary ({activeReport.items.length} items)
              </Button>
            )}
          </div>

          <ExpenseItemForm
            key={`expense-form-instance-${formInstanceKey}`}
            reportId={activeReport.id}
            categories={categories}
            gstTreatments={gstTreatments}
            gstRates={gstRates}
            initialItem={editingItem as any}
            onSave={handleSaveItem}
            onCancel={activeReport.items.length > 0 ? () => setStage("SUMMARY") : undefined}
            isLoading={isSavingItem}
          />
        </div>
      )}

      {/* STAGE 3: Review Tag Summary */}
      {stage === "SUMMARY" && activeReport && (
        <TagSummaryView
          report={activeReport}
          onAddAnother={() => {
            setEditingItem(null);
            setFormInstanceKey((k) => k + 1);
            setStage("ADD_ITEM");
          }}
          onEditItem={(item) => {
            setEditingItem(item);
            setFormInstanceKey((k) => k + 1);
            setStage("EDIT_ITEM");
          }}
          onDeleteItem={handleDeleteItem}
          onSubmitReport={handleSubmitReport}
          onSaveDraft={() => router.push(`/expenses/${activeReport.id}`)}
          isSubmitting={isSubmittingReport}
        />
      )}

      {/* Post-Save Modal: "Do you want to add another expense under this Expense Tag?" */}
      <Modal
        isOpen={showAddAnotherModal}
        onClose={() => {
          setShowAddAnotherModal(false);
          setStage("SUMMARY");
        }}
        title="Expense Item Saved Successfully"
        maxWidth="md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Do you want to add another expense under this Expense Tag?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Tag: <span className="font-semibold text-slate-700">{activeReport?.title}</span> &bull; {activeReport?.items.length} total items saved
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddAnotherModal(false);
                setStage("SUMMARY");
              }}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              NO, REVIEW EXPENSE TAG
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowAddAnotherModal(false);
                setEditingItem(null);
                setFormInstanceKey((k) => k + 1); // Force fresh form remount
                setStage("ADD_ITEM");
              }}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              YES, ADD ANOTHER
            </Button>
          </div>
        </div>
      </Modal>

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
            const found = activeReport?.items.find((i) => i.id === existingId);
            if (found) {
              setEditingItem(found);
              setFormInstanceKey((k) => k + 1);
              setStage("EDIT_ITEM");
            } else {
              setStage("SUMMARY");
            }
          }}
          onCancel={() => {
            setDuplicateModalOpen(false);
          }}
          onAddAnyway={handleOverrideDuplicate}
          isLoading={isSavingItem}
        />
      )}

      {/* Select Approver Modal for Workflow Submission */}
      {activeReport && (
        <SelectApproverModal
          isOpen={selectApproverModalOpen}
          onClose={() => setSelectApproverModalOpen(false)}
          reportId={activeReport.id}
          reportTitle={activeReport.title}
          onSuccess={(updated) => {
            setSelectApproverModalOpen(false);
            router.push(`/expenses/${activeReport.id}`);
          }}
        />
      )}
    </div>
  );
}
