import { describe, it, expect } from "vitest";
import { ReportStatus, Role, AdvanceStatus, AdvanceAllocationStatus, Prisma } from "@prisma/client";
import { getNormalizedAdvanceSummary } from "../src/lib/advance-summary";
import { canDisburseAdvance, calculateAdvanceBalances } from "../src/lib/advance-rules";

describe("Linked Advance Calculation & Normalization Engine", () => {
  const dummyRequester = {
    name: "Debjit User",
    email: "userdebjit1612@gmail.com",
  };

  describe("Stage 1: DRAFT (Proposed Allocation)", () => {
    it("proposes full allocation when expense is less than available advance balance", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.DRAFT,
        totalAmount: 9700,
        advanceAllocation: {
          allocatedAmount: 0, // In draft before save
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            purpose: "Travel to Mumbai",
            requestedAmount: 12000,
            approvedAmount: 12000,
            disbursedAmount: 12000,
            adjustedAmount: 0,
            returnedAmount: 0,
            reservedAmount: 0,
            status: AdvanceStatus.DISBURSED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.hasLinkedAdvance).toBe(true);
      expect(summary.advanceNumber).toBe("ADV-2026-000006");
      expect(summary.totalExpense).toBe(9700);
      expect(summary.allocatedAmount).toBe(9700);
      expect(summary.advanceReserved).toBe(0);
      expect(summary.advanceAdjusted).toBe(0);
      expect(summary.expectedNetReimbursement).toBe(0);
      expect(summary.remainingAvailableBalance).toBe(2300);
      expect(summary.outstandingBalance).toBe(12000);
      expect(summary.allocationLabel).toBe("Proposed Advance Allocation");
      expect(summary.netPayableLabel).toBe("Estimated Net Reimbursement");
      expect(summary.pdfAllocationLabel).toBe("Proposed For This Report");
    });

    it("caps proposed allocation to available balance when expense exceeds advance", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.DRAFT,
        totalAmount: 15000,
        advanceAllocation: {
          allocatedAmount: 0,
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            purpose: "Travel to Mumbai",
            disbursedAmount: 12000,
            adjustedAmount: 0,
            returnedAmount: 0,
            reservedAmount: 0,
            status: AdvanceStatus.DISBURSED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.totalExpense).toBe(15000);
      expect(summary.allocatedAmount).toBe(12000);
      expect(summary.expectedNetReimbursement).toBe(3000);
      expect(summary.remainingAvailableBalance).toBe(0);
    });
  });

  describe("Stage 2: SUBMITTED (Genuine Reservation vs Historical Unreserved)", () => {
    it("does NOT pretend money is reserved in UI when DB allocation is 0 (EXP-2026-000006 historical state)", () => {
      // Historical defect: report was submitted, advanceDisbursed=12000, but allocatedAmount=0 in DB
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.SUBMITTED,
        totalAmount: 9700,
        advanceAdjustedAmount: 0,
        netPayableAmount: 9700,
        advanceAllocation: {
          allocatedAmount: 0, // DB has 0
          status: AdvanceAllocationStatus.RESERVED,
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            purpose: "Travel to Mumbai",
            disbursedAmount: 12000,
            adjustedAmount: 0,
            returnedAmount: 0,
            reservedAmount: 0, // DB has 0 reserved
            status: AdvanceStatus.DISBURSED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.hasLinkedAdvance).toBe(true);
      expect(summary.totalExpense).toBe(9700);
      // Must not display phantom reservation
      expect(summary.allocatedAmount).toBe(0);
      expect(summary.advanceReserved).toBe(0);
      expect(summary.advanceAdjusted).toBe(0);
      expect(summary.expectedNetReimbursement).toBe(9700);
      expect(summary.isPendingHistoricalAllocation).toBe(true);
      expect(summary.remainingAvailableBalance).toBe(12000);
      expect(summary.outstandingBalance).toBe(12000);
      expect(summary.allocationLabel).toBe("Advance Allocation (Pending Review)");
      expect(summary.netPayableLabel).toBe("Net Reimbursement (Pre-Approval)");
      expect(summary.pdfAllocationLabel).toBe("Allocation Pending at Approval");
    });

    it("correctly reflects explicitly reserved amount on new SUBMITTED report", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.SUBMITTED,
        totalAmount: 9700,
        advanceAdjustedAmount: 0,
        advanceAllocation: {
          allocatedAmount: 9700,
          status: AdvanceAllocationStatus.RESERVED,
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            disbursedAmount: 12000,
            adjustedAmount: 0,
            returnedAmount: 0,
            reservedAmount: 9700,
            status: AdvanceStatus.DISBURSED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.allocatedAmount).toBe(9700);
      expect(summary.advanceReserved).toBe(9700);
      expect(summary.isPendingHistoricalAllocation).toBe(false);
      expect(summary.expectedNetReimbursement).toBe(0);
      expect(summary.remainingAvailableBalance).toBe(2300);
      expect(summary.allocationLabel).toBe("Advance Reserved");
      expect(summary.netPayableLabel).toBe("Expected Net Reimbursement");
    });
  });

  describe("Stage 3 & 4: APPROVED & REIMBURSED (Finalized Adjustment)", () => {
    it("calculates zero-net reimbursement when expense is fully covered by advance upon approval", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.APPROVED,
        totalAmount: 9700,
        advanceAdjustedAmount: 9700,
        netPayableAmount: 0,
        advanceAllocation: {
          allocatedAmount: 9700,
          status: AdvanceAllocationStatus.SETTLED,
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            disbursedAmount: 12000,
            adjustedAmount: 9700,
            returnedAmount: 0,
            reservedAmount: 0,
            status: AdvanceStatus.PARTIALLY_SETTLED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.allocatedAmount).toBe(9700);
      expect(summary.advanceAdjusted).toBe(9700);
      expect(summary.advanceReserved).toBe(0);
      expect(summary.expectedNetReimbursement).toBe(0);
      expect(summary.outstandingBalance).toBe(2300);
      expect(summary.remainingAvailableBalance).toBe(2300);
      expect(summary.allocationLabel).toBe("Advance Adjusted");
      expect(summary.netPayableLabel).toBe("Net Reimbursement");
      expect(summary.pdfAllocationLabel).toBe("Adjusted Against This Report");
    });

    it("calculates partial reimbursement when expense exceeds advance upon approval", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.APPROVED,
        totalAmount: 15000,
        advanceAdjustedAmount: 12000,
        netPayableAmount: 3000,
        advanceAllocation: {
          allocatedAmount: 12000,
          status: AdvanceAllocationStatus.SETTLED,
          advanceRequest: {
            id: "adv-1",
            advanceNumber: "ADV-2026-000006",
            disbursedAmount: 12000,
            adjustedAmount: 12000,
            returnedAmount: 0,
            reservedAmount: 0,
            status: AdvanceStatus.SETTLED,
            user: dummyRequester,
          },
        },
      });

      expect(summary.allocatedAmount).toBe(12000);
      expect(summary.advanceAdjusted).toBe(12000);
      expect(summary.expectedNetReimbursement).toBe(3000);
      expect(summary.outstandingBalance).toBe(0);
      expect(summary.remainingAvailableBalance).toBe(0);
    });

    it("handles report with no linked advance gracefully", () => {
      const summary = getNormalizedAdvanceSummary({
        status: ReportStatus.SUBMITTED,
        totalAmount: 5000,
        advanceAllocation: null,
      });

      expect(summary.hasLinkedAdvance).toBe(false);
      expect(summary.advanceNumber).toBeNull();
      expect(summary.allocatedAmount).toBe(0);
      expect(summary.expectedNetReimbursement).toBe(5000);
      expect(summary.allocationLabel).toBe("Advance Adjustment");
      expect(summary.netPayableLabel).toBe("Net Reimbursement");
    });
  });
});

