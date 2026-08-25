import prisma from "./db";
import { ReportStatus, Role, AccountStatus, WorkflowStage, AssignmentStatus, RecipientType, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface NormalizeExpenseItemInput {
  expenseDate: Date | string;
  vendorName: string;
  invoiceNumber?: string | null;
  totalAmount: number | string | Decimal;
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  storagePath?: string | null;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedItem?: {
    id: string;
    expenseDate: Date;
    vendorName: string;
    invoiceNumber: string | null;
    totalAmount: Decimal;
    categoryId: string;
    subcategoryId: string;
    description: string;
    categoryName?: string;
    subcategoryName?: string;
    evidenceOriginalName?: string;
  };
}

export interface EligibleApproverUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isFallback?: boolean;
}

/**
 * Normalizes a string for robust duplicate comparisons:
 * - Trims leading/trailing spaces
 * - Converts to lowercase
 * - Collapses multiple internal spaces into a single space
 * - Treats null and empty strings consistently as ""
 */
export function normalizeString(val: string | null | undefined): string {
  if (!val) return "";
  return val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes date to YYYY-MM-DD string
 */
export function normalizeDateString(val: Date | string): string {
  const d = typeof val === "string" ? new Date(val) : val;
  return d.toISOString().split("T")[0];
}

/**
 * Shared Duplicate-Detection Engine:
 * Compares candidate item against all active items in the given ExpenseReport.
 */
export async function findDuplicateExpenseItems(params: {
  reportId: string;
  item: NormalizeExpenseItemInput;
  excludeItemId?: string;
}): Promise<DuplicateCheckResult> {
  const { reportId, item, excludeItemId } = params;

  const existingItems = await prisma.expenseItem.findMany({
    where: {
      reportId,
      ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
    },
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      evidences: { select: { originalName: true, storagePath: true } },
    },
  });

  if (existingItems.length === 0) {
    return { isDuplicate: false };
  }

  const candidateDateStr = normalizeDateString(item.expenseDate);
  const candidateVendor = normalizeString(item.vendorName);
  const candidateInvoice = normalizeString(item.invoiceNumber);
  const candidateDesc = normalizeString(item.description);
  const candidateAmount = new Prisma.Decimal(Number(item.totalAmount)).toFixed(2);
  const candidateStoragePath = item.storagePath?.trim() || null;

  for (const existing of existingItems) {
    const existingDateStr = normalizeDateString(existing.expenseDate);
    const existingVendor = normalizeString(existing.vendorName);
    const existingInvoice = normalizeString(existing.invoiceNumber);
    const existingDesc = normalizeString(existing.description);
    const existingAmount = existing.totalAmount.toFixed(2);

    const existingEvidence = existing.evidences[0];
    const existingStoragePath = existingEvidence?.storagePath?.trim() || null;

    // Condition 1: Uploaded receipt matches existing receipt path/hash
    if (
      candidateStoragePath &&
      existingStoragePath &&
      candidateStoragePath === existingStoragePath
    ) {
      return {
        isDuplicate: true,
        reason: "Same receipt document was already uploaded for an item in this report",
        matchedItem: {
          id: existing.id,
          expenseDate: existing.expenseDate,
          vendorName: existing.vendorName,
          invoiceNumber: existing.invoiceNumber,
          totalAmount: existing.totalAmount,
          categoryId: existing.categoryId,
          subcategoryId: existing.subcategoryId,
          description: existing.description,
          categoryName: existing.category.name,
          subcategoryName: existing.subcategory.name,
          evidenceOriginalName: existingEvidence?.originalName,
        },
      };
    }

    // Condition 2: Matching Date + Total Amount + Vendor + Invoice Number (when invoice is available)
    if (candidateInvoice && existingInvoice) {
      if (
        candidateDateStr === existingDateStr &&
        candidateAmount === existingAmount &&
        candidateVendor === existingVendor &&
        candidateInvoice === existingInvoice
      ) {
        return {
          isDuplicate: true,
          reason: `Matches existing item with same Date, Vendor (${existing.vendorName}), Amount (₹${existingAmount}), and Invoice #${existing.invoiceNumber}`,
          matchedItem: {
            id: existing.id,
            expenseDate: existing.expenseDate,
            vendorName: existing.vendorName,
            invoiceNumber: existing.invoiceNumber,
            totalAmount: existing.totalAmount,
            categoryId: existing.categoryId,
            subcategoryId: existing.subcategoryId,
            description: existing.description,
            categoryName: existing.category.name,
            subcategoryName: existing.subcategory.name,
            evidenceOriginalName: existingEvidence?.originalName,
          },
        };
      }
    }

    // Condition 3: When Invoice Number is unavailable, matching Date + Amount + Vendor + Category + Subcategory + Description
    if (
      candidateDateStr === existingDateStr &&
      candidateAmount === existingAmount &&
      candidateVendor === existingVendor &&
      (!candidateInvoice || !existingInvoice)
    ) {
      const categoryMatch = !item.categoryId || item.categoryId === existing.categoryId;
      const subcategoryMatch = !item.subcategoryId || item.subcategoryId === existing.subcategoryId;
      const descMatch = !candidateDesc || !existingDesc || candidateDesc === existingDesc;

      if (categoryMatch && subcategoryMatch && descMatch) {
        return {
          isDuplicate: true,
          reason: `Matches existing item with same Date, Vendor (${existing.vendorName}), Amount (₹${existingAmount}), and Category/Description`,
          matchedItem: {
            id: existing.id,
            expenseDate: existing.expenseDate,
            vendorName: existing.vendorName,
            invoiceNumber: existing.invoiceNumber,
            totalAmount: existing.totalAmount,
            categoryId: existing.categoryId,
            subcategoryId: existing.subcategoryId,
            description: existing.description,
            categoryName: existing.category.name,
            subcategoryName: existing.subcategory.name,
            evidenceOriginalName: existingEvidence?.originalName,
          },
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Fetch eligible Admin Approvers for a report submission
 */
export async function getEligibleApprovers(params: {
  reportOwnerId: string;
  reportOwnerRole: Role;
}): Promise<{ approvers: EligibleApproverUser[]; isFallback: boolean }> {
  const { reportOwnerId, reportOwnerRole } = params;

  if (reportOwnerRole === Role.USER) {
    // Normal USER: show all active ADMIN users (never SUPERADMIN)
    const admins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return { approvers: admins, isFallback: false };
  }

  // ADMIN or SUPERADMIN submitting their own report:
  // Show other active ADMIN users (exclude self)
  const otherAdmins = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      id: { not: reportOwnerId },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  if (otherAdmins.length > 0) {
    return { approvers: otherAdmins, isFallback: false };
  }

  // If no other active ADMIN exists, fallback to active SUPERADMINs
  const superadmins = await prisma.user.findMany({
    where: {
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
      id: { not: reportOwnerId },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  return {
    approvers: superadmins.map((s) => ({ ...s, isFallback: true })),
    isFallback: true,
  };
}

/**
 * Fetch eligible Superadmin Reimbursement Owners for Admin approval stage
 */
export async function getEligibleReimbursementOwners(): Promise<EligibleApproverUser[]> {
  const superadmins = await prisma.user.findMany({
    where: {
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return superadmins;
}

/**
 * Centralized permission rule: Can an actor submit this expense report?
 */
export function canSubmitExpenseReport(params: {
  reportOwnerId: string;
  currentUserId: string;
  reportStatus: ReportStatus;
  itemCount: number;
}): { allowed: boolean; reason?: string } {
  const { reportOwnerId, currentUserId, reportStatus, itemCount } = params;

  if (reportOwnerId !== currentUserId) {
    return { allowed: false, reason: "You can only submit your own expense reports." };
  }

  if (reportStatus !== ReportStatus.DRAFT) {
    return { allowed: false, reason: `Only DRAFT reports can be submitted. Current status is ${reportStatus}.` };
  }

  if (itemCount === 0) {
    return { allowed: false, reason: "Cannot submit an empty expense report. Add at least one expense item." };
  }

  return { allowed: true };
}

/**
 * Centralized permission rule: Can an actor rollback this expense report?
 */
export function canRollbackExpenseReport(params: {
  reportOwnerId: string;
  currentUserId: string;
  reportStatus: ReportStatus;
}): { allowed: boolean; reason?: string } {
  const { reportOwnerId, currentUserId, reportStatus } = params;

  if (reportOwnerId !== currentUserId) {
    return { allowed: false, reason: "Only the report owner can initiate a rollback." };
  }

  if (reportStatus !== ReportStatus.SUBMITTED) {
    return {
      allowed: false,
      reason: `Only SUBMITTED reports can be rolled back to DRAFT. Current status is ${reportStatus}.`,
    };
  }

  return { allowed: true };
}

/**
 * Centralized permission rule: Can an actor approve this expense report?
 */
export function canApproveExpenseReport(params: {
  reportOwnerId: string;
  currentUserId: string;
  currentUserRole: Role;
  reportStatus: ReportStatus;
  primaryAssigneeUserId?: string | null;
  isCcRecipient?: boolean;
}): { allowed: boolean; reason?: string } {
  const { reportOwnerId, currentUserId, currentUserRole, reportStatus, primaryAssigneeUserId, isCcRecipient } = params;

  const isAdminOrSuper = currentUserRole === Role.ADMIN || currentUserRole === Role.SUPERADMIN;
  if (!isAdminOrSuper) {
    return { allowed: false, reason: "Only Administrators and Superadmins can approve expense reports." };
  }

  if (reportOwnerId === currentUserId) {
    return { allowed: false, reason: "Self-approval is prohibited. Another administrator must review your report." };
  }

  if (reportStatus !== ReportStatus.SUBMITTED) {
    return { allowed: false, reason: `Only SUBMITTED reports can be approved. Current status is ${reportStatus}.` };
  }

  // CC recipients can view but cannot approve
  if (isCcRecipient) {
    return { allowed: false, reason: "You are selected as a CC notification recipient and cannot approve this report." };
  }

  // If a primary assignment exists, only the assigned Primary Approver (or Superadmin) can approve
  if (primaryAssigneeUserId && primaryAssigneeUserId !== currentUserId && currentUserRole !== Role.SUPERADMIN) {
    return {
      allowed: false,
      reason: "You are not the assigned Primary Approver for this expense report.",
    };
  }

  return { allowed: true };
}

/**
 * Centralized permission rule: Can an actor mark this report as reimbursed?
 */
export function canReimburseExpenseReport(params: {
  currentUserRole: Role;
  reportStatus: ReportStatus;
}): { allowed: boolean; reason?: string } {
  const { currentUserRole, reportStatus } = params;

  if (currentUserRole !== Role.SUPERADMIN) {
    return { allowed: false, reason: "Only Superadmins can mark reports as reimbursed." };
  }

  if (reportStatus !== ReportStatus.APPROVED) {
    return { allowed: false, reason: `Report must be in APPROVED status before it can be reimbursed. Current status is ${reportStatus}.` };
  }

  return { allowed: true };
}
