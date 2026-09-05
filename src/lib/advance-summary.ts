import { ReportStatus, AdvanceStatus, AdvanceAllocationStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface NormalizedAdvanceSummary {
  hasLinkedAdvance: boolean;
  advanceId: string | null;
  advanceNumber: string | null;
  advancePurpose: string | null;
  advanceStatus: AdvanceStatus | null;
  advanceOwnerName: string | null;
  advanceOwnerEmail: string | null;

  // Financial figures
  totalExpense: number;
  requestedAmount: number;
  approvedAmount: number;
  disbursedAmount: number;
  adjustedAmount: number;
  returnedAmount: number;
  reservedAmount: number;

  // Stage-aware figures
  allocatedAmount: number; // Proposed in DRAFT, Reserved in SUBMITTED, Adjusted in APPROVED/REIMBURSED
  advanceReserved: number; // Specific to active reservation
  advanceAdjusted: number; // Specific to finalized adjustment
  expectedNetReimbursement: number; // Expected or final payout to employee
  remainingAvailableBalance: number; // Balance left on advance after this allocation
  outstandingBalance: number; // Unsettled balance on advance

  // Stage-aware labels
  allocationLabel: string;
  netPayableLabel: string;
  pdfAllocationLabel: string;
  isPendingHistoricalAllocation: boolean;
}

export function getNormalizedAdvanceSummary(report: {
  status: ReportStatus | string;
  totalAmount: number | Decimal | string;
  advanceAdjustedAmount?: number | Decimal | string | null;
  netPayableAmount?: number | Decimal | string | null;
  advanceAllocation?: {
    allocatedAmount?: number | Decimal | string | null;
    status?: AdvanceAllocationStatus | string | null;
    advanceRequest?: {
      id?: string;
      advanceNumber?: string;
      purpose?: string;
      requestedAmount?: number | Decimal | string | null;
      approvedAmount?: number | Decimal | string | null;
      disbursedAmount?: number | Decimal | string | null;
      adjustedAmount?: number | Decimal | string | null;
      returnedAmount?: number | Decimal | string | null;
      reservedAmount?: number | Decimal | string | null;
      status?: AdvanceStatus | string | null;
      user?: {
        name?: string | null;
        email?: string | null;
      } | null;
    } | null;
  } | null;
}): NormalizedAdvanceSummary {
  const totalExpense = Number(report.totalAmount) || 0;
  const alloc = report.advanceAllocation;
  const adv = alloc?.advanceRequest;

  if (!alloc || !adv) {
    return {
      hasLinkedAdvance: false,
      advanceId: null,
      advanceNumber: null,
      advancePurpose: null,
      advanceStatus: null,
      advanceOwnerName: null,
      advanceOwnerEmail: null,
      totalExpense,
      requestedAmount: 0,
      approvedAmount: 0,
      disbursedAmount: 0,
      adjustedAmount: 0,
      returnedAmount: 0,
      reservedAmount: 0,
      allocatedAmount: 0,
      advanceReserved: 0,
      advanceAdjusted: 0,
      expectedNetReimbursement: totalExpense,
      remainingAvailableBalance: 0,
      outstandingBalance: 0,
      allocationLabel: "Advance Adjustment",
      netPayableLabel: "Net Reimbursement",
      pdfAllocationLabel: "Advance Adjustment",
      isPendingHistoricalAllocation: false,
    };
  }

  const requestedAmount = Number(adv.requestedAmount) || 0;
  const approvedAmount = Number(adv.approvedAmount) || 0;
  const disbursedAmount = Number(adv.disbursedAmount) || 0;
  const adjustedAmount = Number(adv.adjustedAmount) || 0;
  const returnedAmount = Number(adv.returnedAmount) || 0;
  const reservedAmount = Number(adv.reservedAmount) || 0;

  const currentOutstanding = Math.max(0, disbursedAmount - adjustedAmount - returnedAmount);
  // Total available on advance excluding reservations from other reports
  const totalAvailableOnAdvance = Math.max(0, currentOutstanding - reservedAmount);

  let allocatedAmount = 0;
  let advanceReserved = 0;
  let advanceAdjusted = 0;
  let remainingAvailableBalance = 0;
  let isPendingHistoricalAllocation = false;

  const status = report.status as ReportStatus;

  if (status === ReportStatus.APPROVED || status === ReportStatus.REIMBURSED) {
    // Stage 3 & 4: Finalized Adjustment
    allocatedAmount =
      Number(report.advanceAdjustedAmount) > 0
        ? Number(report.advanceAdjustedAmount)
        : Number(alloc.allocatedAmount) > 0
        ? Number(alloc.allocatedAmount)
        : 0;

    advanceAdjusted = allocatedAmount;
    advanceReserved = 0;
    remainingAvailableBalance = Math.max(0, currentOutstanding - reservedAmount);
  } else if (status === ReportStatus.SUBMITTED) {
    // Stage 2: Active Reservation
    const storedAlloc = Number(alloc.allocatedAmount) || 0;
    const isReserved = alloc.status === AdvanceAllocationStatus.RESERVED;

    if (isReserved && storedAlloc > 0) {
      allocatedAmount = storedAlloc;
      advanceReserved = storedAlloc;
      remainingAvailableBalance = Math.max(0, currentOutstanding - Math.max(reservedAmount, allocatedAmount));
    } else {
      // Historical broken report (e.g. EXP-2026-000006) where allocation was 0 or unreserved
      // Do NOT pretend money is reserved when DB allocation is 0
      allocatedAmount = 0;
      advanceReserved = 0;
      isPendingHistoricalAllocation = true;
      remainingAvailableBalance = Math.max(0, currentOutstanding - reservedAmount);
    }
    advanceAdjusted = 0;
  } else {
    // Stage 1: DRAFT (Proposed Allocation)
    const storedAlloc = Number(alloc.allocatedAmount) || 0;
    if (storedAlloc > 0) {
      allocatedAmount = storedAlloc;
    } else {
      allocatedAmount = Math.min(totalExpense, totalAvailableOnAdvance);
    }
    advanceReserved = 0;
    advanceAdjusted = 0;
    remainingAvailableBalance = Math.max(0, totalAvailableOnAdvance - allocatedAmount);
  }

  const expectedNetReimbursement = Math.max(0, totalExpense - allocatedAmount);

  // Stage-aware labels
  let allocationLabel: string;
  let netPayableLabel: string;
  let pdfAllocationLabel: string;

  if (status === ReportStatus.DRAFT) {
    allocationLabel = "Proposed Advance Allocation";
    netPayableLabel = "Estimated Net Reimbursement";
    pdfAllocationLabel = "Proposed For This Report";
  } else if (status === ReportStatus.SUBMITTED) {
    if (isPendingHistoricalAllocation) {
      allocationLabel = "Advance Allocation (Pending Review)";
      netPayableLabel = "Net Reimbursement (Pre-Approval)";
      pdfAllocationLabel = "Allocation Pending at Approval";
    } else {
      allocationLabel = "Advance Reserved";
      netPayableLabel = "Expected Net Reimbursement";
      pdfAllocationLabel = "Reserved Against This Report";
    }
  } else {
    allocationLabel = "Advance Adjusted";
    netPayableLabel = "Net Reimbursement";
    pdfAllocationLabel = "Adjusted Against This Report";
  }

  return {
    hasLinkedAdvance: true,
    advanceId: adv.id || null,
    advanceNumber: adv.advanceNumber || null,
    advancePurpose: adv.purpose || null,
    advanceStatus: (adv.status as AdvanceStatus) || null,
    advanceOwnerName: adv.user?.name || null,
    advanceOwnerEmail: adv.user?.email || null,
    totalExpense,
    requestedAmount,
    approvedAmount,
    disbursedAmount,
    adjustedAmount,
    returnedAmount,
    reservedAmount,
    allocatedAmount,
    advanceReserved,
    advanceAdjusted,
    expectedNetReimbursement,
    remainingAvailableBalance,
    outstandingBalance: currentOutstanding,
    allocationLabel,
    netPayableLabel,
    pdfAllocationLabel,
    isPendingHistoricalAllocation,
  };
}