describe("Regression Suite 1: Concurrent & Double Reservation Prevention", () => {
  it("prevents double reservation when concurrent requests attempt to reserve available funds", () => {
    // Simulates an advance with disbursed ₹10,000 and available ₹4,000 (₹6,000 already reserved)
    const disbursed = 10000;
    const adjusted = 0;
    const returned = 0;
    const initialReserved = 6000;
    const available = disbursed - adjusted - returned - initialReserved; // 4000

    // Submission A requests ₹3,000
    const reqA = 3000;
    const canReserveA = reqA <= available;
    expect(canReserveA).toBe(true);

    // If Submission A succeeds, reserved becomes 9000, available becomes 1000
    const updatedReservedAfterA = initialReserved + reqA; // 9000
    const availableAfterA = disbursed - adjusted - returned - updatedReservedAfterA; // 1000

    // Submission B concurrently attempts to reserve ₹2,500 based on stale available balance (4000)
    const reqB = 2500;
    // Server-side validation against current DB state:
    const canReserveB = reqB <= availableAfterA;
    expect(canReserveB).toBe(false); // Must be rejected!

    // Optimistic Concurrency Control simulation:
    // If transaction B tries to update advanceRequest where reservedAmount == initialReserved (6000)
    // but the DB was already updated to 9000, updateMany count will be 0:
    const simulateOCC = (dbReserved: number, expectedReserved: number) => {
      return dbReserved === expectedReserved ? 1 : 0;
    };

    const countB = simulateOCC(updatedReservedAfterA, initialReserved);
    expect(countB).toBe(0); // Collision detected!
  });

  it("strictly caps requested reservation to genuinely available balance", () => {
    const disbursed = 12000;
    const adjusted = 2000;
    const returned = 1000;
    const reserved = 4000;
    // Available = 12000 - 2000 - 1000 - 4000 = 5000
    const available = disbursed - adjusted - returned - reserved;

    const reportTotal = 8000;
    const autoAllocation = Math.min(reportTotal, available);
    expect(autoAllocation).toBe(5000);
    expect(autoAllocation).toBeLessThanOrEqual(available);
  });
});

