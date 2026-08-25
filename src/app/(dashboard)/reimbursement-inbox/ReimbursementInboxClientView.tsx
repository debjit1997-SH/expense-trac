"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Role, ReportStatus, WorkflowStage } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { ReimburseExpenseModal } from "@/components/workflow/ReimburseExpenseModal";
import { ReassignApproverModal } from "@/components/workflow/ReassignApproverModal";
import { getEligibleReimbursementOwnersAction } from "@/actions/workflow.actions";
import {
  Banknote,
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

interface ReimbursementInboxClientViewProps {
  initialReports: any[];
  currentTab: "ASSIGNED_TO_ME" | "ALL_APPROVED" | "REIMBURSED" | "UNASSIGNED";
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

export function ReimbursementInboxClientView({
  initialReports,
  currentTab,
  currentUser,
}: ReimbursementInboxClientViewProps) {
  const router = useRouter();

  // Reimburse modal states
  const [reimburseModalOpen, setReimburseModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Reassign modal states
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignReport, setReassignReport] = useState<any | null>(null);
  const [eligibleSuperadmins, setEligibleSuperadmins] = useState<any[]>([]);

  const handleTabChange = (tab: string) => {
    router.push(`/reimbursement-inbox?tab=${tab}`);
  };

  const handleOpenReimburse = (report: any) => {
    setSelectedReport(report);
    setReimburseModalOpen(true);
  };

  const handleOpenReassign = async (report: any) => {
    try {
      setReassignReport(report);
      const res = await getEligibleReimbursementOwnersAction();
      setEligibleSuperadmins(res);
      setReassignModalOpen(true);
    } catch (err: any) {
      alert(err.message || "Failed to load Superadmins.");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Banknote className="w-6 h-6 text-purple-600" />
            Reimbursement Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Superadmin disbursement settlement and payment tracking for approved expense tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-900 text-white rounded">
            SUPERADMIN CONSOLE
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange("ASSIGNED_TO_ME")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "ASSIGNED_TO_ME"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ASSIGNED TO ME
        </button>

        <button
          onClick={() => handleTabChange("ALL_APPROVED")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "ALL_APPROVED"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          ALL APPROVED
        </button>

        <button
          onClick={() => handleTabChange("REIMBURSED")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            currentTab === "REIMBURSED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          REIMBURSED (SETTLED)
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

      {/* Reports List */}
      {initialReports.length === 0 ? (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-16 text-center text-slate-500 text-xs">
            <Banknote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No expense reports found under &ldquo;{currentTab.replace(/_/g, " ")}&rdquo;.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initialReports.map((report) => {
            const primaryAssignment = report.approvalAssignments?.[0];
            const primaryAssignee = primaryAssignment?.assignee;
            const isAssignedToMe = primaryAssignment?.assigneeUserId === currentUser.id;

            const primaryRecipient = report.workflowRecipients?.find(
              (r: any) => r.recipientType === "PRIMARY"
            );
            const ccRecipients =
              report.workflowRecipients?.filter((r: any) => r.recipientType === "CC") || [];

            const totalGst = report.items?.reduce(
              (acc: number, curr: any) => acc + (Number(curr.totalGstAmount) || 0),
              0
            );

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
                        {isAssignedToMe && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            ASSIGNED TO YOU
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
                      {totalGst > 0 && (
                        <p className="text-[11px] text-purple-700 font-semibold">
                          GST Included: {formatCurrencyINR(totalGst)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block font-medium">Submitted By:</span>
                      <strong className="text-slate-800">{report.user?.name}</strong> ({report.user?.email})
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Approved By:</span>
                      <strong className="text-slate-800">{report.approvedBy?.name || "Admin"}</strong>
                      {report.approvedAt && (
                        <span className="block text-[11px] text-slate-400">
                          <DateDisplay date={report.approvedAt} />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Reimbursement Owner:</span>
                      {primaryAssignee ? (
                        <strong className="text-purple-900">{primaryAssignee.name}</strong>
                      ) : primaryRecipient ? (
                        <strong className="text-purple-900">{primaryRecipient.recipient?.name}</strong>
                      ) : (
                        <span className="text-amber-700 font-semibold">Unassigned</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Settlement Status:</span>
                      {report.status === ReportStatus.REIMBURSED ? (
                        <div>
                          <strong className="text-emerald-700 font-bold">REIMBURSED</strong>
                          {report.reimbursementRef && (
                            <span className="block font-mono text-[11px] text-slate-600">
                              Ref: {report.reimbursementRef}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-purple-700 font-semibold">Pending Disbursement</span>
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

                      {report.status === ReportStatus.APPROVED && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReassign(report)}
                          className="text-xs font-semibold border-purple-300 text-purple-800 hover:bg-purple-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reassign
                        </Button>
                      )}

                      {report.status === ReportStatus.APPROVED && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenReimburse(report)}
                          className="text-xs font-semibold bg-purple-600 hover:bg-purple-700"
                        >
                          <Banknote className="w-3.5 h-3.5 mr-1" /> Mark Reimbursed
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

      {/* Reimburse Modal */}
      {selectedReport && (
        <ReimburseExpenseModal
          isOpen={reimburseModalOpen}
          onClose={() => setReimburseModalOpen(false)}
          reportId={selectedReport.id}
          reportTitle={selectedReport.title}
          reportAmount={Number(selectedReport.totalAmount)}
          onSuccess={() => {
            setReimburseModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Reassign Reimbursement Owner Modal */}
      {reassignReport && (
        <ReassignApproverModal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          reportId={reassignReport.id}
          reportTitle={reassignReport.title}
          stage={WorkflowStage.REIMBURSEMENT}
          currentAssigneeName={
            reassignReport.approvalAssignments?.[0]?.assignee?.name ||
            reassignReport.workflowRecipients?.find((r: any) => r.recipientType === "PRIMARY")?.recipient?.name
          }
          eligibleUsers={eligibleSuperadmins}
          onSuccess={() => {
            setReassignModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
