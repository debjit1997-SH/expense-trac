"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getEligibleReimbursementOwnersAction, approveExpenseReportAction } from "@/actions/workflow.actions";
import { EligibleApproverUser } from "@/lib/workflow-rules";
import { CheckCircle2, ShieldAlert, AlertCircle } from "lucide-react";

interface SelectReimbursementOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  onSuccess: (updatedReport: any) => void;
}

export function SelectReimbursementOwnerModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  onSuccess,
}: SelectReimbursementOwnerModalProps) {
  const [superadmins, setSuperadmins] = useState<EligibleApproverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [primarySuperadminId, setPrimarySuperadminId] = useState<string>("");
  const [ccSuperadminIds, setCcSuperadminIds] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadSuperadmins() {
      try {
        setLoading(true);
        setError(null);
        const res = await getEligibleReimbursementOwnersAction();
        if (mounted) {
          setSuperadmins(res);
          if (res.length > 0) {
            setPrimarySuperadminId(res[0].id);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load Superadmins.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSuperadmins();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handlePrimarySelect = (id: string) => {
    setPrimarySuperadminId(id);
    setCcSuperadminIds((prev) => prev.filter((ccId) => ccId !== id));
  };

  const handleCcToggle = (id: string) => {
    if (id === primarySuperadminId) return;
    setCcSuperadminIds((prev) =>
      prev.includes(id) ? prev.filter((ccId) => ccId !== id) : [...prev, id]
    );
  };

  const handleApprove = async () => {
    if (!primarySuperadminId) {
      setError("Please select a Primary Reimbursement Owner (Superadmin).");
      return;
    }

    try {
      setIsApproving(true);
      setError(null);
      const res = await approveExpenseReportAction({
        reportId,
        primarySuperadminId,
        ccSuperadminIds,
        approvalNote: approvalNote.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to approve report.");
      } else {
        onSuccess(res.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to approve report.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve Report & Select Reimbursement Owner"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Approving Report:
          </h4>
          <p className="text-sm font-black text-slate-900">{reportTitle}</p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Optional Approval Note / Comments:
          </label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="e.g. Verified invoices against travel itinerary, approved for full disbursement"
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Loading Superadmin accounts...
          </div>
        ) : superadmins.length === 0 ? (
          <div className="py-6 text-center text-xs text-red-600 font-semibold bg-red-50 rounded-md border border-red-200">
            No active Superadmin accounts found. Please ensure at least one Superadmin exists to receive reimbursement tasks.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
              <span>Select Primary Superadmin &amp; Optional CCs:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {superadmins.length} Superadmin(s)
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
              {superadmins.map((user) => {
                const isPrimary = primarySuperadminId === user.id;
                const isCc = ccSuperadminIds.includes(user.id);

                return (
                  <div
                    key={user.id}
                    className={`p-3 flex items-center justify-between transition-colors ${
                      isPrimary
                        ? "bg-purple-50/80 border-l-4 border-purple-600"
                        : isCc
                        ? "bg-slate-50 border-l-4 border-slate-400"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isPrimary
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{user.name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200">
                            SUPERADMIN
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Primary Radio */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="primarySuperadmin"
                          checked={isPrimary}
                          onChange={() => handlePrimarySelect(user.id)}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            isPrimary ? "text-purple-700" : "text-slate-600"
                          }`}
                        >
                          Primary Owner
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
                        <span className="text-xs font-semibold text-slate-600">CC</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isApproving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApprove}
            disabled={!primarySuperadminId || superadmins.length === 0}
            isLoading={isApproving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Approve &amp; Assign to Superadmin
          </Button>
        </div>
      </div>
    </Modal>
  );
}
