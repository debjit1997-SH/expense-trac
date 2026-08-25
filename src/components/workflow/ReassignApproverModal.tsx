"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { reassignApprovalAction } from "@/actions/workflow.actions";
import { WorkflowStage, Role } from "@prisma/client";
import { UserCheck, AlertCircle, RefreshCw } from "lucide-react";

interface ReassignApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportTitle: string;
  stage: WorkflowStage;
  currentAssigneeName?: string;
  eligibleUsers: Array<{ id: string; name: string; email: string; role: Role }>;
  onSuccess: (updatedAssignment: any) => void;
}

export function ReassignApproverModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  stage,
  currentAssigneeName,
  eligibleUsers,
  onSuccess,
}: ReassignApproverModalProps) {
  const [newAssigneeUserId, setNewAssigneeUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (eligibleUsers.length > 0) {
      setNewAssigneeUserId(eligibleUsers[0].id);
    }
  }, [eligibleUsers]);

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssigneeUserId) {
      setError("Please select the new assignee.");
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please provide a mandatory reassignment reason (at least 3 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await reassignApprovalAction({
        reportId,
        stage,
        newAssigneeUserId,
        reason: reason.trim(),
      });

      if (!res.success) {
        setError(res.error || "Failed to reassign.");
      } else {
        onSuccess(res.assignment);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reassign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageTitle =
    stage === WorkflowStage.ADMIN_APPROVAL ? "Admin Primary Approver" : "Superadmin Reimbursement Owner";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reassign ${stageTitle}`}
      maxWidth="md"
    >
      <form onSubmit={handleReassign} className="space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Report:
          </h4>
          <p className="text-sm font-black text-slate-900">{reportTitle}</p>
          {currentAssigneeName && (
            <p className="text-xs text-slate-500 mt-0.5">
              Current Assignee: <strong className="text-slate-800">{currentAssigneeName}</strong>
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Select New {stageTitle} <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium"
            value={newAssigneeUserId}
            onChange={(e) => setNewAssigneeUserId(e.target.value)}
          >
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email}) - {u.role}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Mandatory Reassignment Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            required
            className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="e.g. Original reviewer on leave until next week; reassigning to expedite month-end reimbursement"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Confirm Reassignment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
