"use server";

import prisma from "@/lib/db";
import { requireActiveUser, verifyReportAccess } from "@/lib/auth-utils";
import { generateReportNumber } from "@/lib/report-number";
import {
  CreateExpenseTagSchema,
  ExpenseItemSchema,
  ExpenseItemInput,
} from "@/lib/validations/expense.schema";
import { Role, ReportStatus, AdvanceAllocationStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { findDuplicateExpenseItems, DuplicateCheckResult } from "@/lib/workflow-rules";

/**
 * Check if a candidate item is a potential duplicate
 */
export async function checkDuplicateExpenseItemAction(params: {
  reportId: string;
  item: {
    expenseDate: string;
    vendorName: string;
    invoiceNumber?: string | null;
    totalAmount: number;
    categoryId?: string;
    subcategoryId?: string;
    description?: string;
    storagePath?: string | null;
  };
  excludeItemId?: string;
}): Promise<DuplicateCheckResult> {
  await requireActiveUser();
  return findDuplicateExpenseItems(params);
}

/**
 * Create a new Expense Tag / Report in DRAFT state
 */
export async function createExpenseTagAction(data: {
  title: string;
  description?: string | null;
  advanceRequestId?: string | null;
}) {
  try {
    const user = await requireActiveUser();
    const validated = CreateExpenseTagSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { title, description, advanceRequestId } = validated.data;
    const reportNumber = await generateReportNumber();

    const report = await prisma.$transaction(async (tx) => {
      const rep = await tx.expenseReport.create({
        data: {
          reportNumber,
          title,
          description: description || null,
          status: ReportStatus.DRAFT,
          userId: user.id,
          totalAmount: new Prisma.Decimal(0.0),
          currency: "INR",
          ...(advanceRequestId
            ? {
                advanceAllocation: {
                  create: {
                    advanceRequestId,
                    allocatedAmount: 0,
                    status: AdvanceAllocationStatus.RESERVED,
                  },
                },
              }
            : {}),
        },
        include: {
          advanceAllocation: {
            include: {
              advanceRequest: {
                select: {
                  id: true,
                  advanceNumber: true,
                  purpose: true,
                  disbursedAmount: true,
                  adjustedAmount: true,
                  returnedAmount: true,
                  reservedAmount: true,
                },
              },
            },
          },
        },
      });

      return rep;
    });

    await logAudit({
      actorId: user.id,
      action: "EXPENSE_TAG_CREATED",
      entityType: "ExpenseReport",
      entityId: report.id,
      reportId: report.id,
      newVal: { reportNumber, title, status: ReportStatus.DRAFT, advanceRequestId },
      reason: "New expense tag initialized",
    });

    revalidatePath("/expenses");
    return { success: true, report: JSON.parse(JSON.stringify(report)) };
  } catch (error: any) {
    console.error("createExpenseTagAction error:", error);
    return { success: false, error: error.message || "Failed to create expense tag." };
  }
}

/**
 * Add an Expense Item inside an Expense Tag
 */
export async function addExpenseItemAction(
  data: ExpenseItemInput,
  options?: { allowDuplicate?: boolean; duplicateReason?: string }
) {
  try {
    const user = await requireActiveUser();
    const validated = ExpenseItemSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const itemData = validated.data;

    // Verify report ownership and status DRAFT
    const report = await verifyReportAccess(itemData.reportId, user, "EDIT");

    // Check for potential duplicate if not explicitly allowed
    if (!options?.allowDuplicate) {
      const dupCheck = await findDuplicateExpenseItems({
        reportId: report.id,
        item: {
          expenseDate: itemData.expenseDate,
          vendorName: itemData.vendorName,
          invoiceNumber: itemData.invoiceNumber,
          totalAmount: itemData.totalAmount,
          categoryId: itemData.categoryId,
          subcategoryId: itemData.subcategoryId,
          description: itemData.description,
          storagePath: itemData.evidence?.storagePath,
        },
      });

      if (dupCheck.isDuplicate) {
        return {
          success: false,
          isDuplicate: true,
          reason: dupCheck.reason,
          matchedItem: dupCheck.matchedItem,
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Expense Item
      const createdItem = await tx.expenseItem.create({
        data: {
          reportId: report.id,
          expenseDate: new Date(itemData.expenseDate),
          vendorName: itemData.vendorName,
          invoiceNumber: itemData.invoiceNumber || null,
          invoiceDate: itemData.invoiceDate ? new Date(itemData.invoiceDate) : null,
          description: itemData.description,
          categoryId: itemData.categoryId,
          subcategoryId: itemData.subcategoryId,
          totalAmount: new Prisma.Decimal(itemData.totalAmount),
          currency: itemData.currency || "INR",

          // GST fields
          gstTreatmentId: itemData.gstTreatmentId || null,
          gstRateId: itemData.gstRateId || null,
          documentType: itemData.documentType || null,
          vendorGstStatus: itemData.vendorGstStatus || null,
          vendorGstin: itemData.vendorGstin || null,
          companyGstin: itemData.companyGstin || null,
          placeOfSupply: itemData.placeOfSupply || null,
          hsnSacCode: itemData.hsnSacCode || null,
          taxableValue: itemData.taxableValue !== null && itemData.taxableValue !== undefined
            ? new Prisma.Decimal(itemData.taxableValue)
            : null,
          taxMode: itemData.taxMode || null,
          cgstRate: itemData.cgstRate !== null && itemData.cgstRate !== undefined
            ? new Prisma.Decimal(itemData.cgstRate)
            : null,
          cgstAmount: itemData.cgstAmount !== null && itemData.cgstAmount !== undefined
            ? new Prisma.Decimal(itemData.cgstAmount)
            : null,
          sgstRate: itemData.sgstRate !== null && itemData.sgstRate !== undefined
            ? new Prisma.Decimal(itemData.sgstRate)
            : null,
          sgstAmount: itemData.sgstAmount !== null && itemData.sgstAmount !== undefined
            ? new Prisma.Decimal(itemData.sgstAmount)
            : null,
          igstRate: itemData.igstRate !== null && itemData.igstRate !== undefined
            ? new Prisma.Decimal(itemData.igstRate)
            : null,
          igstAmount: itemData.igstAmount !== null && itemData.igstAmount !== undefined
            ? new Prisma.Decimal(itemData.igstAmount)
            : null,
          cessAmount: itemData.cessAmount !== null && itemData.cessAmount !== undefined
            ? new Prisma.Decimal(itemData.cessAmount)
            : null,
          totalGstAmount: itemData.totalGstAmount !== null && itemData.totalGstAmount !== undefined
            ? new Prisma.Decimal(itemData.totalGstAmount)
            : null,
          reverseCharge: Boolean(itemData.reverseCharge),
          itcEligibility: itemData.itcEligibility || "PENDING_REVIEW",
          gstRemarks: itemData.gstRemarks || null,
        },
      });

      // 2. Link Evidence if provided
      if (itemData.evidence) {
        await tx.expenseEvidence.create({
          data: {
            reportId: report.id,
            itemId: createdItem.id,
            originalName: itemData.evidence.originalName,
            mimeType: itemData.evidence.mimeType,
            fileSize: itemData.evidence.fileSize,
            storagePath: itemData.evidence.storagePath,
            uploaderId: user.id,
            ocrConfidence: itemData.evidence.ocrConfidence
              ? new Prisma.Decimal(itemData.evidence.ocrConfidence)
              : null,
            ocrRawResponse: itemData.evidence.ocrRawResponse || null,
          },
        });
      }

      // 3. Recalculate total sum from database items
      const items = await tx.expenseItem.findMany({
        where: { reportId: report.id },
        select: { totalAmount: true },
      });

      const newTotal = items.reduce(
        (acc, curr) => acc.add(curr.totalAmount),
        new Prisma.Decimal(0.0)
      );

      await tx.expenseReport.update({
        where: { id: report.id },
        data: { totalAmount: newTotal },
      });

      // 4. Audit log
      await logAudit({
        actorId: user.id,
        action: options?.allowDuplicate ? "EXPENSE_DUPLICATE_OVERRIDE" : "EXPENSE_ITEM_ADDED",
        entityType: "ExpenseItem",
        entityId: createdItem.id,
        reportId: report.id,
        newVal: {
          vendorName: createdItem.vendorName,
          amount: createdItem.totalAmount.toString(),
          invoiceNumber: createdItem.invoiceNumber,
          duplicateOverride: Boolean(options?.allowDuplicate),
        },
        reason: options?.allowDuplicate
          ? options.duplicateReason || "User confirmed adding duplicate expense item"
          : "Expense item added to report",
        tx,
      });

      return { createdItem, newTotal };
    });

    revalidatePath(`/expenses/${report.id}`);
    revalidatePath("/expenses");
    return { success: true, item: result.createdItem, totalAmount: result.newTotal };
  } catch (error: any) {
    console.error("addExpenseItemAction error:", error);
    return { success: false, error: error.message || "Failed to add expense item." };
  }
}

/**
 * Update an existing Expense Item inside a DRAFT report
 */
export async function updateExpenseItemAction(
  data: ExpenseItemInput,
  options?: { allowDuplicate?: boolean; duplicateReason?: string }
) {
  try {
    const user = await requireActiveUser();
    if (!data.id) {
      return { success: false, error: "Item ID is required for update." };
    }

    const validated = ExpenseItemSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const itemData = validated.data;
    const report = await verifyReportAccess(itemData.reportId, user, "EDIT");

    const existingItem = await prisma.expenseItem.findUnique({
      where: { id: data.id },
    });

    if (!existingItem || existingItem.reportId !== report.id) {
      return { success: false, error: "Expense item not found." };
    }

    // Check duplicate against other items in this report
    if (!options?.allowDuplicate) {
      const dupCheck = await findDuplicateExpenseItems({
        reportId: report.id,
        item: {
          expenseDate: itemData.expenseDate,
          vendorName: itemData.vendorName,
          invoiceNumber: itemData.invoiceNumber,
          totalAmount: itemData.totalAmount,
          categoryId: itemData.categoryId,
          subcategoryId: itemData.subcategoryId,
          description: itemData.description,
          storagePath: itemData.evidence?.storagePath,
        },
        excludeItemId: data.id,
      });

      if (dupCheck.isDuplicate) {
        return {
          success: false,
          isDuplicate: true,
          reason: dupCheck.reason,
          matchedItem: dupCheck.matchedItem,
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.expenseItem.update({
        where: { id: data.id },
        data: {
          expenseDate: new Date(itemData.expenseDate),
          vendorName: itemData.vendorName,
          invoiceNumber: itemData.invoiceNumber || null,
          invoiceDate: itemData.invoiceDate ? new Date(itemData.invoiceDate) : null,
          description: itemData.description,
          categoryId: itemData.categoryId,
          subcategoryId: itemData.subcategoryId,
          totalAmount: new Prisma.Decimal(itemData.totalAmount),
          currency: itemData.currency || "INR",

          // GST fields
          gstTreatmentId: itemData.gstTreatmentId || null,
          gstRateId: itemData.gstRateId || null,
          documentType: itemData.documentType || null,
          vendorGstStatus: itemData.vendorGstStatus || null,
          vendorGstin: itemData.vendorGstin || null,
          companyGstin: itemData.companyGstin || null,
          placeOfSupply: itemData.placeOfSupply || null,
          hsnSacCode: itemData.hsnSacCode || null,
          taxableValue: itemData.taxableValue !== null && itemData.taxableValue !== undefined
            ? new Prisma.Decimal(itemData.taxableValue)
            : null,
          taxMode: itemData.taxMode || null,
          cgstRate: itemData.cgstRate !== null && itemData.cgstRate !== undefined
            ? new Prisma.Decimal(itemData.cgstRate)
            : null,
          cgstAmount: itemData.cgstAmount !== null && itemData.cgstAmount !== undefined
            ? new Prisma.Decimal(itemData.cgstAmount)
            : null,
          sgstRate: itemData.sgstRate !== null && itemData.sgstRate !== undefined
            ? new Prisma.Decimal(itemData.sgstRate)
            : null,
          sgstAmount: itemData.sgstAmount !== null && itemData.sgstAmount !== undefined
            ? new Prisma.Decimal(itemData.sgstAmount)
            : null,
          igstRate: itemData.igstRate !== null && itemData.igstRate !== undefined
            ? new Prisma.Decimal(itemData.igstRate)
            : null,
          igstAmount: itemData.igstAmount !== null && itemData.igstAmount !== undefined
            ? new Prisma.Decimal(itemData.igstAmount)
            : null,
          cessAmount: itemData.cessAmount !== null && itemData.cessAmount !== undefined
            ? new Prisma.Decimal(itemData.cessAmount)
            : null,
          totalGstAmount: itemData.totalGstAmount !== null && itemData.totalGstAmount !== undefined
            ? new Prisma.Decimal(itemData.totalGstAmount)
            : null,
          reverseCharge: Boolean(itemData.reverseCharge),
          itcEligibility: itemData.itcEligibility || "PENDING_REVIEW",
          gstRemarks: itemData.gstRemarks || null,
        },
      });

      // Update evidence if provided
      if (itemData.evidence) {
        await tx.expenseEvidence.create({
          data: {
            reportId: report.id,
            itemId: updatedItem.id,
            originalName: itemData.evidence.originalName,
            mimeType: itemData.evidence.mimeType,
            fileSize: itemData.evidence.fileSize,
            storagePath: itemData.evidence.storagePath,
            uploaderId: user.id,
            ocrConfidence: itemData.evidence.ocrConfidence
              ? new Prisma.Decimal(itemData.evidence.ocrConfidence)
              : null,
            ocrRawResponse: itemData.evidence.ocrRawResponse || null,
          },
        });
      }

      // Recalculate total sum
      const items = await tx.expenseItem.findMany({
        where: { reportId: report.id },
        select: { totalAmount: true },
      });

      const newTotal = items.reduce(
        (acc, curr) => acc.add(curr.totalAmount),
        new Prisma.Decimal(0.0)
      );

      await tx.expenseReport.update({
        where: { id: report.id },
        data: { totalAmount: newTotal },
      });

      await logAudit({
        actorId: user.id,
        action: options?.allowDuplicate ? "EXPENSE_DUPLICATE_OVERRIDE" : "EXPENSE_ITEM_UPDATED",
        entityType: "ExpenseItem",
        entityId: updatedItem.id,
        reportId: report.id,
        previousVal: { amount: existingItem.totalAmount.toString(), vendor: existingItem.vendorName },
        newVal: {
          amount: updatedItem.totalAmount.toString(),
          vendor: updatedItem.vendorName,
          duplicateOverride: Boolean(options?.allowDuplicate),
        },
        reason: options?.allowDuplicate
          ? options.duplicateReason || "User confirmed updating duplicate expense item"
          : "Expense item updated",
        tx,
      });

      return { updatedItem, newTotal };
    });

    revalidatePath(`/expenses/${report.id}`);
    return { success: true, item: result.updatedItem, totalAmount: result.newTotal };
  } catch (error: any) {
    console.error("updateExpenseItemAction error:", error);
    return { success: false, error: error.message || "Failed to update expense item." };
  }
}

/**
 * Delete an item from a DRAFT report
 */
export async function deleteExpenseItemAction(data: {
  itemId: string;
  reportId: string;
}) {
  try {
    const user = await requireActiveUser();
    const { itemId, reportId } = data;

    const report = await verifyReportAccess(reportId, user, "EDIT");

    const existingItem = await prisma.expenseItem.findUnique({
      where: { id: itemId },
    });

    if (!existingItem || existingItem.reportId !== report.id) {
      return { success: false, error: "Item not found in report." };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.expenseItem.delete({
        where: { id: itemId },
      });

      // Recalculate total sum
      const remainingItems = await tx.expenseItem.findMany({
        where: { reportId: report.id },
        select: { totalAmount: true },
      });

      const newTotal = remainingItems.reduce(
        (acc, curr) => acc.add(curr.totalAmount),
        new Prisma.Decimal(0.0)
      );

      await tx.expenseReport.update({
        where: { id: report.id },
        data: { totalAmount: newTotal },
      });

      await logAudit({
        actorId: user.id,
        action: "EXPENSE_ITEM_DELETED",
        entityType: "ExpenseItem",
        entityId: itemId,
        reportId: report.id,
        previousVal: { vendor: existingItem.vendorName, amount: existingItem.totalAmount.toString() },
        tx,
      });

      return { newTotal, count: remainingItems.length };
    });

    revalidatePath(`/expenses/${report.id}`);
    return { success: true, totalAmount: result.newTotal, remainingCount: result.count };
  } catch (error: any) {
    console.error("deleteExpenseItemAction error:", error);
    return { success: false, error: error.message || "Failed to delete expense item." };
  }
}

/**
 * Get detailed Expense Report by ID
 */
export async function getExpenseReportByIdAction(reportId: string) {
  const user = await requireActiveUser();
  await verifyReportAccess(reportId, user, "VIEW");

  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, role: true },
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
      reimbursedBy: {
        select: { id: true, name: true, email: true },
      },
      items: {
        orderBy: { expenseDate: "asc" },
        include: {
          category: true,
          subcategory: true,
          gstTreatment: true,
          gstRate: true,
          evidences: true,
        },
      },
      evidences: {
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
      },
      approvalAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          assignee: { select: { id: true, name: true, email: true, role: true } },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
      },
      workflowRecipients: {
        include: {
          recipient: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      documents: {
        orderBy: { versionNumber: "desc" },
      },
      advanceAllocation: {
        include: {
          advanceRequest: {
            select: {
              id: true,
              advanceNumber: true,
              purpose: true,
              status: true,
              disbursedAmount: true,
              adjustedAmount: true,
              returnedAmount: true,
              reservedAmount: true,
            },
          },
        },
      },
      auditLogs: {
        orderBy: { timestamp: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!report) return null;
  return JSON.parse(JSON.stringify(report));
}

/**
 * Get list of reports with role-based visibility and filters
 */
export async function getExpensesListAction(params?: {
  search?: string;
  status?: ReportStatus;
  fromDate?: string;
  toDate?: string;
}) {
  const user = await requireActiveUser();

  const whereClause: Prisma.ExpenseReportWhereInput = {};

  // Role visibility enforcement:
  // USER: only own reports in every status
  // ADMIN: own drafts + own reports + other users' SUBMITTED and APPROVED
  // SUPERADMIN: own drafts + own reports + all SUBMITTED, APPROVED, REIMBURSED
  if (user.role === Role.USER) {
    whereClause.userId = user.id;
  } else if (user.role === Role.ADMIN) {
    whereClause.OR = [
      { userId: user.id },
      { status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] } },
    ];
  } else if (user.role === Role.SUPERADMIN) {
    whereClause.OR = [
      { userId: user.id },
      { status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED, ReportStatus.REIMBURSED] } },
    ];
  }

  if (params?.status) {
    whereClause.status = params.status;
  }

  if (params?.search && params.search.trim() !== "") {
    const s = params.search.trim();
    whereClause.AND = [
      {
        OR: [
          { reportNumber: { contains: s, mode: "insensitive" } },
          { title: { contains: s, mode: "insensitive" } },
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

  return prisma.expenseReport.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      advanceAllocation: {
        include: {
          advanceRequest: {
            select: { id: true, advanceNumber: true, status: true },
          },
        },
      },
      _count: {
        select: { items: true, evidences: true },
      },
    },
  });
}
