import { describe, it, expect } from "vitest";
import { ReportStatus, Role, AdvanceStatus, AdvanceAllocationStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { canReimburseExpenseReport } from "../src/lib/workflow-rules";
import { calculateAdvanceBalances } from "../src/lib/advance-rules";

// Helper function implementing authoritative server calculation logic
function calculateNetPayableServer(report: {
  totalAmount: number | Decimal;
  advanceAdjustedAmount?: number | Decimal | null;
  advanceAllocation?: { allocatedAmount: number | Decimal } | null;
}) {
  const gross = Number(report.totalAmount) || 0;
  const advAdj =
    Number(report.advanceAdjustedAmount) ||
    (report.advanceAllocation ? Number(report.advanceAllocation.allocatedAmount) : 0);
  const netPayable = Math.max(0, gross - advAdj);
  const isZeroNet = netPayable === 0 && advAdj > 0;
  return { gross, advAdj, netPayable, isZeroNet };
}

// Helper simulating server reimbursement validation
function validateReimbursementPayload(
  report: {
    status: ReportStatus;
    totalAmount: number;
    advanceAdjustedAmount: number;
  },
  userRole: Role,
  payload: {
    reimbursementDate?: string;
    paymentMethod?: string;
    reimbursementRef?: string;
    clientReportedNetPayable?: number;
  }
) {
  // 1. Status check
  if (report.status !== ReportStatus.APPROVED) {
    throw new Error(`Cannot reimburse report in status ${report.status}. Report must be in APPROVED status.`);
  }

  // 2. Role check
  const check = canReimburseExpenseReport({
    currentUserRole: userRole,
    reportStatus: report.status,
  });
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  // 3. Server financial calculation (ignores payload.clientReportedNetPayable)
  const { netPayable, isZeroNet } = calculateNetPayableServer(report);

  if (!isZeroNet) {
    if (!payload.reimbursementDate) {
      throw new Error("Payment / disbursement date is required for payable reimbursement.");
    }
    if (!payload.paymentMethod || !payload.paymentMethod.trim()) {
      throw new Error("Payment method is required for payable reimbursement.");
    }
    if (!payload.reimbursementRef || !payload.reimbursementRef.trim()) {
      throw new Error("Bank reference / UTR number is required for payable reimbursement.");
    }
    return {
      status: ReportStatus.REIMBURSED,
      netPayableAmount: netPayable,
      paymentMethod: payload.paymentMethod.trim(),
      reimbursementRef: payload.reimbursementRef.trim(),
      reimbursementDate: new Date(payload.reimbursementDate),
    };
  } else {
    return {
      status: ReportStatus.REIMBURSED,
      netPayableAmount: 0,
      paymentMethod: "ADVANCE_ADJUSTMENT",
      reimbursementRef: "ADVANCE_ADJUSTED",
      reimbursementDate: payload.reimbursementDate ? new Date(payload.reimbursementDate) : new Date(),
    };
  }
}

describe("Zero-Net Advance Settlement & Reimbursement Unit Tests", () => {
  // Scenario 1: Normal expense without advance
  it("Scenario 1: Normal expense without advance requires full payment details", () => {
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAdjustedAmount: 0,
    };

    const calc = calculateNetPayableServer(report);
    expect(calc.netPayable).toBe(6500);
    expect(calc.isZeroNet).toBe(false);

    // Missing payment details fails
    expect(() =>
      validateReimbursementPayload(report, Role.SUPERADMIN, {})
    ).toThrow("Payment / disbursement date is required");

    // Providing valid payment details succeeds
    const result = validateReimbursementPayload(report, Role.SUPERADMIN, {
      reimbursementDate: "2026-08-27",
      paymentMethod: "BANK_TRANSFER",
      reimbursementRef: "UTR99887766",
    });
    expect(result.status).toBe(ReportStatus.REIMBURSED);
    expect(result.netPayableAmount).toBe(6500);
    expect(result.paymentMethod).toBe("BANK_TRANSFER");
    expect(result.reimbursementRef).toBe("UTR99887766");
  });

  // Scenario 2: Partially advance-adjusted expense
  it("Scenario 2: Partially advance-adjusted expense calculates exact net payable and requires payment details", () => {
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 10000,
      advanceAdjustedAmount: 6000,
    };

    const calc = calculateNetPayableServer(report);
    expect(calc.netPayable).toBe(4000);
    expect(calc.isZeroNet).toBe(false);

    const result = validateReimbursementPayload(report, Role.SUPERADMIN, {
      reimbursementDate: "2026-08-27",
      paymentMethod: "UPI",
      reimbursementRef: "UPI-CORP-4455",
    });
    expect(result.status).toBe(ReportStatus.REIMBURSED);
    expect(result.netPayableAmount).toBe(4000);
    expect(result.reimbursementRef).toBe("UPI-CORP-4455");
  });

  // Scenario 3: Fully advance-adjusted expense (Zero-Net Settlement)
  it("Scenario 3: Fully advance-adjusted expense completes settlement with ₹0 net payable and no payment method/UTR required", () => {
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAdjustedAmount: 6500,
    };

    const calc = calculateNetPayableServer(report);
    expect(calc.netPayable).toBe(0);
    expect(calc.isZeroNet).toBe(true);

    // No payment method or UTR provided -> succeeds cleanly
    const result = validateReimbursementPayload(report, Role.SUPERADMIN, {});
    expect(result.status).toBe(ReportStatus.REIMBURSED);
    expect(result.netPayableAmount).toBe(0);
    expect(result.paymentMethod).toBe("ADVANCE_ADJUSTMENT");
    expect(result.reimbursementRef).toBe("ADVANCE_ADJUSTED");
  });

  // Scenario 4: Requested amount differs from disbursed amount
  it("Scenario 4: Calculation strictly uses report allocation amount (₹6,500), not requested (₹12,000) or disbursed (₹10,000)", () => {
    const advance = {
      requestedAmount: new Decimal(12000),
      approvedAmount: new Decimal(10000),
      disbursedAmount: new Decimal(10000),
    };

    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAllocation: {
        allocatedAmount: 6500,
      },
    };

    const calc = calculateNetPayableServer(report);
    expect(calc.gross).toBe(6500);
    expect(calc.advAdj).toBe(6500);
    expect(calc.netPayable).toBe(0);
    expect(calc.isZeroNet).toBe(true);
  });

  // Scenario 5: Remaining advance returned does not alter expense reimbursement
  it("Scenario 5: Employee returning remaining advance balance (₹3,500) settles the advance, but does not alter expense ₹0 calculation", () => {
    const advanceBalances = calculateAdvanceBalances({
      currentStatus: AdvanceStatus.SETTLED,
      disbursedAmount: new Decimal(10000),
      adjustedAmount: new Decimal(6500),
      returnedAmount: new Decimal(3500),
      reservedAmount: new Decimal(0),
    });

    expect(Number(advanceBalances.availableBalance)).toBe(0);
    expect(Number(advanceBalances.outstandingBalance)).toBe(0);

    // Expense report settlement remains strictly ₹0
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAdjustedAmount: 6500,
    };
    const calc = calculateNetPayableServer(report);
    expect(calc.netPayable).toBe(0);
  });

  // Scenario 6: Unauthorized or unassigned user cannot complete reimbursement
  it("Scenario 6: USER and ADMIN roles cannot complete reimbursement", () => {
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAdjustedAmount: 6500,
    };

    expect(() =>
      validateReimbursementPayload(report, Role.USER, {})
    ).toThrow();

    expect(() =>
      validateReimbursementPayload(report, Role.ADMIN, {})
    ).toThrow();
  });

  // Scenario 7: Repeated / double confirmation cannot re-reimburse
  it("Scenario 7: Cannot reimburse an already REIMBURSED report", () => {
    const report = {
      status: ReportStatus.REIMBURSED,
      totalAmount: 6500,
      advanceAdjustedAmount: 6500,
    };

    expect(() =>
      validateReimbursementPayload(report, Role.SUPERADMIN, {})
    ).toThrow("Report must be in APPROVED status");
  });

  // Scenario 8: Client-tampered payable amount is ignored
  it("Scenario 8: Client-tampered payable amount is completely ignored by server calculation", () => {
    const report = {
      status: ReportStatus.APPROVED,
      totalAmount: 6500,
      advanceAdjustedAmount: 6500,
    };

    // Client maliciously sends clientReportedNetPayable: 6500
    const result = validateReimbursementPayload(report, Role.SUPERADMIN, {
      clientReportedNetPayable: 6500,
    });

    // Server enforces netPayable = 0
    expect(result.netPayableAmount).toBe(0);
    expect(result.paymentMethod).toBe("ADVANCE_ADJUSTMENT");
  });
});