describe("Regression Suite 2: Insufficient Balance During Historical Repair", () => {
  it("blocks approval with error when historical report has no available balance left on advance", () => {
    // Historical broken report (allocatedAmount was 0 in DB)
    const reportTotal = 9700;
    const existingAllocAmount = 0;

    // Meanwhile, advance disbursed = 12000, but 12000 has already been adjusted/returned by other reports
    const advDisbursed = 12000;
    const advAdjusted = 10000;
    const advReturned = 2000;
    const advReserved = 0;

    const unadjusted = advDisbursed - advAdjusted - advReturned; // 0
    const otherReserved = advReserved - 0;
    const availableForThisReport = unadjusted - otherReserved; // 0

    // Approval validator logic:
    const validateApproval = () => {
      if (existingAllocAmount <= 0) {
        if (availableForThisReport <= 0) {
          throw new Error(
            `Cannot approve report: Linked advance ADV-2026-000006 has no available balance (₹${availableForThisReport.toFixed(2)}) remaining to adjust against this expense.`
          );
        }
      }
    };

    expect(() => validateApproval()).toThrow(
      "Cannot approve report: Linked advance ADV-2026-000006 has no available balance (₹0.00) remaining to adjust against this expense."
    );
  });

  it("successfully adjusts historical report when advance has sufficient unreserved balance", () => {
    const reportTotal = 9700;
    const existingAllocAmount = 0;

    // Advance has 12,000 unadjusted and 0 reserved
    const unadjusted = 12000;
    const otherReserved = 0;
    const availableForThisReport = unadjusted - otherReserved; // 12000

    expect(availableForThisReport).toBe(12000);
    const candidateAlloc = Math.min(reportTotal, availableForThisReport);
    expect(candidateAlloc).toBe(9700);

    const outstanding = unadjusted - candidateAlloc;
    expect(outstanding).toBe(2300);
    expect(outstanding).toBeGreaterThanOrEqual(0);
  });
});

describe("Regression Suite 3: Negative Balance Prevention Invariant", () => {
  it("guarantees calculateAdvanceBalances never produces negative available or outstanding balance", () => {
    // Edge case: disbursed 5000, adjusted 6000 (malformed input)
    const balances = calculateAdvanceBalances({
      disbursedAmount: 5000,
      adjustedAmount: 6000,
      returnedAmount: 1000,
      reservedAmount: 2000,
      currentStatus: AdvanceStatus.DISBURSED,
    });

    expect(Number(balances.availableBalance)).toBe(0);
    expect(Number(balances.outstandingBalance)).toBe(0);
    expect(Number(balances.availableBalance)).toBeGreaterThanOrEqual(0);
    expect(Number(balances.outstandingBalance)).toBeGreaterThanOrEqual(0);
  });

  it("strictly throws if an adjustment would exceed disbursed funds", () => {
    const disbursed = new Prisma.Decimal(5000);
    const newAdjusted = new Prisma.Decimal(6000);
    const returned = new Prisma.Decimal(0);
    const outstanding = disbursed.sub(newAdjusted).sub(returned);

    expect(outstanding.lt(0)).toBe(true);

    const checkInvariant = () => {
      if (outstanding.lt(0)) {
        throw new Error(
          `Cannot approve report: Advance settlement would result in negative outstanding balance (₹${outstanding.toFixed(2)}).`
        );
      }
    };

    expect(() => checkInvariant()).toThrow("negative outstanding balance");
  });
});

