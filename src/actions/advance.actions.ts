"use server";

import prisma from "@/lib/db";
import { requireActiveUser, requireAdmin, requireSuperAdmin } from "@/lib/auth-utils";
import { generateAdvanceNumber } from "@/lib/advance-number";
import {
  AdvanceStatus,
  AdvanceAllocationStatus,
  AdvanceTransactionType,
  AssignmentStatus,
  RecipientType,
  Role,
  AccountStatus,
  Prisma,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  calculateAdvanceBalances,
  getEligibleAdvanceApprovers,
  canSubmitAdvanceRequest,
  canApproveAdvanceRequest,
  canDisburseAdvance,
  canRecordEmployeeReturn,
  canCancelAdvanceRequest,
  toDecimal,
} from "@/lib/advance-rules";

/**
 * Fetch eligible Admin Approvers for Advance modal selection
 */
export async function getEligibleAdvanceApproversAction() {
  const user = await requireActiveUser();
  return getEligibleAdvanceApprovers({
    requesterId: user.id,
    requesterRole: user.role,
  });
}

/**
 * Create a new Advance Request in DRAFT state
 */
export async function createAdvanceRequestAction(data: {
  purpose: string;
  requestedAmount: number;
  requiredByDate?: string | null;
  expectedSettlementDate?: string | null;
  remarks?: string | null;
  evidence?: {
    originalName: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
  } | null;
}) {
  try {
    const user = await requireActiveUser();

    if (!data.purpose || data.purpose.trim().length === 0) {
      return { success: false, error: "Purpose is required for advance request." };
    }

    const reqAmt = Number(data.requestedAmount);
    if (!reqAmt || reqAmt <= 0 || isNaN(reqAmt)) {
      return { success: false, error: "Requested amount must be greater than zero." };
    }

    const advanceNumber = await generateAdvanceNumber();

    const advance = await prisma.$transaction(async (tx) => {
      const created = await tx.advanceRequest.create({
        data: {
          advanceNumber,
          userId: user.id,
          purpose: data.purpose.trim(),
          requestedAmount: new Prisma.Decimal(reqAmt.toFixed(2)),
          status: AdvanceStatus.DRAFT,
          requiredByDate: data.requiredByDate ? new Date(data.requiredByDate) : null,
          expectedSettlementDate: data.expectedSettlementDate ? new Date(data.expectedSettlementDate) : null,
          remarks: data.remarks?.trim() || null,
        },
      });

      if (data.evidence && data.evidence.storagePath) {
        await tx.advanceEvidence.create({
          data: {
            advanceRequestId: created.id,
            originalName: data.evidence.originalName,
            mimeType: data.evidence.mimeType,
            fileSize: data.evidence.fileSize,
            storagePath: data.evidence.storagePath,
            uploaderId: user.id,
          },
        });
      }

      await logAudit({
        actorId: user.id,
        action: "ADVANCE_DRAFT_CREATED",
        entityType: "AdvanceRequest",
        entityId: created.id,
        newVal: {
          advanceNumber,
          purpose: created.purpose,
          requestedAmount: created.requestedAmount.toString(),
        },
        reason: "Employee advance request drafted",
        tx,
      });

      return created;
    });

    revalidatePath("/advances");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(advance)) };
  } catch (error: any) {
    console.error("createAdvanceRequestAction error:", error);
    return { success: false, error: error.message || "Failed to create advance request." };
  }
}

/**
 * Submit a DRAFT advance request with mandatory Primary Approver and optional CCs
 */
