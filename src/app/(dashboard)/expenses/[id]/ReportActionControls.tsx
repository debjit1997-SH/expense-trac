"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Role, ReportStatus, WorkflowStage } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SelectApproverModal } from "@/components/workflow/SelectApproverModal";
import { SelectReimbursementOwnerModal } from "@/components/workflow/SelectReimbursementOwnerModal";
import { ReimburseExpenseModal } from "@/components/workflow/ReimburseExpenseModal";
import { ReassignApproverModal } from "@/components/workflow/ReassignApproverModal";
import { rollbackExpenseReportAction } from "@/actions/workflow.actions";
import { Send, Undo2, CheckCircle2, Banknote, Edit, AlertCircle, RefreshCw, UserCheck } from "lucide-react";
import Link from "next/link";

interface ReportActionControlsProps {
  reportId: string;
  status: ReportStatus;
  reportTitle: string;
  totalAmount: number;
  itemCount: number;
  isOwner: boolean;
  userRole: Role;
  currentUserId: string;
  primaryApproverId?: string | null;
  primaryApproverName?: string | null;
  isCcRecipient?: boolean;
  primaryReimbursementOwnerId?: string | null;
  primaryReimbursementOwnerName?: string | null;
  eligibleReassignUsers?: Array<{ id: string; name: string; email: string; role: Role }>;
}

export function ReportActionControls({
  reportId,
  status,
  reportTitle,
  totalAmount,
  itemCount,
  isOwner,
  userRole,
  currentUserId,
  primaryApproverId,
  primaryApproverName,
  isCcRecipient,
  primaryReimbursementOwnerId,
  primaryReimbursementOwnerName,
  eligibleReassignUsers = [],
}: ReportActionControlsProps) {
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReimburseModal, setShowReimburseModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignStage, setReassignStage] = useState<WorkflowStage>(WorkflowStage.ADMIN_APPROVAL);

  const isAdminOrSuper = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;
  const isSuperAdmin = userRole === Role.SUPERADMIN;

  const handleRollback = async (reason?: string) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const res = await rollbackExpenseReportAction({ reportId, reason });
      if (!res.success) {
        setErrorMessage(res.error || "Failed to rollback report.");
      } else {
        setShowRollbackDialog(false);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Eligibility
  const canSubmit = status === ReportStatus.DRAFT && isOwner && itemCount > 0;
  const canEdit = status === ReportStatus.DRAFT && isOwner;
  const canRollback = status === ReportStatus.SUBMITTED && isOwner;

  // Approval eligibility:
  // Must be SUBMITTED, Admin/Superadmin, not owner, not CC-only
  // And must be assigned Primary Approver OR Superadmin
  const isAssignedApprover = primaryApproverId ? primaryApproverId === currentUserId : true;
  const canApprove =
    status === ReportStatus.SUBMITTED &&
    isAdminOrSuper &&
    !isOwner &&
    !isCcRecipient &&
    (isAssignedApprover || isSuperAdmin);

  const canReimburse = status === ReportStatus.APPROVED && isSuperAdmin;
  const canReassignApproval = status === ReportStatus.SUBMITTED && isSuperAdmin;
  const canReassignReimbursement = status === ReportStatus.APPROVED && isSuperAdmin;

  if (
    !canSubmit &&
    !canEdit &&
    !canRollback &&
    !canApprove &&
    !canReimburse &&
    !canReassignApproval &&
    !canReassignReimbursement &&
    !errorMessage
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
        {/* DRAFT Actions */}
        {canEdit && (
          <Link href={`/expenses/${reportId}/edit`}>
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit Items
            </Button>
          </Link>
        )}

        {canSubmit && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="w-3.5 h-3.5 mr-1" /> Submit for Approval
          </Button>
        )}

        {/* SUBMITTED Actions */}
        {canRollback && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRollbackDialog(true)}
            className="text-xs font-semibold border-amber-300 text-amber-800 hover:bg-amber-50"
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" /> Rollback to Draft
          </Button>
        )}

        {canReassignApproval && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReassignStage(WorkflowStage.ADMIN_APPROVAL);
              setShowReassignModal(true);
            }}
            className="text-xs font-semibold border-purple-300 text-purple-800 hover:bg-purple-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reassign Admin Approver
          </Button>
        )}

        {canApprove && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowApproveModal(true)}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Expense Report
          </Button>
        )}

        {/* Informational notices */}
        {status === ReportStatus.SUBMITTED && isOwner && isAdminOrSuper && (
          <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 italic">
            Self-approval is prohibited. Another administrator must review your report.
          </span>
        )}

        {status === ReportStatus.SUBMITTED && !isOwner && isCcRecipient && (
          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 italic">
            You are a CC notification recipient on this report (View-only).
          </span>
        )}

        {status === ReportStatus.SUBMITTED && !isOwner && !isCcRecipient && !isAssignedApprover && !isSuperAdmin && (
          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 italic">
            Assigned to {primaryApproverName || "another administrator"}.
          </span>
        )}

        {/* APPROVED Actions */}
        {canReassignReimbursement && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReassignStage(WorkflowStage.REIMBURSEMENT);
              setShowReassignModal(true);
            }}
            className="text-xs font-semibold border-purple-300 text-purple-800 hover:bg-purple-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reassign Reimbursement Owner
          </Button>
        )}

        {canReimburse && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowReimburseModal(true)}
            className="text-xs font-semibold bg-purple-600 hover:bg-purple-700"
          >
            <Banknote className="w-3.5 h-3.5 mr-1" /> Disburse &amp; Mark Reimbursed
          </Button>
        )}
      </div>

      {/* Select Approver Modal for Submission */}
      <SelectApproverModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        reportId={reportId}
        reportTitle={reportTitle}
        onSuccess={() => {
          setShowSubmitModal(false);
          router.refresh();
        }}
      />

      {/* Select Superadmin Reimbursement Owner Modal for Approval */}
      <SelectReimbursementOwnerModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        reportId={reportId}
        reportTitle={reportTitle}
        onSuccess={() => {
          setShowApproveModal(false);
          router.refresh();
        }}
      />

      {/* Reimburse Modal */}
      <ReimburseExpenseModal
        isOpen={showReimburseModal}
        onClose={() => setShowReimburseModal(false)}
        reportId={reportId}
        reportTitle={reportTitle}
        reportAmount={totalAmount}
        onSuccess={() => {
          setShowReimburseModal(false);
          router.refresh();
        }}
      />

      {/* Reassign Modal */}
      <ReassignApproverModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        reportId={reportId}
        reportTitle={reportTitle}
        stage={reassignStage}
        currentAssigneeName={
          reassignStage === WorkflowStage.ADMIN_APPROVAL
            ? primaryApproverName || undefined
            : primaryReimbursementOwnerName || undefined
        }
        eligibleUsers={eligibleReassignUsers}
        onSuccess={() => {
          setShowReassignModal(false);
          router.refresh();
        }}
      />

      {/* Rollback Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRollbackDialog}
        onClose={() => setShowRollbackDialog(false)}
        onConfirm={handleRollback}
        title="Rollback Expense Report to Draft"
        message="Rolling back this report will return it to DRAFT status and cancel pending approver assignments. You will select an approver again when re-submitting."
        confirmLabel="Rollback to Draft"
        variant="warning"
        askReason={true}
        reasonPlaceholder="Why are you rolling back this report?"
        isLoading={isProcessing}
      />
    </div>
  );
}