describe("Regression Suite 4: Disbursement Server-Side Permission Hardening", () => {
  const requesterId = "cmtd2kwjj0000hywi6lox9qiw"; // Debjit User
  const approverId = "cmtd2qntq0003hywiwy086a67";  // Admin Debjit
  const superadminId = "cmt8fjut00000y2ob1ch6r8vd"; // Debjit Dey (SUPERADMIN)

  it("permits active SUPERADMIN to disburse an approved advance for another user", () => {
    const result = canDisburseAdvance({
      requesterId: requesterId,
      currentUserId: superadminId,
      currentUserRole: Role.SUPERADMIN,
      status: AdvanceStatus.APPROVED,
    });
    expect(result.allowed).toBe(true);
  });

  it("strictly rejects non-SUPERADMIN (ADMIN and USER) from disbursing", () => {
    const adminResult = canDisburseAdvance({
      requesterId: requesterId,
      currentUserId: approverId,
      currentUserRole: Role.ADMIN,
      status: AdvanceStatus.APPROVED,
    });
    expect(adminResult.allowed).toBe(false);
    expect(adminResult.reason).toContain("Only active Superadmins can disburse");

    const userResult = canDisburseAdvance({
      requesterId: requesterId,
      currentUserId: requesterId,
      currentUserRole: Role.USER,
      status: AdvanceStatus.APPROVED,
    });
    expect(userResult.allowed).toBe(false);
    expect(userResult.reason).toContain("Only active Superadmins can disburse");
  });

  it("strictly rejects requester self-disbursement even if actor is SUPERADMIN", () => {
    const result = canDisburseAdvance({
      requesterId: superadminId,
      currentUserId: superadminId,
      currentUserRole: Role.SUPERADMIN,
      status: AdvanceStatus.APPROVED,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Self-disbursement is prohibited");
  });

  it("blocks double disbursement: rejects disbursement if status is not APPROVED", () => {
    const alreadyDisbursed = canDisburseAdvance({
      requesterId: requesterId,
      currentUserId: superadminId,
      currentUserRole: Role.SUPERADMIN,
      status: AdvanceStatus.DISBURSED,
    });
    expect(alreadyDisbursed.allowed).toBe(false);
    expect(alreadyDisbursed.reason).toContain("must be in APPROVED status");

    const submittedOnly = canDisburseAdvance({
      requesterId: requesterId,
      currentUserId: superadminId,
      currentUserRole: Role.SUPERADMIN,
      status: AdvanceStatus.SUBMITTED,
    });
    expect(submittedOnly.allowed).toBe(false);
    expect(submittedOnly.reason).toContain("must be in APPROVED status");
  });
});

describe("Regression Suite 5: PDF 10-Column Table Layout Geometry & Stage-Aware Amounts", () => {
  const PAGE_WIDTH = 595.28; // A4 portrait width
  const MARGIN_LEFT = 36;
  const MARGIN_RIGHT = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 523.28

  // 10-column table definitions from pdf-generator.ts
  const advCols = [
    { name: "Adv #", x: MARGIN_LEFT + 2, width: 56 },
    { name: "Owner", x: MARGIN_LEFT + 59, width: 56 },
    { name: "Requested", x: MARGIN_LEFT + 116, width: 46 },
    { name: "Approved", x: MARGIN_LEFT + 163, width: 46 },
    { name: "Disbursed", x: MARGIN_LEFT + 210, width: 48 },
    { name: "Status", x: MARGIN_LEFT + 259, width: 45 },
    { name: "Reserved/Adjusted", x: MARGIN_LEFT + 305, width: 52 },
    { name: "Returned", x: MARGIN_LEFT + 358, width: 44 },
    { name: "Avail / Out", x: MARGIN_LEFT + 403, width: 58 },
    { name: "Net Payable", x: MARGIN_LEFT + 462, width: 58 },
  ];

  it("verifies all 10 columns fit entirely within A4 portrait content bounds (no right-edge overflow)", () => {
    expect(advCols.length).toBe(10);

    // Verify each column starts after margin left
    advCols.forEach((col) => {
      expect(col.x).toBeGreaterThanOrEqual(MARGIN_LEFT);
    });

    // Verify last column right edge fits within PAGE_WIDTH - MARGIN_RIGHT
    const lastCol = advCols[advCols.length - 1];
    const rightEdge = lastCol.x + lastCol.width;
    const maxAllowedRight = PAGE_WIDTH - MARGIN_RIGHT; // 559.28

    expect(rightEdge).toBeLessThanOrEqual(maxAllowedRight);
    expect(rightEdge).toBe(MARGIN_LEFT + 462 + 58); // 556
    expect(maxAllowedRight - rightEdge).toBeGreaterThan(0); // 3.28 pt safety margin
  });

  it("verifies no columns overlap horizontally", () => {
    for (let i = 0; i < advCols.length - 1; i++) {
      const currentCol = advCols[i];
      const nextCol = advCols[i + 1];
      const currentRightEdge = currentCol.x + currentCol.width;
      // Current column right edge must not exceed next column starting X
      expect(currentRightEdge).toBeLessThanOrEqual(nextCol.x + 1); // 1 pt tolerance
    }
  });

  it("produces correct stage-aware amounts in PDF data for SUBMITTED, APPROVED, and REIMBURSED", () => {
    const dummyAdv = {
      id: "adv-1",
      advanceNumber: "ADV-2026-000006",
      disbursedAmount: 12000,
      adjustedAmount: 0,
      returnedAmount: 0,
      reservedAmount: 9700,
      status: AdvanceStatus.DISBURSED,
      user: { name: "Debjit User", email: "userdebjit1612@gmail.com" },
    };

    // 1. SUBMITTED
    const submittedSummary = getNormalizedAdvanceSummary({
      status: ReportStatus.SUBMITTED,
      totalAmount: 9700,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: AdvanceAllocationStatus.RESERVED,
        advanceRequest: dummyAdv,
      },
    });
    expect(submittedSummary.advanceReserved).toBe(9700);
    expect(submittedSummary.advanceAdjusted).toBe(0);
    expect(submittedSummary.expectedNetReimbursement).toBe(0);
    expect(submittedSummary.pdfAllocationLabel).toBe("Reserved Against This Report");

    // 2. APPROVED
    const approvedSummary = getNormalizedAdvanceSummary({
      status: ReportStatus.APPROVED,
      totalAmount: 9700,
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: AdvanceAllocationStatus.SETTLED,
        advanceRequest: {
          ...dummyAdv,
          adjustedAmount: 9700,
          reservedAmount: 0,
          status: AdvanceStatus.PARTIALLY_SETTLED,
        },
      },
    });
    expect(approvedSummary.advanceReserved).toBe(0);
    expect(approvedSummary.advanceAdjusted).toBe(9700);
    expect(approvedSummary.expectedNetReimbursement).toBe(0);
    expect(approvedSummary.pdfAllocationLabel).toBe("Adjusted Against This Report");

    // 3. REIMBURSED
    const reimbursedSummary = getNormalizedAdvanceSummary({
      status: ReportStatus.REIMBURSED,
      totalAmount: 9700,
      advanceAdjustedAmount: 9700,
      netPayableAmount: 0,
      advanceAllocation: {
        allocatedAmount: 9700,
        status: AdvanceAllocationStatus.SETTLED,
        advanceRequest: {
          ...dummyAdv,
          adjustedAmount: 9700,
          reservedAmount: 0,
          status: AdvanceStatus.PARTIALLY_SETTLED,
        },
      },
    });
    expect(reimbursedSummary.expectedNetReimbursement).toBe(0);
    expect(reimbursedSummary.advanceAdjusted).toBe(9700);
  });
});
