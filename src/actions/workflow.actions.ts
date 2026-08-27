"use server";

import prisma from "@/lib/db";
import { requireActiveUser, requireAdmin, requireSuperAdmin } from "@/lib/auth-utils";
import {
  ReportStatus,
  Role,
  AccountStatus,
  WorkflowStage,
  AssignmentStatus,
  RecipientType,
  AdvanceStatus,
  AdvanceAllocationStatus,
  AdvanceTransactionType,
  Prisma,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  canSubmitExpenseReport,
  canRollbackExpenseReport,
  canApproveExpenseReport,
  canReimburseExpenseReport,
  getEligibleApprovers,
  getEligibleReimbursementOwners,
} from "@/lib/workflow-rules";
import { generateExpenseReportDocument } from "@/lib/pdf/pdf-generator";

/**
 * Fetch eligible Admin Approvers for modal selection
 */
export async function getEligibleApproversAction(data: { reportId: string }) {
  const user = await requireActiveUser();
  const report = await prisma.expenseReport.findUnique({
    where: { id: data.reportId },
    select: { id: true, userId: true },
  });

  if (!report) {
    throw new Error("Expense report not found.");
  }

  return getEligibleApprovers({
    reportOwnerId: report.userId,
    reportOwnerRole: user.role,
  });
}

/**
 * Fetch eligible Superadmin Reimbursement Owners
 */
export async function getEligibleReimbursementOwnersAction() {
  await requireAdmin();
  return getEligibleReimbursementOwners();
}

/**
 * Submit a DRAFT expense report with mandatory Primary Approver and optional CCs
 */
