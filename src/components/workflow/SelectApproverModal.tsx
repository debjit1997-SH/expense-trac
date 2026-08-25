"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getEligibleApproversAction, submitExpenseReportAction } from "@/actions/workflow.actions";
import { EligibleApproverUser } from "@/lib/workflow-rules";
import { ShieldCheck, UserCheck, Users, AlertCircle, AlertTriangle } from "lucide-react";

interface SelectApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  onSuccess: (updatedReport: any) => void;
}

export function SelectApproverModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  onSuccess,
}: SelectApproverModalProps) {
  const [approvers, setApprovers] = useState<EligibleApproverUser[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [primaryApproverId, setPrimaryApproverId] = useState<string>("");
  const [ccUserIds, setCcUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadApprovers() {
      try {
        setLoading(true);
        setError(null);
        const res = await getEligibleApproversAction({ reportId });
        if (mounted) {
          setApprovers(res.approvers);
          setIsFallback(res.isFallback);
          if (res.approvers.length > 0) {
            setPrimaryApproverId(res.approvers[0].id);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load approvers.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadApprovers();
    return () => {
      mounted = false;
    };
  }, [isOpen, reportId]);

  const handlePrimarySelect = (id: string) => {
    setPrimaryApproverId(id);
    // Remove from CC if it was previously checked
    setCcUserIds((prev) => prev.filter((ccId) => ccId !== id));
  };

  const handleCcToggle = (id: string) => {
    if (id === primaryApproverId) return; // Cannot be CC and Primary
    setCcUserIds((prev) =>
      prev.includes(id) ? prev.filter((ccId) => ccId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!primaryApproverId) {
      setError("Please select a Primary Approver.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await submitExpenseReportAction({
        reportId,
        primaryApproverId,
        ccUserIds,
      });

      if (!res.success) {
        setError(res.error || "Failed to submit report.");
      } else {
        onSuccess(res.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Expense Approver"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Submitting Report:
          </h4>
          <p className="text-sm font-black text-slate-900">{reportTitle}</p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isFallback && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">SUPERADMIN FALLBACK ACTIVATED:</strong>
              <p className="mt-0.5">
                No other active Administrator accounts are currently available. A Superadmin has been selected as the fallback approver.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Loading eligible approvers from server...
          </div>
        ) : approvers.length === 0 ? (
          <div className="py-6 text-center text-xs text-red-600 font-semibold bg-red-50 rounded-md border border-red-200">
            No active approvers available to review this report. Please contact system support.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-2">
              <span>Select 1 Primary Approver &amp; Optional CC Recipients:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {approvers.length} eligible account(s)
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white">
              {approvers.map((user) => {
                const isPrimary = primaryApproverId === user.id;
                const isCc = ccUserIds.includes(user.id);

                return (
                  <div
                    key={user.id}
                    className={`p-3.5 flex items-center justify-between transition-colors ${
                      isPrimary
                        ? "bg-blue-50/80 border-l-4 border-blue-600"
                        : isCc
                        ? "bg-slate-50 border-l-4 border-slate-400"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isPrimary
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{user.name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {user.role}
                          </span>
                          {user.isFallback && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              SUPERADMIN FALLBACK
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Primary Approver Radio */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="primaryApprover"
                          checked={isPrimary}
                          onChange={() => handlePrimarySelect(user.id)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            isPrimary ? "text-blue-700" : "text-slate-600"
                          }`}
                        >
                          Primary
                        </span>
                      </label>

                      {/* CC Checkbox */}
                      <label
                        className={`flex items-center gap-1.5 ${
                          isPrimary ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isCc}
                          disabled={isPrimary}
                          onChange={() => handleCcToggle(user.id)}
                          className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500 border-slate-300"
                        />
                        <span className="text-xs font-semibold text-slate-600">CC / Notify</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!primaryApproverId || approvers.length === 0}
            isLoading={isSubmitting}
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Confirm &amp; Submit For Approval
          </Button>
        </div>
      </div>
    </Modal>
  );
}