export async function submitAdvanceRequestAction(data: {
  advanceId: string;
  primaryApproverId: string;
  ccUserIds?: string[];
  remarks?: string | null;
}) {
  try {
    const user = await requireActiveUser();
    const { advanceId, primaryApproverId, ccUserIds = [], remarks } = data;

    if (!primaryApproverId) {
      return { success: false, error: "Please select a Primary Approver before submitting." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const check = canSubmitAdvanceRequest({
        requesterId: advance.userId,
        currentUserId: user.id,
        status: advance.status,
        requestedAmount: advance.requestedAmount,
        primaryApproverId,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      const primaryApprover = await tx.user.findUnique({
        where: { id: primaryApproverId },
      });

      if (!primaryApprover || primaryApprover.status !== AccountStatus.ACTIVE) {
        throw new Error("Selected Primary Approver is invalid or inactive.");
      }

      if (user.role === Role.USER && primaryApprover.role !== Role.ADMIN) {
        throw new Error("Normal users can only assign active Administrators as Primary Approver.");
      }

      if (advance.userId === primaryApprover.id) {
        throw new Error("Self-approval is prohibited. Please assign another administrator.");
      }

      // Cancel any prior pending assignments
      await tx.advanceApprovalAssignment.updateMany({
        where: {
          advanceRequestId: advanceId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Create new Primary assignment
      await tx.advanceApprovalAssignment.create({
        data: {
          advanceRequestId: advanceId,
          assigneeUserId: primaryApproverId,
          assignedByUserId: user.id,
          status: AssignmentStatus.PENDING,
        },
      });

      // Clear and re-create CC recipients
      await tx.advanceWorkflowRecipient.deleteMany({
        where: { advanceRequestId: advanceId },
      });

      const uniqueCcIds = Array.from(new Set(ccUserIds)).filter(
        (id) => id !== primaryApproverId && id !== user.id
      );

      for (const ccId of uniqueCcIds) {
        await tx.advanceWorkflowRecipient.create({
          data: {
            advanceRequestId: advanceId,
            recipientUserId: ccId,
            recipientType: RecipientType.CC,
            selectedByUserId: user.id,
          },
        });
      }

      const updated = await tx.advanceRequest.update({
        where: { id: advanceId },
        data: {
          status: AdvanceStatus.SUBMITTED,
          submittedAt: new Date(),
          remarks: remarks ? remarks.trim() : advance.remarks,
        },
      });

      await logAudit({
        actorId: user.id,
        action: "ADVANCE_SUBMITTED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: { status: AdvanceStatus.DRAFT },
        newVal: {
          status: AdvanceStatus.SUBMITTED,
          primaryApprover: primaryApprover.email,
          ccCount: uniqueCcIds.length,
        },
        reason: remarks?.trim() || "Advance request submitted for approval",
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/approvals");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("submitAdvanceRequestAction error:", error);
    return { success: false, error: error.message || "Failed to submit advance request." };
  }
}

/**
 * Approve an advance request (full or partial approved amount)
 */
export async function approveAdvanceRequestAction(data: {
  advanceId: string;
  approvedAmount?: number | null;
  approvalNote?: string | null;
}) {
  try {
    const user = await requireAdmin();
    const { advanceId, approvedAmount, approvalNote } = data;

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
        include: {
          approvalAssignments: {
            where: { status: AssignmentStatus.PENDING },
          },
          workflowRecipients: true,
        },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const isCc = advance.workflowRecipients.some(
        (r) => r.recipientUserId === user.id && r.recipientType === RecipientType.CC
      );
      const pendingAssignment = advance.approvalAssignments[0];

      const check = canApproveAdvanceRequest({
        requesterId: advance.userId,
        currentUserId: user.id,
        currentUserRole: user.role,
        status: advance.status,
        primaryAssigneeUserId: pendingAssignment?.assigneeUserId,
        isCcRecipient: isCc,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Determine approved amount: defaults to requested amount if not specified
      const reqAmount = Number(advance.requestedAmount);
      let finalApprovedAmount = reqAmount;

      if (approvedAmount !== undefined && approvedAmount !== null) {
        const parsed = Number(approvedAmount);
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error("Approved amount must be greater than zero.");
        }
        if (parsed > reqAmount) {
          throw new Error(
            `Approved amount (₹${parsed.toFixed(2)}) cannot exceed requested amount (₹${reqAmount.toFixed(2)}).`
          );
        }
        finalApprovedAmount = parsed;
      }

      // Mark pending assignment COMPLETED
      if (pendingAssignment) {
        await tx.advanceApprovalAssignment.update({
          where: { id: pendingAssignment.id },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      const updated = await tx.advanceRequest.update({
        where: { id: advanceId },
        data: {
          status: AdvanceStatus.APPROVED,
          approvedAmount: new Prisma.Decimal(finalApprovedAmount.toFixed(2)),
          approvedAt: new Date(),
          approvedById: user.id,
          approvalNote: approvalNote?.trim() || null,
        },
      });

      await logAudit({
        actorId: user.id,
        action: "ADVANCE_APPROVED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: { status: AdvanceStatus.SUBMITTED, requestedAmount: reqAmount.toString() },
        newVal: {
          status: AdvanceStatus.APPROVED,
          approvedAmount: finalApprovedAmount.toString(),
          approvedBy: user.email,
          approvalNote: approvalNote?.trim() || null,
        },
        reason: approvalNote?.trim() || "Advance request approved",
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/approvals");
    revalidatePath("/advances/disbursements");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("approveAdvanceRequestAction error:", error);
    return { success: false, error: error.message || "Failed to approve advance request." };
  }
}

/**
 * Reject an advance request with mandatory reason
 */
export async function rejectAdvanceRequestAction(data: {
  advanceId: string;
  reason: string;
}) {
  try {
    const user = await requireAdmin();
    const { advanceId, reason } = data;

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "A rejection reason is required." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
        include: {
          approvalAssignments: {
            where: { status: AssignmentStatus.PENDING },
          },
          workflowRecipients: true,
        },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const isCc = advance.workflowRecipients.some(
        (r) => r.recipientUserId === user.id && r.recipientType === RecipientType.CC
      );
      const pendingAssignment = advance.approvalAssignments[0];

      const check = canApproveAdvanceRequest({
        requesterId: advance.userId,
        currentUserId: user.id,
        currentUserRole: user.role,
        status: advance.status,
        primaryAssigneeUserId: pendingAssignment?.assigneeUserId,
        isCcRecipient: isCc,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      if (pendingAssignment) {
        await tx.advanceApprovalAssignment.update({
          where: { id: pendingAssignment.id },
          data: {
            status: AssignmentStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }

      const updated = await tx.advanceRequest.update({
        where: { id: advanceId },
        data: {
          status: AdvanceStatus.REJECTED,
          rejectionReason: reason.trim(),
        },
      });

      await logAudit({
        actorId: user.id,
        action: "ADVANCE_REJECTED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: { status: AdvanceStatus.SUBMITTED },
        newVal: { status: AdvanceStatus.REJECTED, rejectionReason: reason.trim() },
        reason: reason.trim(),
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/approvals");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("rejectAdvanceRequestAction error:", error);
    return { success: false, error: error.message || "Failed to reject advance request." };
  }
}

/**
 * Superadmin Disburse Advance: Disburses exact approved amount and initializes ledger
 */
export async function disburseAdvanceAction(data: {
  advanceId: string;
  disbursementDate: string;
  paymentMode: string;
  paymentReference: string;
  disbursementRemark?: string | null;
}) {
  try {
    const superAdmin = await requireSuperAdmin();
    const { advanceId, disbursementDate, paymentMode, paymentReference, disbursementRemark } = data;

    if (!disbursementDate || !paymentMode || !paymentReference) {
      return {
        success: false,
        error: "Disbursement date, payment mode, and reference/UTR number are mandatory.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const check = canDisburseAdvance({
        requesterId: advance.userId,
        currentUserId: superAdmin.id,
        currentUserRole: superAdmin.role,
        status: advance.status,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      if (!advance.approvedAmount || Number(advance.approvedAmount) <= 0) {
        throw new Error("Advance does not have a valid approved amount.");
      }

      const approvedAmt = advance.approvedAmount;

      const updateCount = await tx.advanceRequest.updateMany({
        where: {
          id: advanceId,
          status: AdvanceStatus.APPROVED,
        },
        data: {
          status: AdvanceStatus.DISBURSED,
          disbursedAmount: approvedAmt,
          disbursedAt: new Date(),
          disbursedById: superAdmin.id,
          paymentMode: paymentMode.trim(),
          paymentReference: paymentReference.trim(),
          disbursementRemark: disbursementRemark?.trim() || null,
        },
      });

      if (updateCount.count === 0) {
        throw new Error(
          "Advance request cannot be disbursed. It may have already been disbursed or is not in APPROVED status."
        );
      }

      const updated = await tx.advanceRequest.findUniqueOrThrow({
        where: { id: advanceId },
      });

      // Create Ledger Entry for DISBURSEMENT
      await tx.advanceLedgerEntry.create({
        data: {
          advanceRequestId: advanceId,
          type: AdvanceTransactionType.DISBURSEMENT,
          amount: approvedAmt,
          runningBalance: approvedAmt,
          performedById: superAdmin.id,
          paymentMode: paymentMode.trim(),
          paymentReference: paymentReference.trim(),
          remark: disbursementRemark?.trim() || "Advance disbursed to employee",
          timestamp: new Date(disbursementDate),
        },
      });

      await logAudit({
        actorId: superAdmin.id,
        action: "ADVANCE_DISBURSED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: { status: AdvanceStatus.APPROVED },
        newVal: {
          status: AdvanceStatus.DISBURSED,
          disbursedAmount: approvedAmt.toString(),
          paymentMode: paymentMode.trim(),
          paymentReference: paymentReference.trim(),
          disbursedBy: `${superAdmin.name} (${superAdmin.role} - ${superAdmin.email})`,
          disbursedToRequesterId: advance.userId,
        },
        reason: disbursementRemark?.trim() || "Employee advance disbursed by Superadmin",
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/disbursements");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("disburseAdvanceAction error:", error);
    return { success: false, error: error.message || "Failed to disburse advance." };
  }
}

/**
 * Superadmin Record Employee Return Money
 */
export async function recordEmployeeReturnAction(data: {
  advanceId: string;
  returnDate: string;
  returnAmount: number;
  paymentMode: string;
  paymentReference: string;
  remark?: string | null;
}) {
  try {
    const superAdmin = await requireSuperAdmin();
    const { advanceId, returnDate, returnAmount, paymentMode, paymentReference, remark } = data;

    if (!returnDate || !paymentMode || !paymentReference) {
      return {
        success: false,
        error: "Return date, payment mode, and reference are required.",
      };
    }

    const retNum = Number(returnAmount);
    if (isNaN(retNum) || retNum <= 0) {
      return { success: false, error: "Return amount must be greater than zero." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const balances = calculateAdvanceBalances({
        currentStatus: advance.status,
        disbursedAmount: advance.disbursedAmount,
        adjustedAmount: advance.adjustedAmount,
        returnedAmount: advance.returnedAmount,
        reservedAmount: advance.reservedAmount,
      });

      const check = canRecordEmployeeReturn({
        currentUserRole: superAdmin.role,
        status: advance.status,
        availableBalance: balances.availableBalance,
        returnAmount: retNum,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      const newReturnedTotal = advance.returnedAmount.add(new Prisma.Decimal(retNum.toFixed(2)));
      const newBalances = calculateAdvanceBalances({
        currentStatus: advance.status,
        disbursedAmount: advance.disbursedAmount,
        adjustedAmount: advance.adjustedAmount,
        returnedAmount: newReturnedTotal,
        reservedAmount: advance.reservedAmount,
      });

      const updated = await tx.advanceRequest.update({
        where: { id: advanceId },
        data: {
          returnedAmount: newReturnedTotal,
          status: newBalances.computedStatus,
          finalSettledAt: newBalances.computedStatus === AdvanceStatus.SETTLED ? new Date() : advance.finalSettledAt,
        },
      });

      // Create Ledger Entry for EMPLOYEE_RETURN
      await tx.advanceLedgerEntry.create({
        data: {
          advanceRequestId: advanceId,
          type: AdvanceTransactionType.EMPLOYEE_RETURN,
          amount: new Prisma.Decimal(retNum.toFixed(2)),
          runningBalance: newBalances.outstandingBalance,
          performedById: superAdmin.id,
          paymentMode: paymentMode.trim(),
          paymentReference: paymentReference.trim(),
          remark: remark?.trim() || "Unused advance returned by employee",
          timestamp: new Date(returnDate),
        },
      });

      await logAudit({
        actorId: superAdmin.id,
        action: "ADVANCE_RETURN_RECORDED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: {
          returnedAmount: advance.returnedAmount.toString(),
          status: advance.status,
        },
        newVal: {
          returnedAmount: newReturnedTotal.toString(),
          status: newBalances.computedStatus,
          returnAmount: retNum.toString(),
          paymentReference,
        },
        reason: remark?.trim() || "Employee advance return recorded by Superadmin",
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/disbursements");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("recordEmployeeReturnAction error:", error);
    return { success: false, error: error.message || "Failed to record advance return." };
  }
}

/**
 * Cancel an Advance Request before disbursement
 */
export async function cancelAdvanceRequestAction(data: {
  advanceId: string;
  reason?: string | null;
}) {
  try {
    const user = await requireActiveUser();
    const { advanceId, reason } = data;

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.advanceRequest.findUnique({
        where: { id: advanceId },
      });

      if (!advance) {
        throw new Error("Advance request not found.");
      }

      const check = canCancelAdvanceRequest({
        requesterId: advance.userId,
        currentUserId: user.id,
        currentUserRole: user.role,
        status: advance.status,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Cancel any pending assignment
      await tx.advanceApprovalAssignment.updateMany({
        where: {
          advanceRequestId: advanceId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      const updated = await tx.advanceRequest.update({
        where: { id: advanceId },
        data: {
          status: AdvanceStatus.CANCELLED,
          cancellationReason: reason?.trim() || "Cancelled by user",
        },
      });

      await logAudit({
        actorId: user.id,
        action: "ADVANCE_CANCELLED",
        entityType: "AdvanceRequest",
        entityId: advance.id,
        previousVal: { status: advance.status },
        newVal: { status: AdvanceStatus.CANCELLED, cancellationReason: reason?.trim() || null },
        reason: reason?.trim() || "Advance request cancelled",
        tx,
      });

      return updated;
    });

    revalidatePath(`/advances/${advanceId}`);
    revalidatePath("/advances");
    revalidatePath("/advances/approvals");
    revalidatePath("/dashboard");
    return { success: true, advance: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("cancelAdvanceRequestAction error:", error);
    return { success: false, error: error.message || "Failed to cancel advance request." };
  }
}

/**
 * Get List of Advances with Role-based Visibility and Filters
 */
export async function getAdvancesListAction(params?: {
  status?: AdvanceStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const user = await requireActiveUser();

  const whereClause: Prisma.AdvanceRequestWhereInput = {};

  if (user.role === Role.USER) {
    whereClause.userId = user.id;
  } else if (user.role === Role.ADMIN) {
    whereClause.OR = [
      { userId: user.id },
      { status: { in: [AdvanceStatus.SUBMITTED, AdvanceStatus.APPROVED, AdvanceStatus.DISBURSED, AdvanceStatus.PARTIALLY_SETTLED, AdvanceStatus.SETTLED] } },
    ];
  } else if (user.role === Role.SUPERADMIN) {
    // Superadmin sees all
  }

  if (params?.status) {
    whereClause.status = params.status;
  }

  if (params?.search && params.search.trim() !== "") {
    const s = params.search.trim();
    whereClause.AND = [
      {
        OR: [
          { advanceNumber: { contains: s, mode: "insensitive" } },
          { purpose: { contains: s, mode: "insensitive" } },
          { user: { name: { contains: s, mode: "insensitive" } } },
        ],
      },
    ];
  }

  if (params?.fromDate || params?.toDate) {
    whereClause.createdAt = {};
    if (params.fromDate) whereClause.createdAt.gte = new Date(params.fromDate);
    if (params.toDate) {
      const end = new Date(params.toDate);
      end.setUTCHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  const advances = await prisma.advanceRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      disbursedBy: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { allocations: true, transactions: true, evidences: true } },
    },
  });

  return JSON.parse(JSON.stringify(advances));
}

/**
 * Get Full Detail of an Advance Request
 */
export async function getAdvanceDetailAction(id: string) {
  const user = await requireActiveUser();

  const advance = await prisma.advanceRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      disbursedBy: { select: { id: true, name: true, email: true, role: true } },
      evidences: {
        include: { uploader: { select: { id: true, name: true } } },
      },
      approvalAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          assignee: { select: { id: true, name: true, email: true, role: true } },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
      },
      workflowRecipients: {
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
      allocations: {
        orderBy: { createdAt: "desc" },
        include: {
          expenseReport: {
            select: {
              id: true,
              reportNumber: true,
              title: true,
              status: true,
              totalAmount: true,
              advanceAdjustedAmount: true,
              netPayableAmount: true,
              submittedAt: true,
              approvedAt: true,
              reimbursedAt: true,
            },
          },
        },
      },
      transactions: {
        orderBy: { timestamp: "desc" },
        include: {
          performedBy: { select: { id: true, name: true, email: true, role: true } },
          expenseReport: { select: { id: true, reportNumber: true, title: true } },
        },
      },
    },
  });

  if (!advance) return null;

  // IDOR & Authorization check:
  // USER can only view their own advances
  // ADMIN and SUPERADMIN can view all advances
  if (user.role === Role.USER && advance.userId !== user.id) {
    return null;
  }

  const balances = calculateAdvanceBalances({
    currentStatus: advance.status,
    disbursedAmount: advance.disbursedAmount,
    adjustedAmount: advance.adjustedAmount,
    returnedAmount: advance.returnedAmount,
    reservedAmount: advance.reservedAmount,
  });

  return JSON.parse(
    JSON.stringify({
      ...advance,
      computedBalances: balances,
    })
  );
}

/**
 * Fetch Eligible Advances for Logged-In User to link to an Expense Report
 * Only DISBURSED or PARTIALLY_SETTLED advances with available balance > 0
 */
export async function getEligibleAdvancesForExpenseAction() {
  const user = await requireActiveUser();

  const advances = await prisma.advanceRequest.findMany({
    where: {
      userId: user.id,
      status: { in: [AdvanceStatus.DISBURSED, AdvanceStatus.PARTIALLY_SETTLED] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate live available balance for each
  const eligible = advances
    .map((adv) => {
      const balances = calculateAdvanceBalances({
        currentStatus: adv.status,
        disbursedAmount: adv.disbursedAmount,
        adjustedAmount: adv.adjustedAmount,
        returnedAmount: adv.returnedAmount,
        reservedAmount: adv.reservedAmount,
      });

      return {
        id: adv.id,
        advanceNumber: adv.advanceNumber,
        purpose: adv.purpose,
        disbursedAmount: Number(adv.disbursedAmount),
        adjustedAmount: Number(adv.adjustedAmount),
        returnedAmount: Number(adv.returnedAmount),
        reservedAmount: Number(adv.reservedAmount),
        availableBalance: Number(balances.availableBalance),
        outstandingBalance: Number(balances.outstandingBalance),
        expectedSettlementDate: adv.expectedSettlementDate,
      };
    })
    .filter((a) => a.availableBalance > 0);

  return JSON.parse(JSON.stringify(eligible));
}

/**
 * Get Reports for Advance Approval Inbox
 */
export async function getAdvanceApprovalInboxAction(
  tab: "ASSIGNED_TO_ME" | "ALL_SUBMITTED" | "APPROVED_BY_ME" = "ASSIGNED_TO_ME"
) {
  const user = await requireAdmin();

  let whereClause: Prisma.AdvanceRequestWhereInput = {};

  if (tab === "ASSIGNED_TO_ME") {
    whereClause = {
      status: AdvanceStatus.SUBMITTED,
      approvalAssignments: {
        some: {
          status: AssignmentStatus.PENDING,
          assigneeUserId: user.id,
        },
      },
    };
  } else if (tab === "ALL_SUBMITTED") {
    whereClause = {
      status: AdvanceStatus.SUBMITTED,
    };
  } else if (tab === "APPROVED_BY_ME") {
    whereClause = {
      approvedById: user.id,
    };
  }

  const advances = await prisma.advanceRequest.findMany({
    where: whereClause,
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      approvalAssignments: {
        where: { status: AssignmentStatus.PENDING },
        include: { assignee: { select: { id: true, name: true, email: true, role: true } } },
      },
      workflowRecipients: {
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { evidences: true } },
    },
  });

  return JSON.parse(JSON.stringify(advances));
}

/**
 * Get Advances for Superadmin Disbursement & Settlement workspace
 */
export async function getSuperadminDisbursementInboxAction() {
  await requireSuperAdmin();

  const [pendingRaw, activeRaw, settledRaw] = await Promise.all([
    prisma.advanceRequest.findMany({
      where: { status: AdvanceStatus.APPROVED },
      orderBy: { approvedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.advanceRequest.findMany({
      where: { status: { in: [AdvanceStatus.DISBURSED, AdvanceStatus.PARTIALLY_SETTLED] } },
      orderBy: { disbursedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        disbursedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.advanceRequest.findMany({
      where: { status: AdvanceStatus.SETTLED },
      orderBy: { finalSettledAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  const pendingDisbursement = pendingRaw.map((adv) => ({
    id: adv.id,
    advanceNumber: adv.advanceNumber,
    purpose: adv.purpose,
    requestedAmount: Number(adv.requestedAmount),
    approvedAmount: Number(adv.approvedAmount ?? adv.requestedAmount),
    disbursedAmount: Number(adv.disbursedAmount),
    status: adv.status,
    requiredByDate: adv.requiredByDate ? adv.requiredByDate.toISOString() : null,
    submittedAt: adv.submittedAt ? adv.submittedAt.toISOString() : null,
    approvedAt: adv.approvedAt ? adv.approvedAt.toISOString() : null,
    approvalNote: adv.approvalNote || null,
    user: {
      id: adv.user.id,
      name: adv.user.name,
      email: adv.user.email,
      role: adv.user.role,
    },
    approvedBy: adv.approvedBy
      ? { id: adv.approvedBy.id, name: adv.approvedBy.name, email: adv.approvedBy.email }
      : null,
  }));

  const activeAdvances = activeRaw.map((adv) => {
    const balances = calculateAdvanceBalances({
      currentStatus: adv.status,
      disbursedAmount: adv.disbursedAmount,
      adjustedAmount: adv.adjustedAmount,
      returnedAmount: adv.returnedAmount,
      reservedAmount: adv.reservedAmount,
    });

    return {
      id: adv.id,
      advanceNumber: adv.advanceNumber,
      purpose: adv.purpose,
      requestedAmount: Number(adv.requestedAmount),
      approvedAmount: Number(adv.approvedAmount ?? adv.requestedAmount),
      disbursedAmount: Number(adv.disbursedAmount),
      adjustedAmount: Number(adv.adjustedAmount),
      returnedAmount: Number(adv.returnedAmount),
      reservedAmount: Number(adv.reservedAmount),
      availableBalance: Number(balances.availableBalance),
      outstandingBalance: Number(balances.outstandingBalance),
      status: adv.status,
      requiredByDate: adv.requiredByDate ? adv.requiredByDate.toISOString() : null,
      expectedSettlementDate: adv.expectedSettlementDate ? adv.expectedSettlementDate.toISOString() : null,
      disbursedAt: adv.disbursedAt ? adv.disbursedAt.toISOString() : null,
      paymentMode: adv.paymentMode || null,
      paymentReference: adv.paymentReference || null,
      user: {
        id: adv.user.id,
        name: adv.user.name,
        email: adv.user.email,
        role: adv.user.role,
      },
      approvedBy: adv.approvedBy
        ? { id: adv.approvedBy.id, name: adv.approvedBy.name, email: adv.approvedBy.email }
        : null,
      disbursedBy: adv.disbursedBy
        ? { id: adv.disbursedBy.id, name: adv.disbursedBy.name, email: adv.disbursedBy.email }
        : null,
    };
  });

  const settledAdvances = settledRaw.map((adv) => ({
    id: adv.id,
    advanceNumber: adv.advanceNumber,
    purpose: adv.purpose,
    disbursedAmount: Number(adv.disbursedAmount),
    adjustedAmount: Number(adv.adjustedAmount),
    returnedAmount: Number(adv.returnedAmount),
    status: adv.status,
    user: {
      id: adv.user.id,
      name: adv.user.name,
      email: adv.user.email,
      role: adv.user.role,
    },
  }));

  return {
    pendingDisbursement,
    activeAdvances,
    settledAdvances,
  };
}