export async function submitExpenseReportAction(data: {
  reportId: string;
  primaryApproverId?: string;
  ccUserIds?: string[];
  reason?: string;
  advanceRequestId?: string | null;
  advanceAdjustmentAmount?: number | null;
}) {
  try {
    const user = await requireActiveUser();
    const { reportId, primaryApproverId, ccUserIds = [], reason, advanceRequestId, advanceAdjustmentAmount } = data;

    if (!primaryApproverId) {
      return { success: false, error: "Please select a Primary Approver before submitting." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch report inside transaction for optimistic safety
      const report = await tx.expenseReport.findUnique({
        where: { id: reportId },
        include: {
          items: { select: { id: true } },
        },
      });

      if (!report) {
        throw new Error("Expense report not found.");
      }

      const check = canSubmitExpenseReport({
        reportOwnerId: report.userId,
        currentUserId: user.id,
        reportStatus: report.status,
        itemCount: report.items.length,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Re-verify Primary Approver in database
      const primaryApprover = await tx.user.findUnique({
        where: { id: primaryApproverId },
      });

      if (!primaryApprover || primaryApprover.status !== AccountStatus.ACTIVE) {
        throw new Error("Selected Primary Approver is invalid or inactive.");
      }

      // Normal USER cannot select Superadmin
      if (user.role === Role.USER && primaryApprover.role !== Role.ADMIN) {
        throw new Error("Normal users can only assign active Administrators as Primary Approver.");
      }

      // Self-assignment as approver is forbidden
      if (primaryApprover.id === user.id) {
        throw new Error("You cannot assign yourself as the approver of your own report.");
      }

      // Re-verify CC recipients
      const cleanCcIds = ccUserIds.filter((id) => id && id !== primaryApproverId);
      if (cleanCcIds.length > 0) {
        const validCcUsers = await tx.user.findMany({
          where: {
            id: { in: cleanCcIds },
            status: AccountStatus.ACTIVE,
          },
        });
        if (validCcUsers.length !== cleanCcIds.length) {
          throw new Error("One or more CC recipients are invalid or inactive.");
        }
      }

      // Handle Advance Linkage & Reservation
      let finalAdvanceAdjusted = new Prisma.Decimal(0.00);
      let finalNetPayable = report.totalAmount;

      if (advanceRequestId && advanceAdjustmentAmount && advanceAdjustmentAmount > 0) {
        const adv = await tx.advanceRequest.findUnique({
          where: { id: advanceRequestId },
        });

        if (!adv) {
          throw new Error("Selected advance request not found.");
        }

        if (adv.userId !== report.userId) {
          throw new Error("You can only link your own company advances.");
        }

        if (adv.status !== AdvanceStatus.DISBURSED && adv.status !== AdvanceStatus.PARTIALLY_SETTLED) {
          throw new Error(
            `Advance must be in DISBURSED or PARTIALLY_SETTLED status to link with an expense report. Current status: ${adv.status}`
          );
        }

        const requestedAdj = new Prisma.Decimal(Number(advanceAdjustmentAmount).toFixed(2));
        if (requestedAdj.gt(report.totalAmount)) {
          throw new Error(
            `Advance adjustment amount (₹${requestedAdj.toFixed(2)}) cannot exceed total expense report amount (₹${report.totalAmount.toFixed(2)}).`
          );
        }

        // Available balance = Disbursed - Adjusted - Returned - Reserved
        const available = adv.disbursedAmount
          .sub(adv.adjustedAmount)
          .sub(adv.returnedAmount)
          .sub(adv.reservedAmount);

        if (requestedAdj.gt(available)) {
          throw new Error(
            `Requested adjustment (₹${requestedAdj.toFixed(2)}) exceeds available advance balance (₹${available.toFixed(2)}).`
          );
        }

        // Upsert AdvanceAllocation in RESERVED status
        await tx.advanceAllocation.upsert({
          where: { expenseReportId: report.id },
          create: {
            advanceRequestId: adv.id,
            expenseReportId: report.id,
            allocatedAmount: requestedAdj,
            status: AdvanceAllocationStatus.RESERVED,
            reservedAt: new Date(),
          },
          update: {
            advanceRequestId: adv.id,
            allocatedAmount: requestedAdj,
            status: AdvanceAllocationStatus.RESERVED,
            reservedAt: new Date(),
            settledAt: null,
            releasedAt: null,
            releaseReason: null,
          },
        });

        // Atomically increase reserved amount on AdvanceRequest
        await tx.advanceRequest.update({
          where: { id: adv.id },
          data: {
            reservedAmount: adv.reservedAmount.add(requestedAdj),
          },
        });

        finalAdvanceAdjusted = requestedAdj;
        finalNetPayable = report.totalAmount.sub(requestedAdj);
      } else {
        // If an allocation was previously RESERVED and is now unlinked, release it
        const existingAlloc = await tx.advanceAllocation.findUnique({
          where: { expenseReportId: report.id },
        });
        if (existingAlloc && existingAlloc.status === AdvanceAllocationStatus.RESERVED) {
          const adv = await tx.advanceRequest.findUnique({
            where: { id: existingAlloc.advanceRequestId },
          });
          if (adv) {
            const newRes = adv.reservedAmount.sub(existingAlloc.allocatedAmount);
            await tx.advanceRequest.update({
              where: { id: adv.id },
              data: {
                reservedAmount: newRes.lt(0) ? new Prisma.Decimal(0) : newRes,
              },
            });
          }
          await tx.advanceAllocation.update({
            where: { id: existingAlloc.id },
            data: {
              status: AdvanceAllocationStatus.RELEASED,
              releasedAt: new Date(),
              releaseReason: "Unlinked during submission",
            },
          });
        }
      }

      // Cancel any prior pending assignments for this report
      await tx.approvalAssignment.updateMany({
        where: {
          expenseReportId: reportId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Update Report Status & Amounts
      const updated = await tx.expenseReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.SUBMITTED,
          submittedAt: new Date(),
          advanceAdjustedAmount: finalAdvanceAdjusted,
          netPayableAmount: finalNetPayable,
        },
      });

      // Create Primary Approval Assignment
      const assignment = await tx.approvalAssignment.create({
        data: {
          expenseReportId: reportId,
          stage: WorkflowStage.ADMIN_APPROVAL,
          assigneeUserId: primaryApproverId,
          assignedByUserId: user.id,
          status: AssignmentStatus.PENDING,
          assignedAt: new Date(),
        },
      });

      // Record Primary Workflow Recipient
      await tx.workflowRecipient.create({
        data: {
          expenseReportId: reportId,
          workflowStage: WorkflowStage.ADMIN_APPROVAL,
          recipientUserId: primaryApproverId,
          recipientType: RecipientType.PRIMARY,
          selectedByUserId: user.id,
        },
      });

      // Record CC Workflow Recipients
      for (const ccId of cleanCcIds) {
        await tx.workflowRecipient.create({
          data: {
            expenseReportId: reportId,
            workflowStage: WorkflowStage.ADMIN_APPROVAL,
            recipientUserId: ccId,
            recipientType: RecipientType.CC,
            selectedByUserId: user.id,
          },
        });
      }

      await logAudit({
        actorId: user.id,
        action: "EXPENSE_SUBMITTED",
        entityType: "ExpenseReport",
        entityId: report.id,
        reportId: report.id,
        previousVal: { status: ReportStatus.DRAFT },
        newVal: {
          status: ReportStatus.SUBMITTED,
          primaryApprover: primaryApprover.email,
          ccCount: cleanCcIds.length,
          advanceAdjusted: finalAdvanceAdjusted.toString(),
          netPayable: finalNetPayable.toString(),
        },
        reason: reason || "Expense report submitted for review",
        tx,
      });

      return updated;
    });

    // Generate SUBMITTED PDF document asynchronously (failure does not revert submission)
    try {
      await generateExpenseReportDocument(reportId, ReportStatus.SUBMITTED, user.id);
    } catch (pdfErr) {
      console.warn("PDF generation during submission failed:", pdfErr);
    }

    revalidatePath(`/expenses/${reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/expenses/rollback");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
    revalidatePath("/dashboard");
    return { success: true, report: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("submitExpenseReportAction error:", error);
    return { success: false, error: error.message || "Failed to submit expense report." };
  }
}

/**
 * Rollback a SUBMITTED report back to DRAFT (owner only, transactional)
 */
export async function rollbackExpenseReportAction(data: {
  reportId: string;
  reason?: string;
}) {
  try {
    const user = await requireActiveUser();
    const { reportId, reason } = data;

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        throw new Error("Expense report not found.");
      }

      const check = canRollbackExpenseReport({
        reportOwnerId: report.userId,
        currentUserId: user.id,
        reportStatus: report.status,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Release any RESERVED advance allocation
      const existingAlloc = await tx.advanceAllocation.findUnique({
        where: { expenseReportId: reportId },
      });

      if (existingAlloc && existingAlloc.status === AdvanceAllocationStatus.RESERVED) {
        const adv = await tx.advanceRequest.findUnique({
          where: { id: existingAlloc.advanceRequestId },
        });
        if (adv) {
          const newRes = adv.reservedAmount.sub(existingAlloc.allocatedAmount);
          await tx.advanceRequest.update({
            where: { id: adv.id },
            data: {
              reservedAmount: newRes.lt(0) ? new Prisma.Decimal(0) : newRes,
            },
          });
        }
        await tx.advanceAllocation.update({
          where: { id: existingAlloc.id },
          data: {
            status: AdvanceAllocationStatus.RELEASED,
            releasedAt: new Date(),
            releaseReason: reason?.trim() || "Report rolled back to DRAFT",
          },
        });
      }

      // Cancel pending approval assignments (preserving history)
      await tx.approvalAssignment.updateMany({
        where: {
          expenseReportId: reportId,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Supersede current submitted PDF documents
      await tx.expenseReportDocument.updateMany({
        where: {
          expenseReportId: reportId,
          workflowStatus: ReportStatus.SUBMITTED,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          supersededAt: new Date(),
        },
      });

      const updated = await tx.expenseReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.DRAFT,
          submittedAt: null,
          advanceAdjustedAmount: new Prisma.Decimal(0.00),
          netPayableAmount: report.totalAmount,
        },
      });

      await logAudit({
        actorId: user.id,
        action: "EXPENSE_ROLLED_BACK",
        entityType: "ExpenseReport",
        entityId: report.id,
        reportId: report.id,
        previousVal: { status: ReportStatus.SUBMITTED },
        newVal: { status: ReportStatus.DRAFT },
        reason: reason || "Owner requested rollback to draft",
        tx,
      });

      return updated;
    });

    revalidatePath(`/expenses/${reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/expenses/rollback");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
    revalidatePath("/dashboard");
    return { success: true, report: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("rollbackExpenseReportAction error:", error);
    return { success: false, error: error.message || "Failed to rollback expense report." };
  }
}

/**
 * Approve a SUBMITTED report and assign a Superadmin Reimbursement Owner
 */
export async function approveExpenseReportAction(data: {
  reportId: string;
  primarySuperadminId: string;
  ccSuperadminIds?: string[];
  approvalNote?: string;
}) {
  try {
    const reviewer = await requireAdmin();
    const { reportId, primarySuperadminId, ccSuperadminIds = [], approvalNote } = data;

    if (!primarySuperadminId) {
      return { success: false, error: "Please select a Primary Reimbursement Owner (Superadmin)." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findUnique({
        where: { id: reportId },
        include: {
          approvalAssignments: {
            where: { stage: WorkflowStage.ADMIN_APPROVAL, status: AssignmentStatus.PENDING },
          },
          workflowRecipients: {
            where: { workflowStage: WorkflowStage.ADMIN_APPROVAL },
          },
        },
      });

      if (!report) {
        throw new Error("Expense report not found.");
      }

      const activeAssignment = report.approvalAssignments[0];
      const isCc = report.workflowRecipients.some(
        (r) => r.recipientUserId === reviewer.id && r.recipientType === RecipientType.CC
      );

      const check = canApproveExpenseReport({
        reportOwnerId: report.userId,
        currentUserId: reviewer.id,
        currentUserRole: reviewer.role,
        reportStatus: report.status,
        primaryAssigneeUserId: activeAssignment?.assigneeUserId || null,
        isCcRecipient: isCc,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Re-verify Superadmin in database
      const superadmin = await tx.user.findUnique({
        where: { id: primarySuperadminId },
      });

      if (!superadmin || superadmin.role !== Role.SUPERADMIN || superadmin.status !== AccountStatus.ACTIVE) {
        throw new Error("Selected Primary Reimbursement Owner is not an active Superadmin.");
      }

      // Validate CC Superadmins
      const cleanCcIds = ccSuperadminIds.filter((id) => id && id !== primarySuperadminId);
      if (cleanCcIds.length > 0) {
        const validCcs = await tx.user.findMany({
          where: {
            id: { in: cleanCcIds },
            role: Role.SUPERADMIN,
            status: AccountStatus.ACTIVE,
          },
        });
        if (validCcs.length !== cleanCcIds.length) {
          throw new Error("One or more CC Superadmin recipients are invalid or inactive.");
        }
      }

      // Handle Advance Settlement on Report Approval
      const existingAlloc = await tx.advanceAllocation.findUnique({
        where: { expenseReportId: report.id },
        include: { advanceRequest: true },
      });

      let finalAdvanceAdjusted = report.advanceAdjustedAmount;
      let finalNetPayable = report.netPayableAmount;

      if (existingAlloc && existingAlloc.status === AdvanceAllocationStatus.RESERVED) {
        const adv = existingAlloc.advanceRequest;
        const allocAmount = existingAlloc.allocatedAmount;

        // Mark allocation SETTLED
        await tx.advanceAllocation.update({
          where: { id: existingAlloc.id },
          data: {
            status: AdvanceAllocationStatus.SETTLED,
            settledAt: new Date(),
          },
        });

        const newReserved = adv.reservedAmount.sub(allocAmount);
        const newAdjusted = adv.adjustedAmount.add(allocAmount);
        const outstanding = adv.disbursedAmount.sub(newAdjusted).sub(adv.returnedAmount);

        let newStatus: AdvanceStatus = AdvanceStatus.PARTIALLY_SETTLED;
        if (outstanding.equals(new Prisma.Decimal(0)) && newReserved.equals(new Prisma.Decimal(0))) {
          newStatus = AdvanceStatus.SETTLED;
        }

        await tx.advanceRequest.update({
          where: { id: adv.id },
          data: {
            reservedAmount: newReserved.lt(0) ? new Prisma.Decimal(0) : newReserved,
            adjustedAmount: newAdjusted,
            status: newStatus,
            finalSettledAt: newStatus === AdvanceStatus.SETTLED ? new Date() : adv.finalSettledAt,
          },
        });

        // Create Ledger Entry for EXPENSE_ADJUSTMENT
        await tx.advanceLedgerEntry.create({
          data: {
            advanceRequestId: adv.id,
            type: AdvanceTransactionType.EXPENSE_ADJUSTMENT,
            amount: allocAmount,
            runningBalance: outstanding.lt(0) ? new Prisma.Decimal(0) : outstanding,
            expenseReportId: report.id,
            performedById: reviewer.id,
            remark: `Adjusted against approved expense report ${report.reportNumber}`,
            timestamp: new Date(),
          },
        });

        finalAdvanceAdjusted = allocAmount;
        finalNetPayable = report.totalAmount.sub(allocAmount);
      }

      // Mark Admin approval assignment COMPLETED
      if (activeAssignment) {
        await tx.approvalAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      // Update Report to APPROVED
      const updated = await tx.expenseReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.APPROVED,
          approvedById: reviewer.id,
          approvedAt: new Date(),
          approvalNote: approvalNote?.trim() || null,
          advanceAdjustedAmount: finalAdvanceAdjusted,
          netPayableAmount: finalNetPayable,
        },
      });

      // Create Primary Reimbursement Assignment
      await tx.approvalAssignment.create({
        data: {
          expenseReportId: reportId,
          stage: WorkflowStage.REIMBURSEMENT,
          assigneeUserId: primarySuperadminId,
          assignedByUserId: reviewer.id,
          status: AssignmentStatus.PENDING,
          assignedAt: new Date(),
        },
      });

      // Record Primary Reimbursement Recipient
      await tx.workflowRecipient.create({
        data: {
          expenseReportId: reportId,
          workflowStage: WorkflowStage.REIMBURSEMENT,
          recipientUserId: primarySuperadminId,
          recipientType: RecipientType.PRIMARY,
          selectedByUserId: reviewer.id,
        },
      });

      // Record CC Reimbursement Recipients
      for (const ccId of cleanCcIds) {
        await tx.workflowRecipient.create({
          data: {
            expenseReportId: reportId,
            workflowStage: WorkflowStage.REIMBURSEMENT,
            recipientUserId: ccId,
            recipientType: RecipientType.CC,
            selectedByUserId: reviewer.id,
          },
        });
      }

      await logAudit({
        actorId: reviewer.id,
        action: "EXPENSE_APPROVED",
        entityType: "ExpenseReport",
        entityId: report.id,
        reportId: report.id,
        previousVal: { status: ReportStatus.SUBMITTED },
        newVal: {
          status: ReportStatus.APPROVED,
          approvedBy: reviewer.email,
          reimbursementOwnerId: primarySuperadminId,
          reimbursementOwnerEmail: superadmin.email,
          approvalNote: approvalNote?.trim(),
        },
        reason: approvalNote?.trim() || "Expense report approved by admin",
        tx,
      });

      return updated;
    });

    // Generate APPROVED PDF document
    try {
      await generateExpenseReportDocument(reportId, ReportStatus.APPROVED, reviewer.id);
    } catch (pdfErr) {
      console.warn("PDF generation during approval failed:", pdfErr);
    }

    revalidatePath(`/expenses/${reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/expenses/rollback");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
    revalidatePath("/dashboard");
    return { success: true, report: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("approveExpenseReportAction error:", error);
    return { success: false, error: error.message || "Failed to approve expense report." };
  }
}

/**
 * Mark an APPROVED report as REIMBURSED (Superadmin only)
 */
export async function reimburseExpenseReportAction(data: {
  reportId: string;
  reimbursementDate?: string;
  paymentMethod?: string;
  reimbursementRef?: string;
  transactionId?: string;
  reimbursementNote?: string;
}) {
  try {
    const superAdmin = await requireSuperAdmin();
    const { reportId, reimbursementDate, paymentMethod, reimbursementRef, transactionId, reimbursementNote } = data;

    if (!reportId) {
      return { success: false, error: "Report ID is required." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findUnique({
        where: { id: reportId },
        include: {
          advanceAllocation: {
            include: {
              advanceRequest: { select: { id: true, advanceNumber: true, status: true } },
            },
          },
          approvalAssignments: {
            where: { stage: WorkflowStage.REIMBURSEMENT, status: AssignmentStatus.PENDING },
          },
        },
      });

      if (!report) {
        throw new Error("Expense report not found.");
      }

      if (report.status !== ReportStatus.APPROVED) {
        throw new Error(`Cannot reimburse report in status ${report.status}. Report must be in APPROVED status.`);
      }

      const check = canReimburseExpenseReport({
        currentUserRole: superAdmin.role,
        reportStatus: report.status,
      });

      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Authoritative financial calculation on server
      const grossAmount = Number(report.totalAmount) || 0;
      const finalAdvanceAdjustment =
        Number(report.advanceAdjustedAmount) ||
        (report.advanceAllocation ? Number(report.advanceAllocation.allocatedAmount) : 0);
      const netPayable = Math.max(0, grossAmount - finalAdvanceAdjustment);
      const isZeroPayable = netPayable === 0;

      let effectiveDate: Date;
      let effectivePaymentMethod: string | null = null;
      let effectiveRef: string | null = null;
      let effectiveTxnId: string | null = null;
      let effectiveNote: string | null = reimbursementNote?.trim() || null;

      if (!isZeroPayable) {
        if (!reimbursementDate) {
          throw new Error("Payment / disbursement date is required for payable reimbursement.");
        }
        if (!paymentMethod || !paymentMethod.trim()) {
          throw new Error("Payment method is required for payable reimbursement.");
        }
        if (!reimbursementRef || !reimbursementRef.trim()) {
          throw new Error("Bank reference / UTR number is required for payable reimbursement.");
        }

        effectiveDate = new Date(reimbursementDate);
        effectivePaymentMethod = paymentMethod.trim();
        effectiveRef = reimbursementRef.trim();
        effectiveTxnId = transactionId?.trim() || null;
      } else {
        // Dedicated Zero-Net Settlement: no employee payment is made
        effectiveDate = reimbursementDate ? new Date(reimbursementDate) : new Date();
        effectivePaymentMethod = "ADVANCE_ADJUSTMENT";
        effectiveRef = report.advanceAllocation?.advanceRequest?.advanceNumber || "ADVANCE_ADJUSTED";
        effectiveTxnId = null;
        if (!effectiveNote) {
          effectiveNote = `Fully settled against employee company advance (${effectiveRef})`;
        }
      }

      // Mark pending Reimbursement assignment COMPLETED
      const activeAssignment = report.approvalAssignments[0];
      if (activeAssignment) {
        await tx.approvalAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      const updated = await tx.expenseReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.REIMBURSED,
          reimbursedById: superAdmin.id,
          reimbursedAt: new Date(),
          reimbursementDate: effectiveDate,
          paymentMethod: effectivePaymentMethod,
          reimbursementRef: effectiveRef,
          transactionId: effectiveTxnId,
          reimbursementNote: effectiveNote,
          advanceAdjustedAmount: finalAdvanceAdjustment,
          netPayableAmount: netPayable,
        },
      });

      await logAudit({
        actorId: superAdmin.id,
        action: "EXPENSE_REIMBURSED",
        entityType: "ExpenseReport",
        entityId: report.id,
        reportId: report.id,
        previousVal: { status: ReportStatus.APPROVED },
        newVal: {
          status: ReportStatus.REIMBURSED,
          reimbursedBy: superAdmin.email,
          reimbursementDate: effectiveDate.toISOString(),
          paymentMethod: effectivePaymentMethod,
          reimbursementRef: effectiveRef,
          transactionId: effectiveTxnId,
          reimbursementNote: effectiveNote,
          advanceAdjusted: finalAdvanceAdjustment.toString(),
          netPayable: netPayable.toString(),
          isZeroNetSettlement: isZeroPayable,
        },
        reason: effectiveNote || (isZeroPayable ? "Zero-net advance settlement finalized" : "Expense reimbursement processed"),
        tx,
      });

      return updated;
    });

    // Generate REIMBURSED PDF document
    try {
      await generateExpenseReportDocument(reportId, ReportStatus.REIMBURSED, superAdmin.id);
    } catch (pdfErr) {
      console.warn("PDF generation during reimbursement failed:", pdfErr);
    }

    revalidatePath(`/expenses/${reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/expenses/rollback");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
    revalidatePath("/dashboard");
    return { success: true, report: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("reimburseExpenseReportAction error:", error);
    return { success: false, error: error.message || "Failed to mark report as reimbursed." };
  }
}

/**
 * Superadmin Reassignment of Admin Approver or Superadmin Reimbursement Owner
 */
export async function reassignApprovalAction(data: {
  reportId: string;
  stage: WorkflowStage;
  newAssigneeUserId: string;
  reason: string;
}) {
  try {
    const superAdmin = await requireSuperAdmin();
    const { reportId, stage, newAssigneeUserId, reason } = data;

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "A mandatory reassignment reason of at least 3 characters is required." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.findUnique({
        where: { id: reportId },
        include: {
          approvalAssignments: {
            where: { stage, status: AssignmentStatus.PENDING },
          },
        },
      });

      if (!report) {
        throw new Error("Expense report not found.");
      }

      const newAssignee = await tx.user.findUnique({
        where: { id: newAssigneeUserId },
      });

      if (!newAssignee || newAssignee.status !== AccountStatus.ACTIVE) {
        throw new Error("New assignee user is invalid or inactive.");
      }

      if (stage === WorkflowStage.ADMIN_APPROVAL && newAssignee.role !== Role.ADMIN && newAssignee.role !== Role.SUPERADMIN) {
        throw new Error("Approval stage assignee must be an Admin or Superadmin.");
      }

      if (stage === WorkflowStage.REIMBURSEMENT && newAssignee.role !== Role.SUPERADMIN) {
        throw new Error("Reimbursement stage assignee must be a Superadmin.");
      }

      const currentAssignment = report.approvalAssignments[0];

      if (currentAssignment) {
        await tx.approvalAssignment.update({
          where: { id: currentAssignment.id },
          data: {
            status: AssignmentStatus.REASSIGNED,
            cancelledAt: new Date(),
            reassignmentReason: reason.trim(),
          },
        });
      }

      const newAssignment = await tx.approvalAssignment.create({
        data: {
          expenseReportId: reportId,
          stage,
          assigneeUserId: newAssigneeUserId,
          assignedByUserId: superAdmin.id,
          status: AssignmentStatus.PENDING,
          assignedAt: new Date(),
          reassignedFromId: currentAssignment?.id || null,
          reassignmentReason: reason.trim(),
        },
      });

      // Update primary workflow recipient
      await tx.workflowRecipient.deleteMany({
        where: {
          expenseReportId: reportId,
          workflowStage: stage,
          recipientType: RecipientType.PRIMARY,
        },
      });

      await tx.workflowRecipient.create({
        data: {
          expenseReportId: reportId,
          workflowStage: stage,
          recipientUserId: newAssigneeUserId,
          recipientType: RecipientType.PRIMARY,
          selectedByUserId: superAdmin.id,
        },
      });

      await logAudit({
        actorId: superAdmin.id,
        action: stage === WorkflowStage.ADMIN_APPROVAL ? "APPROVER_REASSIGNED" : "REIMBURSEMENT_OWNER_REASSIGNED",
        entityType: "ApprovalAssignment",
        entityId: newAssignment.id,
        reportId: report.id,
        previousVal: currentAssignment ? { assigneeUserId: currentAssignment.assigneeUserId } : null,
        newVal: { assigneeUserId: newAssigneeUserId, assigneeEmail: newAssignee.email, stage },
        reason: reason.trim(),
        tx,
      });

      return newAssignment;
    });

    revalidatePath(`/expenses/${reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
    return { success: true, assignment: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error("reassignApprovalAction error:", error);
    return { success: false, error: error.message || "Failed to reassign." };
  }
}

/**
 * Get Reports for Admin Approval Inbox
 */
export async function getAdminApprovalInboxAction(
  tab: "ASSIGNED_TO_ME" | "ALL_SUBMITTED" | "APPROVED_BY_ME" | "UNASSIGNED" = "ASSIGNED_TO_ME"
) {
  const user = await requireAdmin();

  let whereClause: Prisma.ExpenseReportWhereInput = {};

  if (tab === "ASSIGNED_TO_ME") {
    whereClause = {
      status: ReportStatus.SUBMITTED,
      approvalAssignments: {
        some: {
          stage: WorkflowStage.ADMIN_APPROVAL,
          status: AssignmentStatus.PENDING,
          assigneeUserId: user.id,
        },
      },
    };
  } else if (tab === "ALL_SUBMITTED") {
    whereClause = {
      status: ReportStatus.SUBMITTED,
    };
  } else if (tab === "APPROVED_BY_ME") {
    whereClause = {
      approvedById: user.id,
    };
  } else if (tab === "UNASSIGNED") {
    whereClause = {
      status: ReportStatus.SUBMITTED,
      approvalAssignments: {
        none: {
          stage: WorkflowStage.ADMIN_APPROVAL,
          status: AssignmentStatus.PENDING,
        },
      },
    };
  }

  const reports = await prisma.expenseReport.findMany({
    where: whereClause,
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      approvalAssignments: {
        where: { stage: WorkflowStage.ADMIN_APPROVAL, status: AssignmentStatus.PENDING },
        include: { assignee: { select: { id: true, name: true, email: true, role: true } } },
      },
      workflowRecipients: {
        where: { workflowStage: WorkflowStage.ADMIN_APPROVAL },
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
      advanceAllocation: {
        include: {
          advanceRequest: { select: { id: true, advanceNumber: true, status: true } },
        },
      },
      items: {
        select: { id: true, totalAmount: true, totalGstAmount: true },
      },
      _count: { select: { items: true, evidences: true } },
    },
  });

  return JSON.parse(JSON.stringify(reports));
}

/**
 * Get Reports for Superadmin Reimbursement Inbox
 */
export async function getSuperadminReimbursementInboxAction(
  tab: "ASSIGNED_TO_ME" | "ALL_APPROVED" | "REIMBURSED" | "UNASSIGNED" = "ASSIGNED_TO_ME"
) {
  const user = await requireSuperAdmin();

  let whereClause: Prisma.ExpenseReportWhereInput = {};

  if (tab === "ASSIGNED_TO_ME") {
    whereClause = {
      status: ReportStatus.APPROVED,
      approvalAssignments: {
        some: {
          stage: WorkflowStage.REIMBURSEMENT,
          status: AssignmentStatus.PENDING,
          assigneeUserId: user.id,
        },
      },
    };
  } else if (tab === "ALL_APPROVED") {
    whereClause = {
      status: ReportStatus.APPROVED,
    };
  } else if (tab === "REIMBURSED") {
    whereClause = {
      status: ReportStatus.REIMBURSED,
    };
  } else if (tab === "UNASSIGNED") {
    whereClause = {
      status: ReportStatus.APPROVED,
      approvalAssignments: {
        none: {
          stage: WorkflowStage.REIMBURSEMENT,
          status: AssignmentStatus.PENDING,
        },
      },
    };
  }

  const reports = await prisma.expenseReport.findMany({
    where: whereClause,
    orderBy: { approvedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      reimbursedBy: { select: { id: true, name: true, email: true } },
      approvalAssignments: {
        where: { stage: WorkflowStage.REIMBURSEMENT, status: AssignmentStatus.PENDING },
        include: { assignee: { select: { id: true, name: true, email: true, role: true } } },
      },
      workflowRecipients: {
        where: { workflowStage: WorkflowStage.REIMBURSEMENT },
        include: { recipient: { select: { id: true, name: true, email: true } } },
      },
      advanceAllocation: {
        include: {
          advanceRequest: { select: { id: true, advanceNumber: true, status: true } },
        },
      },
      items: {
        select: { id: true, totalAmount: true, totalGstAmount: true },
      },
      _count: { select: { items: true, evidences: true } },
    },
  });

  return JSON.parse(JSON.stringify(reports));
}

/**
 * Get current user's submitted reports for the Rollback page
 */
export async function getSubmittedReportsForRollbackAction() {
  const user = await requireActiveUser();

  const reports = await prisma.expenseReport.findMany({
    where: {
      userId: user.id,
      status: ReportStatus.SUBMITTED,
    },
    orderBy: { submittedAt: "desc" },
    include: {
      _count: {
        select: { items: true, evidences: true },
      },
    },
  });

  return JSON.parse(JSON.stringify(reports));
}
