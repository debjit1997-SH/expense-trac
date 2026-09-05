"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Role, AdvanceStatus, AdvanceTransactionType } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { AdvanceStatusBadge } from "@/components/advances/AdvanceStatusBadge";
import {
  submitAdvanceRequestAction,
  approveAdvanceRequestAction,
  rejectAdvanceRequestAction,
  disburseAdvanceAction,
  recordEmployeeReturnAction,
  cancelAdvanceRequestAction,
} from "@/actions/advance.actions";
import {
  Wallet,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Banknote,
  History,
  FileText,
  Download,
  AlertCircle,
  Clock,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Ban,
} from "lucide-react";

interface AdvanceDetailProps {
  advance: any;
  currentUserId: string;
  currentUserRole: Role;
  eligibleApprovers: Array<{ id: string; name: string; email: string; role: Role; isFallback?: boolean }>;
  isFallback: boolean;
}

export function AdvanceDetailClientView({
  advance,
  currentUserId,
  currentUserRole,
  eligibleApprovers,
  isFallback,
}: AdvanceDetailProps) {
  const router = useRouter();

  const isOwner = advance.userId === currentUserId;
  const isAdmin = currentUserRole === Role.ADMIN || currentUserRole === Role.SUPERADMIN;
  const isSuperAdmin = currentUserRole === Role.SUPERADMIN;

  // Active assignment
  const pendingAssignment = advance.approvalAssignments?.find(
    (a: any) => a.status === "PENDING"
  );
  const isAssignedApprover = pendingAssignment?.assigneeUserId === currentUserId;
  const canApprove = (isAssignedApprover || isSuperAdmin) && !isOwner && advance.status === AdvanceStatus.SUBMITTED;

  // Modals state
  const [modalType, setModalType] = useState<
    "SUBMIT" | "APPROVE" | "REJECT" | "DISBURSE" | "RETURN" | "CANCEL" | null
  >(null);

  // Modal form states
  const [primaryApproverId, setPrimaryApproverId] = useState(eligibleApprovers[0]?.id || "");
  const [selectedCcIds, setSelectedCcIds] = useState<string[]>([]);
  const [approvalAmount, setApprovalAmount] = useState(
    advance.requestedAmount?.toString() || ""
  );
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Disbursement form
  const [disbursementDate, setDisbursementDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [disbursementMode, setDisbursementMode] = useState("BANK_TRANSFER");
  const [disbursementRef, setDisbursementRef] = useState("");
  const [disbursementRemark, setDisbursementRemark] = useState("");

  // Employee return form
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [returnAmount, setReturnAmount] = useState("");
  const [returnMode, setReturnMode] = useState("BANK_TRANSFER");
  const [returnRef, setReturnRef] = useState("");
  const [returnRemark, setReturnRemark] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balances = advance.computedBalances || {
    disbursedAmount: advance.disbursedAmount,
    adjustedAmount: advance.adjustedAmount,
    returnedAmount: advance.returnedAmount,
    reservedAmount: advance.reservedAmount,
    availableBalance: advance.disbursedAmount - advance.adjustedAmount - advance.returnedAmount - advance.reservedAmount,
    outstandingBalance: advance.disbursedAmount - advance.adjustedAmount - advance.returnedAmount,
  };

  const handleAction = async () => {
    setError(null);
    setLoading(true);

    try {
      if (modalType === "SUBMIT") {
        if (!primaryApproverId) throw new Error("Please select a Primary Approver.");
        const res = await submitAdvanceRequestAction({
          advanceId: advance.id,
          primaryApproverId,
          ccUserIds: selectedCcIds,
          remarks: advance.remarks,
        });
        if (!res.success) throw new Error(res.error);
      } else if (modalType === "APPROVE") {
        const amt = parseFloat(approvalAmount);
        if (isNaN(amt) || amt <= 0) throw new Error("Approved amount must be greater than zero.");
        const res = await approveAdvanceRequestAction({
          advanceId: advance.id,
          approvedAmount: amt,
          approvalNote: approvalNote || undefined,
        });
        if (!res.success) throw new Error(res.error);
      } else if (modalType === "REJECT") {
        if (!rejectionReason.trim()) throw new Error("A rejection reason is mandatory.");
        const res = await rejectAdvanceRequestAction({
          advanceId: advance.id,
          reason: rejectionReason.trim(),
        });
        if (!res.success) throw new Error(res.error);
      } else if (modalType === "DISBURSE") {
        if (!disbursementDate || !disbursementMode || !disbursementRef.trim()) {
          throw new Error("Date, payment mode, and reference are required.");
        }
        const res = await disburseAdvanceAction({
          advanceId: advance.id,
          disbursementDate,
          paymentMode: disbursementMode,
          paymentReference: disbursementRef.trim(),
          disbursementRemark: disbursementRemark || undefined,
        });
        if (!res.success) throw new Error(res.error);
      } else if (modalType === "RETURN") {
        const retAmt = parseFloat(returnAmount);
        if (isNaN(retAmt) || retAmt <= 0) throw new Error("Return amount must be greater than zero.");
        if (!returnDate || !returnMode || !returnRef.trim()) {
          throw new Error("Date, payment mode, and reference are required.");
        }
        const res = await recordEmployeeReturnAction({
          advanceId: advance.id,
          returnDate,
          returnAmount: retAmt,
          paymentMode: returnMode,
          paymentReference: returnRef.trim(),
          remark: returnRemark || undefined,
        });
        if (!res.success) throw new Error(res.error);
      } else if (modalType === "CANCEL") {
        const res = await cancelAdvanceRequestAction({
          advanceId: advance.id,
          reason: cancelReason.trim() || undefined,
        });
        if (!res.success) throw new Error(res.error);
      }

      setModalType(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/advances">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                {advance.advanceNumber}
              </h1>
              <AdvanceStatusBadge status={advance.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Requested by <span className="font-semibold text-slate-700">{advance.user.name}</span> ({advance.user.email}) on <DateDisplay date={advance.createdAt} />
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {advance.status === AdvanceStatus.DRAFT && isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalType("SUBMIT")}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for Approval
            </Button>
          )}

          {canApprove && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setApprovalAmount(advance.requestedAmount?.toString() || "");
                  setModalType("APPROVE");
                }}
                className="text-xs bg-blue-600 hover:bg-blue-700 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve Advance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalType("REJECT")}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 font-semibold"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
              </Button>
            </>
          )}

          {advance.status === AdvanceStatus.APPROVED && isSuperAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalType("DISBURSE")}
              className="text-xs bg-purple-600 hover:bg-purple-700 font-semibold"
            >
              <Banknote className="w-3.5 h-3.5 mr-1.5" /> Disburse Advance
            </Button>
          )}

          {(advance.status === AdvanceStatus.DISBURSED || advance.status === AdvanceStatus.PARTIALLY_SETTLED) && isSuperAdmin && balances.availableBalance > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReturnAmount(balances.availableBalance.toString());
                setModalType("RETURN");
              }}
              className="text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <ArrowDownRight className="w-3.5 h-3.5 mr-1.5" /> Record Return Funds
            </Button>
          )}

          {(advance.status === AdvanceStatus.DRAFT || advance.status === AdvanceStatus.SUBMITTED || advance.status === AdvanceStatus.APPROVED) && (isOwner || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalType("CANCEL")}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested</p>
          <p className="text-base font-extrabold text-slate-800 mt-1">
            {formatCurrencyINR(advance.requestedAmount)}
          </p>
        </Card>

        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {advance.status === "APPROVED" ? "Approved" : "Disbursed"}
          </p>
          <p className="text-base font-extrabold text-purple-700 mt-1">
            {formatCurrencyINR(advance.status === "APPROVED" ? advance.approvedAmount : advance.disbursedAmount)}
          </p>
        </Card>

        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expense Adjusted</p>
          <p className="text-base font-extrabold text-blue-700 mt-1">
            {formatCurrencyINR(advance.adjustedAmount)}
          </p>
        </Card>

        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Returned</p>
          <p className="text-base font-extrabold text-amber-700 mt-1">
            {formatCurrencyINR(advance.returnedAmount)}
          </p>
        </Card>

        <Card className="p-3 border-slate-200 bg-emerald-50/50 border-emerald-200">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available Balance</p>
          <p className="text-base font-extrabold text-emerald-700 mt-1">
            {formatCurrencyINR(balances.availableBalance)}
          </p>
          {Number(advance.reservedAmount) > 0 && (
            <p className="text-[10px] text-amber-700 mt-0.5">
              (₹{Number(advance.reservedAmount).toFixed(2)} reserved in submitted reports)
            </p>
          )}
        </Card>

        <Card className="p-3 border-slate-200 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-base font-extrabold text-slate-900 mt-1">
            {formatCurrencyINR(balances.outstandingBalance)}
          </p>
        </Card>
      </div>

      {/* Purpose & Metadata */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3 px-4">
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Advance Request Details & Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Business Purpose</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{advance.purpose}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Required By</p>
                <p className="text-xs font-medium text-slate-800 mt-0.5">
                  {advance.requiredByDate ? <DateDisplay date={advance.requiredByDate} /> : "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expected Settlement</p>
                <p className="text-xs font-medium text-slate-800 mt-0.5">
                  {advance.expectedSettlementDate ? <DateDisplay date={advance.expectedSettlementDate} /> : "Not specified"}
                </p>
              </div>
            </div>
          </div>

          {advance.remarks && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remarks / Itinerary</p>
              <p className="text-xs text-slate-700 mt-0.5 bg-slate-50 p-2.5 rounded border border-slate-200">{advance.remarks}</p>
            </div>
          )}

          {/* Workflow Sign-offs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submission</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900">{advance.user.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {advance.user.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{advance.user.email}</p>
              <p className="text-[11px] text-slate-400 mt-1">{advance.submittedAt ? <DateDisplay date={advance.submittedAt} /> : "Draft"}</p>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admin Approval</p>
              {advance.approvedBy ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{advance.approvedBy.name}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {advance.approvedBy.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{advance.approvedBy.email}</p>
                  <p className="text-[11px] text-slate-400 mt-1"><DateDisplay date={advance.approvedAt} /></p>
                  {advance.approvalNote && <p className="text-[11px] text-slate-600 mt-0.5 italic">"{advance.approvalNote}"</p>}
                </>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Pending Approval</p>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disbursement (Superadmin)</p>
              {advance.disbursedBy ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{advance.disbursedBy.name}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      {advance.disbursedBy.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{advance.disbursedBy.email}</p>
                  <p className="text-[11px] text-slate-400 mt-1"><DateDisplay date={advance.disbursedAt} /></p>
                  <p className="text-[11px] text-purple-700 font-mono mt-0.5">{advance.paymentMode}: {advance.paymentReference}</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Pending Disbursement</p>
              )}
            </div>
          </div>

          {/* Attached Evidence */}
          {advance.evidences && advance.evidences.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Attached Quotation / Proof</p>
              <div className="flex items-center gap-2">
                {advance.evidences.map((ev: any) => (
                  <a
                    key={ev.id}
                    href={`/api/storage/view?path=${encodeURIComponent(ev.storagePath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {ev.originalName}
                    <Download className="w-3 h-3 ml-1 text-blue-600" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {advance.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <p className="font-bold">Rejection Reason:</p>
              <p className="mt-0.5">{advance.rejectionReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Expense Reports (Settlements) */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Linked Expense Tags & Settlements ({advance.allocations?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!advance.allocations || advance.allocations.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 text-center">
              No expense reports have settled or reserved funds against this advance yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Expense Report #</th>
                    <th className="py-2.5 px-3">Expense Tag</th>
                    <th className="py-2.5 px-3">Report Total</th>
                    <th className="py-2.5 px-3">Advance Allocated</th>
                    <th className="py-2.5 px-3">Net Payable</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advance.allocations.map((alloc: any) => (
                    <tr key={alloc.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {alloc.expenseReport?.reportNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {alloc.expenseReport?.title}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700">
                        {formatCurrencyINR(alloc.expenseReport?.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-blue-700">
                        {formatCurrencyINR(alloc.allocatedAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        {formatCurrencyINR(alloc.expenseReport?.netPayableAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={alloc.status === "SETTLED" ? "success" : alloc.status === "RESERVED" ? "warning" : "secondary"}>
                          {alloc.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Link href={`/expenses/${alloc.expenseReport?.id}`}>
                          <Button size="sm" variant="outline" className="text-[11px] h-6 px-2">
                            View Report
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Ledger & Transaction Timeline */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3 px-4">
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            Financial Audit Ledger & Timeline ({advance.transactions?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!advance.transactions || advance.transactions.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 text-center">
              No financial ledger entries recorded yet. (Disbursement will initialize the ledger).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Transaction Type</th>
                    <th className="py-2.5 px-3">Amount (₹)</th>
                    <th className="py-2.5 px-3">Running Balance (₹)</th>
                    <th className="py-2.5 px-3">Performed By</th>
                    <th className="py-2.5 px-3">Payment Info / Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advance.transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                        <DateDisplay date={tx.timestamp} />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          tx.type === "DISBURSEMENT" ? "text-purple-700" : tx.type === "EXPENSE_ADJUSTMENT" ? "text-blue-700" : "text-amber-700"
                        }`}>
                          {tx.type === "DISBURSEMENT" && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {tx.type === "EXPENSE_ADJUSTMENT" && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {tx.type === "EMPLOYEE_RETURN" && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        {formatCurrencyINR(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        {formatCurrencyINR(tx.runningBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {tx.performedBy?.name} ({tx.performedBy?.role})
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{tx.remark || "-"}</div>
                        {tx.paymentMode && (
                          <div className="text-[11px] font-mono text-slate-400">
                            {tx.paymentMode}: {tx.paymentReference}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. SUBMIT MODAL */}
      {modalType === "SUBMIT" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Submit Advance Request for Approval
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Primary Approver *
              </label>
              <select
                value={primaryApproverId}
                onChange={(e) => setPrimaryApproverId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
              >
                {eligibleApprovers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email}) — {a.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-emerald-600">
                {loading ? "Submitting..." : "Confirm Submission"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. APPROVE MODAL */}
      {modalType === "APPROVE" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Approve Advance Request
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Approved Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={advance.requestedAmount}
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded font-bold"
              />
              <span className="text-[11px] text-slate-400">
                Requested: ₹{Number(advance.requestedAmount).toFixed(2)} (You can approve full or reduced amount)
              </span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Approval Note (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Reason or instructions for employee..."
                className="w-full text-xs p-2 border border-slate-300 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-blue-600">
                {loading ? "Approving..." : "Confirm Approval"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REJECT MODAL */}
      {modalType === "REJECT" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider">
              Reject Advance Request
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this request is rejected..."
                className="w-full text-xs p-2 border border-slate-300 rounded"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-red-600">
                {loading ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DISBURSE MODAL (SUPERADMIN) */}
      {modalType === "DISBURSE" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Disburse Employee Advance
            </h3>
            <p className="text-xs text-slate-500">
              Disbursing exact approved amount: <strong className="text-slate-800">₹{Number(advance.approvedAmount).toFixed(2)}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Disbursement Date *</label>
                <input
                  type="date"
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Mode *</label>
                <select
                  value={disbursementMode}
                  onChange={(e) => setDisbursementMode(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="COMPANY_CARD">Company Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Transaction Ref / UTR # *</label>
                <input
                  type="text"
                  value={disbursementRef}
                  onChange={(e) => setDisbursementRef(e.target.value)}
                  placeholder="e.g. UTR123456789"
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Disbursement Remark</label>
                <input
                  type="text"
                  value={disbursementRemark}
                  onChange={(e) => setDisbursementRemark(e.target.value)}
                  placeholder="Optional note for records"
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-purple-600">
                {loading ? "Recording..." : "Confirm Disbursement"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. RETURN MODAL (SUPERADMIN) */}
      {modalType === "RETURN" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4" /> Record Employee Returned Money
            </h3>
            <p className="text-xs text-slate-500">
              Maximum returnable available balance: <strong className="text-slate-800">₹{balances.availableBalance.toFixed(2)}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Return Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={balances.availableBalance}
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Return Date *</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Mode *</label>
                <select
                  value={returnMode}
                  onChange={(e) => setReturnMode(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reference / Receipt # *</label>
                <input
                  type="text"
                  value={returnRef}
                  onChange={(e) => setReturnRef(e.target.value)}
                  placeholder="e.g. UPI-RET-98765"
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remark</label>
                <input
                  type="text"
                  value={returnRemark}
                  onChange={(e) => setReturnRemark(e.target.value)}
                  placeholder="e.g. Unspent trip advance returned"
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-emerald-600">
                {loading ? "Recording..." : "Record Return"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CANCEL MODAL */}
      {modalType === "CANCEL" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Cancel Advance Request
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to cancel this advance request?
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full text-xs p-2 border border-slate-300 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalType(null)}>Back</Button>
              <Button variant="primary" size="sm" onClick={handleAction} disabled={loading} className="bg-red-600">
                {loading ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
