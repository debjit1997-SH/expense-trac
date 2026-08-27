import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getExpenseReportByIdAction } from "@/actions/expense.actions";
import { getEligibleApprovers, getEligibleReimbursementOwners } from "@/lib/workflow-rules";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { AuditTimeline } from "@/components/common/AuditTimeline";
import { ReportActionControls } from "./ReportActionControls";
import { ReportPdfControls } from "@/components/expenses/ReportPdfControls";
import { Role, ReportStatus, WorkflowStage, AssignmentStatus, RecipientType } from "@prisma/client";
import {
  FileText,
  User,
  CheckCircle2,
  Banknote,
  Receipt,
  Layers,
  ArrowLeft,
  Calendar,
  CreditCard,
  Percent,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

interface ReportDetailPageProps {
  params: { id: string };
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let report: any;
  try {
    report = await getExpenseReportByIdAction(params.id);
  } catch (err: any) {
    if (err.message?.includes("not authorized") || err.message?.includes("not found")) {
      return (
        <div className="py-16 text-center space-y-4">
          <p className="text-base font-bold text-slate-800">{err.message}</p>
          <Link href="/expenses">
            <Button variant="outline" size="sm">
              &larr; Back to Expenses
            </Button>
          </Link>
        </div>
      );
    }
    throw err;
  }

  if (!report) notFound();

  const isOwner = report.userId === user.id;
  const isSuperAdmin = user.role === Role.SUPERADMIN;

  // Find active pending assignments
  const activeAdminAssignment = report.approvalAssignments?.find(
    (a: any) => a.stage === WorkflowStage.ADMIN_APPROVAL && a.status === AssignmentStatus.PENDING
  );
  const activeReimbursementAssignment = report.approvalAssignments?.find(
    (a: any) => a.stage === WorkflowStage.REIMBURSEMENT && a.status === AssignmentStatus.PENDING
  );

  // CC recipients for current active stage
  const currentStage =
    report.status === ReportStatus.SUBMITTED
      ? WorkflowStage.ADMIN_APPROVAL
      : report.status === ReportStatus.APPROVED
      ? WorkflowStage.REIMBURSEMENT
      : null;

  const currentRecipients = currentStage
    ? report.workflowRecipients?.filter((r: any) => r.workflowStage === currentStage) || []
    : [];

  const primaryRecipient = currentRecipients.find((r: any) => r.recipientType === RecipientType.PRIMARY);
  const ccRecipients = currentRecipients.filter((r: any) => r.recipientType === RecipientType.CC);

  const isCcRecipient = ccRecipients.some((r: any) => r.recipientUserId === user.id);

  // Load eligible reassign users if superadmin
  let eligibleReassignUsers: any[] = [];
  if (isSuperAdmin) {
    if (report.status === ReportStatus.SUBMITTED) {
      const res = await getEligibleApprovers({
        reportOwnerId: report.userId,
        reportOwnerRole: report.user.role,
      });
      eligibleReassignUsers = res.approvers;
    } else if (report.status === ReportStatus.APPROVED) {
      eligibleReassignUsers = await getEligibleReimbursementOwners();
    }
  }

  const advanceAdjustedAmount =
    Number(report.advanceAdjustedAmount) ||
    (report.advanceAllocation ? Number(report.advanceAllocation.allocatedAmount) : 0);
  const netPayableAmount =
    report.netPayableAmount !== undefined && report.netPayableAmount !== null
      ? Number(report.netPayableAmount)
      : Math.max(0, Number(report.totalAmount) - advanceAdjustedAmount);
  const isZeroNetSettlement = netPayableAmount === 0 && advanceAdjustedAmount > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href="/expenses"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Expenses List
        </Link>
      </div>

      {/* Header Banner */}
      <Card className="shadow-sm border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/40">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-900 text-white tracking-wider">
                  {report.reportNumber}
                </span>
                <StatusBadge status={report.status} />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-2 uppercase tracking-wide">
                {report.title}
              </h1>
              {report.description && (
                <p className="text-sm text-slate-600 mt-1">{report.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Created by: <strong className="text-slate-700">{report.user.name}</strong> ({report.user.email})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Created: <DateDisplay date={report.createdAt} />
                </span>
                {report.submittedAt && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    Submitted: <DateDisplay date={report.submittedAt} />
                  </span>
                )}
              </div>

              {report.advanceAllocation?.advanceRequest && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                    Linked Company Advance:
                    <Link
                      href={`/advances/${report.advanceAllocation.advanceRequest.id}`}
                      className="ml-1.5 font-bold font-mono underline hover:text-emerald-950"
                    >
                      {report.advanceAllocation.advanceRequest.advanceNumber}
                    </Link>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col md:items-end p-4 rounded-lg bg-slate-50 border border-slate-200 shrink-0 min-w-[220px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Expense Amount
              </span>
              <span className="text-2xl font-black text-blue-700 mt-0.5">
                {formatCurrencyINR(report.totalAmount)}
              </span>

              {(advanceAdjustedAmount > 0 || report.advanceAllocation) && (
                <div className="w-full mt-2 pt-2 border-t border-slate-200 text-right space-y-0.5">
                  <div className="text-xs text-amber-700 font-medium">
                    Less Advance: -{formatCurrencyINR(advanceAdjustedAmount)}
                  </div>
                  <div className="text-xs font-extrabold text-emerald-700">
                    Net Reimbursement: {formatCurrencyINR(netPayableAmount)}
                  </div>
                </div>
              )}

              <span className="text-xs text-slate-500 mt-1">
                {report.items.length} {report.items.length === 1 ? "Item" : "Items"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approver & Workflow Responsibility Card */}
      {(primaryRecipient || activeAdminAssignment || activeReimbursementAssignment) && (
        <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
          <CardHeader className="py-3 bg-blue-100/50 border-b border-blue-200/70">
            <CardTitle className="text-xs font-bold text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                {report.status === ReportStatus.SUBMITTED
                  ? "Admin Approval Responsibility"
                  : report.status === ReportStatus.APPROVED
                  ? "Superadmin Reimbursement Responsibility"
                  : "Workflow Assignment Summary"}
              </span>
              <span className="text-[11px] font-mono font-semibold text-blue-800">
                {report.status}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 block font-medium">Primary Responsible Person:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <strong className="text-sm text-slate-900">
                    {activeAdminAssignment?.assignee?.name ||
                      activeReimbursementAssignment?.assignee?.name ||
                      primaryRecipient?.recipient?.name ||
                      "Unassigned"}
                  </strong>
                  <span className="text-[11px] text-slate-500 font-mono">
                    (
                    {activeAdminAssignment?.assignee?.email ||
                      activeReimbursementAssignment?.assignee?.email ||
                      primaryRecipient?.recipient?.email}
                    )
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-200 text-blue-800 rounded">
                    PRIMARY
                  </span>
                </div>
              </div>

              {activeAdminAssignment?.assignedAt && (
                <div className="text-right text-[11px] text-slate-500">
                  Assigned on: <DateDisplay date={activeAdminAssignment.assignedAt} />
                </div>
              )}
            </div>

            {/* CC Recipients List */}
            {ccRecipients.length > 0 && (
              <div className="pt-2 border-t border-blue-200/50">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  CC Notification Recipients ({ccRecipients.length}):
                </span>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {ccRecipients.map((cc: any) => (
                    <span
                      key={cc.id}
                      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                    >
                      {cc.recipient?.name} ({cc.recipient?.email})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review & Reimbursement Metadata if Approved or Reimbursed */}
      {(report.approvedAt || report.reimbursedAt) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.approvedAt && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-emerald-900 uppercase">Approved by Administrator</p>
                  <p className="text-slate-600">
                    Reviewer: <span className="font-semibold text-slate-800">{report.approvedBy?.name || "Admin"}</span> ({report.approvedBy?.email})
                  </p>
                  <p className="text-slate-500">
                    Approved On: <DateDisplay date={report.approvedAt} />
                  </p>
                  {report.approvalNote && (
                    <p className="italic text-slate-700 mt-1 bg-white p-2 rounded border border-emerald-200">
                      &ldquo;{report.approvalNote}&rdquo;
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {report.reimbursedAt && (
            <Card className={isZeroNetSettlement ? "border-emerald-200 bg-emerald-50/30" : "border-purple-200 bg-purple-50/30"}>
              <CardContent className="p-4 flex items-start gap-3">
                {isZeroNetSettlement ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Banknote className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-0.5">
                  <p className={`font-bold uppercase ${isZeroNetSettlement ? "text-emerald-900" : "text-purple-900"}`}>
                    {isZeroNetSettlement ? "Advance Settlement Completed" : "Reimbursement Disbursed"}
                  </p>
                  <p className="text-slate-600">
                    Processed by: <span className="font-semibold text-slate-800">{report.reimbursedBy?.name || "Superadmin"}</span>
                  </p>
                  <p className="text-slate-500">
                    Settled On: <DateDisplay date={report.reimbursedAt} />
                  </p>
                  {isZeroNetSettlement ? (
                    <>
                      <p className="text-emerald-800 font-bold mt-1">
                        Settlement: Fully adjusted against advance
                      </p>
                      <p className="text-slate-700 font-semibold">
                        Amount paid to employee: <span className="font-mono font-bold text-slate-900">₹0.00</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-purple-900 font-bold mt-1">
                        Amount paid to employee: <span className="font-mono">{formatCurrencyINR(netPayableAmount)}</span>
                      </p>
                      {report.paymentMethod && (
                        <p className="text-slate-700 font-semibold">
                          Method: <span className="font-mono">{report.paymentMethod}</span>
                        </p>
                      )}
                      {report.reimbursementRef && (
                        <p className="font-mono text-purple-800 font-semibold">
                          Ref / UTR: {report.reimbursementRef}
                        </p>
                      )}
                      {report.transactionId && (
                        <p className="font-mono text-slate-600 text-[11px]">
                          Txn ID: {report.transactionId}
                        </p>
                      )}
                    </>
                  )}
                  {report.reimbursementNote && (
                    <p className="italic text-slate-600 mt-1">
                      &ldquo;{report.reimbursementNote}&rdquo;
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Interactive Workflow Controls */}
      <ReportActionControls
        reportId={report.id}
        status={report.status}
        reportTitle={report.title}
        totalAmount={Number(report.totalAmount)}
        itemCount={report.items.length}
        isOwner={isOwner}
        userRole={user.role}
        currentUserId={user.id}
        primaryApproverId={activeAdminAssignment?.assigneeUserId || primaryRecipient?.recipientUserId}
        primaryApproverName={activeAdminAssignment?.assignee?.name || primaryRecipient?.recipient?.name}
        isCcRecipient={isCcRecipient}
        primaryReimbursementOwnerId={activeReimbursementAssignment?.assigneeUserId}
        primaryReimbursementOwnerName={activeReimbursementAssignment?.assignee?.name}
        eligibleReassignUsers={eligibleReassignUsers}
        advanceAdjustedAmount={advanceAdjustedAmount}
        netPayableAmount={netPayableAmount}
        advanceRequestNumber={report.advanceAllocation?.advanceRequest?.advanceNumber}
      />

      {/* Versioned PDF Controls & Document History */}
      <ReportPdfControls
        reportId={report.id}
        reportStatus={report.status}
        documents={report.documents || []}
        canGenerate={report.status !== ReportStatus.DRAFT}
      />

      {/* Items Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Expense Items ({report.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-200">
            {report.items.map((item: any, idx: number) => (
              <div key={item.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        #{idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{item.vendorName}</h4>
                      {item.invoiceNumber && (
                        <span className="text-xs font-mono text-slate-500">
                          (Invoice: {item.invoiceNumber})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Expense Date: <DateDisplay date={item.expenseDate} includeTime={false} />
                      {item.invoiceDate && (
                        <> &bull; Invoice Date: <DateDisplay date={item.invoiceDate} includeTime={false} /></>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">
                      {formatCurrencyINR(item.totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 block font-medium">Category / Subcategory:</span>
                    <span className="font-bold text-slate-800 uppercase">
                      {item.category?.name} &rsaquo; {item.subcategory?.name}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 block font-medium">Business Purpose:</span>
                    <span className="text-slate-700">{item.description}</span>
                  </div>
                </div>

                {/* GST Details Box if applicable */}
                {item.gstTreatment && (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-blue-600" />
                        GST: {item.gstTreatment.name}
                        {item.gstRate && ` (${item.gstRate.label})`}
                      </span>
                      {item.taxMode && (
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-slate-200 rounded">
                          {item.taxMode === "INTRA_STATE" ? "INTRA-STATE (CGST+SGST)" : "INTER-STATE (IGST)"}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
                      {item.vendorGstin && <div>Vendor GSTIN: <strong className="font-mono">{item.vendorGstin}</strong></div>}
                      {item.taxableValue && <div>Taxable Value: <strong>{formatCurrencyINR(item.taxableValue)}</strong></div>}
                      {item.totalGstAmount && <div>Total GST: <strong className="text-blue-700">{formatCurrencyINR(item.totalGstAmount)}</strong></div>}
                      <div>ITC Status: <strong className="text-slate-800">{item.itcEligibility}</strong></div>
                    </div>
                  </div>
                )}

                {/* Evidence link */}
                {item.evidences && item.evidences.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs text-slate-500 font-medium">Attached Receipt:</span>
                    <a
                      href={`/api/storage/view?path=${encodeURIComponent(item.evidences[0].storagePath)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      {item.evidences[0].originalName} ({(item.evidences[0].fileSize / 1024).toFixed(1)} KB)
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Audit History &amp; Workflow Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <AuditTimeline logs={report.auditLogs as any} />
        </CardContent>
      </Card>
    </div>
  );
}
