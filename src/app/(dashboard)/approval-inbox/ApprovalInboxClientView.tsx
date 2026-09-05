"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Role, ReportStatus, WorkflowStage } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { getNormalizedAdvanceSummary } from "@/lib/advance-summary";
import { SelectReimbursementOwnerModal } from "@/components/workflow/SelectReimbursementOwnerModal";
import { ReassignApproverModal } from "@/components/workflow/ReassignApproverModal";
import { getEligibleApproversAction } from "@/actions/workflow.actions";
import {
  Inbox,
  ShieldCheck,
  CheckCircle2,
  Users,
  Eye,
  FileText,
  User,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface ApprovalInboxClientViewProps {
  initialReports: any[];
  currentTab: "ASSIGNED_TO_ME" | "ALL_SUBMITTED" | "APPROVED_BY_ME" | "UNASSIGNED";
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

export function ApprovalInboxClientView({
  initialReports,
  currentTab,
  currentUser,
}: ApprovalInboxClientViewProps) {
  const router = useRouter();

  // Approve modal states
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Reassign modal states
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignReport, setReassignReport] = useState<any | null>(null);
  const [eligibleApprovers, setEligibleApprovers] = useState<any[]>([]);

  const handleTabChange = (tab: string) => {
    router.push(`/approval-inbox?tab=${tab}`);
  };

  const handleOpenApprove = (report: any) => {
    setSelectedReport(report);
    setApproveModalOpen(true);
  };

  const handleOpenReassign = async (report: any) => {
    try {
      setReassignReport(report);
      const res = await getEligibleApproversAction({ reportId: report.id });
      setEligibleApprovers(res.approvers);
      setReassignModalOpen(true);
    } catch (err: any) {
      alert(err.message || "Failed to load approvers.");
    }
  };

  const isSuperAdmin = currentUser.role === Role.SUPERADMIN;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Inbox className="w-6 h-6 text-blue-600" />
            Approval Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review, approve, and assign reimbursement responsibility for submitted expense reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-900 text-white rounded">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange("ASSIGNED_TO_ME")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "ASSIGNED_TO_ME"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ASSIGNED TO ME
        </button>

        <button
          onClick={() => handleTabChange("ALL_SUBMITTED")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "ALL_SUBMITTED"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ALL SUBMITTED
        </button>

        <button
          onClick={() => handleTabChange("APPROVED_BY_ME")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "APPROVED_BY_ME"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          APPROVED BY ME
        </button>

        <button
          onClick={() => handleTabChange("UNASSIGNED")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "UNASSIGNED"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          UNASSIGNED
        </button>
      </div>

      {/* Report List */}
      {initialReports.length === 0 ? (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-16 text-center text-slate-500 text-xs">
            <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No expense reports found under &ldquo;{currentTab.replace(/_/g, " ")}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initialReports.map((report) => {
            const isOwner = report.userId === currentUser.id;
            const primaryAssignment = report.approvalAssignments?.[0];
            const primaryAssignee = primaryAssignment?.assignee;
            const isAssignedToMe = primaryAssignment?.assigneeUserId === currentUser.id;

            const primaryRecipient = report.workflowRecipients?.find(
              (r: any) => r.recipientType === "PRIMARY"
            );
            const ccRecipients =
              report.workflowRecipients?.filter((r: any) => r.recipientType === "CC") || [];
            const isCc = ccRecipients.some((r: any) => r.recipientUserId === currentUser.id);

            const canApprove =
              report.status === ReportStatus.SUBMITTED &&
              !isOwner &&
              !isCc &&
              (isAssignedToMe || isSuperAdmin);

            const totalGst = report.items?.reduce(
              (acc: number, curr: any) => acc + (Number(curr.totalGstAmount) || 0),
              0
            );

            const advanceSummary = getNormalizedAdvanceSummary(report);

            return (
              <Card
                key={report.id}
                className="shadow-sm hover:shadow-md transition-shadow border-slate-200"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {report.reportNumber}
                        </span>
                        <StatusBadge status={report.status} />
                        {advanceSummary.hasLinkedAdvance && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                            ADVANCE: {advanceSummary.advanceNumber}
                          </span>
                        )}
                        {isAssignedToMe && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            ASSIGNED TO YOU
                          </span>
                        )}
                        {isCc && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            CC NOTIFIED
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-black text-slate-900 uppercase">
                        {report.title}
                      </h3>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        Total Amount
                      </span>
                      <p className="text-xl font-black text-slate-950 font-mono">
                        {formatCurrencyINR(report.totalAmount)}
                      </p>
                      {advanceSummary.hasLinkedAdvance ? (
                        <div className="text-right text-xs mt-1 space-y-0.5">
                          <p className="text-amber-700 font-semibold">
                            {advanceSummary.allocationLabel}: -{formatCurrencyINR(advanceSummary.allocatedAmount)}
                          </p>
                          <p className="text-emerald-700 font-black">
                            {advanceSummary.netPayableLabel}: {formatCurrencyINR(advanceSummary.expectedNetReimbursement)}
                          </p>
                        </div>
                      ) : totalGst > 0 ? (
                        <p className="text-[11px] text-blue-700 font-semibold">
                          GST Included: {formatCurrencyINR(totalGst)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-medium">Submitted By:</span>
                      <strong className="text-slate-800">{report.user?.name}</strong> ({report.user?.email})
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Submitted At:</span>
                      <DateDisplay date={report.submittedAt || report.createdAt} />
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Primary Approver:</span>
                      {primaryAssignee ? (
                        <strong className="text-blue-900">{primaryAssignee.name}</strong>
                      ) : primaryRecipient ? (
                        <strong className="text-blue-900">{primaryRecipient.recipient?.name}</strong>
                      ) : (
                        <span className="text-amber-700 font-semibold">Unassigned</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">CC Recipients:</span>
                      {ccRecipients.length > 0 ? (
                        <span className="text-slate-700">
                          {ccRecipients.map((c: any) => c.recipient?.name).join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </div>
                  </div>

                  {/* Action Controls Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-500">
                      <span>{report._count?.items || report.items?.length || 0} expense items</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/expenses/${report.id}`}>
                        <Button variant="outline" size="sm" className="text-xs font-semibold">
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Details
                        </Button>
                      </Link>

                      {isSuperAdmin && report.status === ReportStatus.SUBMITTED && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReassign(report)}
                          className="text-xs font-semibold border-purple-300 text-purple-800 hover:bg-purple-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reassign
                        </Button>
                      )}

                      {canApprove && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenApprove(report)}
                          className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Select Superadmin Reimbursement Owner Modal */}
      {selectedReport && (
        <SelectReimbursementOwnerModal
          isOpen={approveModalOpen}
          onClose={() => setApproveModalOpen(false)}
          reportId={selectedReport.id}
          reportTitle={selectedReport.title}
          onSuccess={() => {
            setApproveModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Reassign Approver Modal */}
      {reassignReport && (
        <ReassignApproverModal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          reportId={reassignReport.id}
          reportTitle={reassignReport.title}
          stage={WorkflowStage.ADMIN_APPROVAL}
          currentAssigneeName={
            reassignReport.approvalAssignments?.[0]?.assignee?.name ||
            reassignReport.workflowRecipients?.find((r: any) => r.recipientType === "PRIMARY")?.recipient?.name
          }
          eligibleUsers={eligibleApprovers}
          onSuccess={() => {
            setReassignModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
