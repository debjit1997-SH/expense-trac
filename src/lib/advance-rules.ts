import prisma from "./db";
import {
  AdvanceStatus,
  AdvanceAllocationStatus,
  AdvanceTransactionType,
  Role,
  AccountStatus,
  RecipientType,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface EligibleAdvanceApprover {
  id: string;
  name: string;
  email: string;
  role: Role;
  isFallback?: boolean;
}

export interface AdvanceBalanceBreakdown {
  disbursedAmount: Decimal;
  adjustedAmount: Decimal;
  returnedAmount: Decimal;
  reservedAmount: Decimal;
  availableBalance: Decimal;
  outstandingBalance: Decimal;
  computedStatus: AdvanceStatus;
}

/**
 * Normalizes decimal values safely to 2 decimal places
 */
export function toDecimal(val: number | string | Decimal | null | undefined): Decimal {
  if (val === null || val === undefined) return new Prisma.Decimal(0);
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(Number(val).toFixed(2));
}

/**
 * Computes exact balances and status for an advance
 */
export function calculateAdvanceBalances(params: {
  currentStatus: AdvanceStatus;
  disbursedAmount: Decimal | number;
  adjustedAmount: Decimal | number;
  returnedAmount: Decimal | number;
  reservedAmount: Decimal | number;
}): AdvanceBalanceBreakdown {
  const d = toDecimal(params.disbursedAmount);
  const a = toDecimal(params.adjustedAmount);
  const r = toDecimal(params.returnedAmount);
  const res = toDecimal(params.reservedAmount);

  // Outstanding balance = Disbursed - Settled Expenses - Returned
  const outstanding = d.sub(a).sub(r);
  // Available balance = Outstanding - Reserved in submitted expenses
  const available = outstanding.sub(res);

  let computedStatus = params.currentStatus;

  // Only transition if currently in a post-disbursement state
  if (
    params.currentStatus === AdvanceStatus.DISBURSED ||
    params.currentStatus === AdvanceStatus.PARTIALLY_SETTLED ||
    params.currentStatus === AdvanceStatus.SETTLED
  ) {
    if (outstanding.equals(new Prisma.Decimal(0)) && res.equals(new Prisma.Decimal(0))) {
      computedStatus = AdvanceStatus.SETTLED;
    } else if (a.gt(0) || r.gt(0)) {
      computedStatus = AdvanceStatus.PARTIALLY_SETTLED;
    } else {
      computedStatus = AdvanceStatus.DISBURSED;
    }
  }

  return {
    disbursedAmount: d,
    adjustedAmount: a,
    returnedAmount: r,
    reservedAmount: res,
    availableBalance: available.lt(0) ? new Prisma.Decimal(0) : available,
    outstandingBalance: outstanding.lt(0) ? new Prisma.Decimal(0) : outstanding,
    computedStatus,
  };
}

/**
 * Fetch eligible Admin Approvers for an advance request submission
 */
export async function getEligibleAdvanceApprovers(params: {
  requesterId: string;
  requesterRole: Role;
}): Promise<{ approvers: EligibleAdvanceApprover[]; isFallback: boolean }> {
  const { requesterId, requesterRole } = params;

  if (requesterRole === Role.USER) {
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

  // ADMIN or SUPERADMIN submitting their own advance:
  // Show other active ADMIN users (exclude self)
  const otherAdmins = await prisma.user.findMany({
    where: {
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      id: { not: requesterId },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  if (otherAdmins.length > 0) {
    return { approvers: otherAdmins, isFallback: false };
  }

  // Fallback to active SUPERADMINs (excluding self)
  const superadmins = await prisma.user.findMany({
    where: {
      role: Role.SUPERADMIN,
      status: AccountStatus.ACTIVE,
      id: { not: requesterId },
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
 * Permission rule: Can actor submit this advance request?
 */
export function canSubmitAdvanceRequest(params: {
  requesterId: string;
  currentUserId: string;
  status: AdvanceStatus;
  requestedAmount: Decimal | number;
  primaryApproverId?: string;
}): { allowed: boolean; reason?: string } {
  const { requesterId, currentUserId, status, requestedAmount, primaryApproverId } = params;

  if (requesterId !== currentUserId) {
    return { allowed: false, reason: "You can only submit your own advance requests." };
  }

  if (status !== AdvanceStatus.DRAFT) {
    return {
      allowed: false,
      reason: `Only DRAFT advance requests can be submitted. Current status is ${status}.`,
    };
  }

  const amt = toDecimal(requestedAmount);
  if (amt.lte(0)) {
    return { allowed: false, reason: "Advance requested amount must be greater than zero." };
  }

  if (!primaryApproverId) {
    return { allowed: false, reason: "Please select a Primary Approver before submitting." };
  }

  return { allowed: true };
}

/**
 * Permission rule: Can actor approve this advance request?
 */
export function canApproveAdvanceRequest(params: {
  requesterId: string;
  currentUserId: string;
  currentUserRole: Role;
  status: AdvanceStatus;
  primaryAssigneeUserId?: string | null;
  isCcRecipient?: boolean;
}): { allowed: boolean; reason?: string } {
  const {
    requesterId,
    currentUserId,
    currentUserRole,
    status,
    primaryAssigneeUserId,
    isCcRecipient,
  } = params;

  const isAdminOrSuper = currentUserRole === Role.ADMIN || currentUserRole === Role.SUPERADMIN;
  if (!isAdminOrSuper) {
    return { allowed: false, reason: "Only Administrators and Superadmins can approve advance requests." };
  }

  if (requesterId === currentUserId) {
    return {
      allowed: false,
      reason: "Self-approval is prohibited. Another administrator must review your advance request.",
    };
  }

  if (status !== AdvanceStatus.SUBMITTED) {
    return {
      allowed: false,
      reason: `Only SUBMITTED advance requests can be approved. Current status is ${status}.`,
    };
  }

  if (isCcRecipient) {
    return {
      allowed: false,
      reason: "You are selected as a CC notification recipient and cannot approve this request.",
    };
  }

  if (
    primaryAssigneeUserId &&
    primaryAssigneeUserId !== currentUserId &&
    currentUserRole !== Role.SUPERADMIN
  ) {
    return {
      allowed: false,
      reason: "You are not the assigned Primary Approver for this advance request.",
    };
  }

  return { allowed: true };
}

/**
 * Permission rule: Can actor disburse this advance?
 */
export function canDisburseAdvance(params: {
  requesterId?: string | null;
  currentUserId?: string | null;
  currentUserRole: Role;
  status: AdvanceStatus;
}): { allowed: boolean; reason?: string } {
  const { requesterId, currentUserId, currentUserRole, status } = params;

  if (currentUserRole !== Role.SUPERADMIN) {
    return { allowed: false, reason: "Only active Superadmins can disburse employee advances." };
  }

  if (requesterId && currentUserId && requesterId === currentUserId) {
    return {
      allowed: false,
      reason: "Self-disbursement is prohibited. A requester cannot disburse their own advance request.",
    };
  }

  if (status !== AdvanceStatus.APPROVED) {
    return {
      allowed: false,
      reason: `Advance must be in APPROVED status before disbursement. Current status is ${status}.`,
    };
  }

  return { allowed: true };
}

/**
 * Permission rule: Can actor record employee return money?
 */
export function canRecordEmployeeReturn(params: {
  currentUserRole: Role;
  status: AdvanceStatus;
  availableBalance: Decimal | number;
  returnAmount: Decimal | number;
}): { allowed: boolean; reason?: string } {
  const { currentUserRole, status, availableBalance, returnAmount } = params;

  if (currentUserRole !== Role.SUPERADMIN) {
    return { allowed: false, reason: "Only Superadmins can record returned advance funds." };
  }

  if (
    status !== AdvanceStatus.DISBURSED &&
    status !== AdvanceStatus.PARTIALLY_SETTLED
  ) {
    return {
      allowed: false,
      reason: `Returns can only be recorded against DISBURSED or PARTIALLY_SETTLED advances. Current status is ${status}.`,
    };
  }

  const ret = toDecimal(returnAmount);
  const avail = toDecimal(availableBalance);

  if (ret.lte(0)) {
    return { allowed: false, reason: "Return amount must be greater than zero." };
  }

  if (ret.gt(avail)) {
    return {
      allowed: false,
      reason: `Return amount (₹${ret.toFixed(2)}) cannot exceed currently available unreserved balance (₹${avail.toFixed(2)}).`,
    };
  }

  return { allowed: true };
}

/**
 * Permission rule: Can actor cancel this advance request?
 */
export function canCancelAdvanceRequest(params: {
  requesterId: string;
  currentUserId: string;
  currentUserRole: Role;
  status: AdvanceStatus;
}): { allowed: boolean; reason?: string } {
  const { requesterId, currentUserId, currentUserRole, status } = params;

  if (
    status === AdvanceStatus.DISBURSED ||
    status === AdvanceStatus.PARTIALLY_SETTLED ||
    status === AdvanceStatus.SETTLED
  ) {
    return {
      allowed: false,
      reason: "Advances cannot be cancelled or edited after disbursement.",
    };
  }

  if (status === AdvanceStatus.CANCELLED || status === AdvanceStatus.REJECTED) {
    return {
      allowed: false,
      reason: `Advance is already ${status}.`,
    };
  }

  const isOwner = requesterId === currentUserId;
  const isAdminOrSuper = currentUserRole === Role.ADMIN || currentUserRole === Role.SUPERADMIN;

  if (!isOwner && !isAdminOrSuper) {
    return { allowed: false, reason: "Unauthorized to cancel this advance request." };
  }

  return { allowed: true };
}
