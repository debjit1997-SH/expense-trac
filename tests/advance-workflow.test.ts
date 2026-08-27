import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  AdvanceStatus,
  AdvanceAllocationStatus,
  AdvanceTransactionType,
  ReportStatus,
  AccountStatus,
  WorkflowStage,
  AssignmentStatus,
} from "@prisma/client";
import {
  calculateAdvanceBalances,
  canSubmitAdvanceRequest,
  canApproveAdvanceRequest,
  canDisburseAdvance,
  canRecordEmployeeReturn,
  canCancelAdvanceRequest,
  toDecimal,
} from "../src/lib/advance-rules";
import { generateAdvanceNumber } from "../src/lib/advance-number";
import { buildExpensePdfData, generateExpenseSummaryPdf } from "../src/lib/pdf/pdf-generator";
import { getAdvanceRegisterData } from "../src/lib/reports/advance-register-query";
import { generateAdvanceRegisterExcel } from "../src/lib/reports/advance-register-excel";
import { generateAdvanceRegisterPdf } from "../src/lib/reports/advance-register-pdf";

describe("Employee Advance Module, Reporting & Workflow Engine", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  let travelCategory: any;
  let travelSubcategory: any;

  const testAdvanceIds: string[] = [];
  const testReportIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findFirst({ where: { role: Role.USER, status: AccountStatus.ACTIVE } });
    if (!employeeUser) {
      employeeUser = await prisma.user.create({
        data: {
          email: "adv_employee_test@company.com",
          name: "Advance Employee Tester",
          phone: "+919876543991",
          passwordHash: "dummyhash",
          role: Role.USER,
          status: AccountStatus.ACTIVE,
        },
      });
    }

    adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN, status: AccountStatus.ACTIVE } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: "adv_admin_test@company.com",
          name: "Advance Admin Tester",
          phone: "+919876543992",
          passwordHash: "dummyhash",
          role: Role.ADMIN,
          status: AccountStatus.ACTIVE,
        },
      });
    }

    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    travelCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });
    if (!travelCategory) {
      travelCategory = await prisma.expenseCategory.findFirst({
        include: { subcategories: true },
      });
    }
    travelSubcategory = travelCategory?.subcategories[0];
  });

  afterAll(async () => {
    // Clean up created allocations, transactions, reports, and advances
    if (testReportIds.length > 0) {
      await prisma.expenseEvidence.deleteMany({
        where: { reportId: { in: testReportIds } },
      });
      await prisma.expenseItem.deleteMany({
        where: { reportId: { in: testReportIds } },
      });
      await prisma.approvalAssignment.deleteMany({
        where: { expenseReportId: { in: testReportIds } },
      });
      await prisma.workflowRecipient.deleteMany({
        where: { expenseReportId: { in: testReportIds } },
      });
      await prisma.expenseReportDocument.deleteMany({
        where: { expenseReportId: { in: testReportIds } },
      });
      await prisma.advanceAllocation.deleteMany({
        where: { expenseReportId: { in: testReportIds } },
      });
      await prisma.expenseReport.deleteMany({
        where: { id: { in: testReportIds } },
      });
    }

    if (testAdvanceIds.length > 0) {
      await prisma.advanceEvidence.deleteMany({
        where: { advanceRequestId: { in: testAdvanceIds } },
      });
      await prisma.advanceLedgerEntry.deleteMany({
        where: { advanceRequestId: { in: testAdvanceIds } },
      });
      await prisma.advanceAllocation.deleteMany({
        where: { advanceRequestId: { in: testAdvanceIds } },
      });
      await prisma.advanceApprovalAssignment.deleteMany({
        where: { advanceRequestId: { in: testAdvanceIds } },
      });
      await prisma.advanceWorkflowRecipient.deleteMany({
        where: { advanceRequestId: { in: testAdvanceIds } },
      });
      await prisma.advanceRequest.deleteMany({
        where: { id: { in: testAdvanceIds } },
      });
    }
  });

  // -------------------------------------------------------------
  // UNIT TESTS: Domain Rules & Balance Calculations
  // -------------------------------------------------------------
  describe("Advance Domain Rules & Balance Calculators", () => {
    it("should calculate initial balances correctly after disbursement", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.DISBURSED,
        disbursedAmount: 15000,
        adjustedAmount: 0,
        returnedAmount: 0,
        reservedAmount: 0,
      });

      expect(Number(balances.availableBalance)).toBe(15000);
      expect(Number(balances.outstandingBalance)).toBe(15000);
    });

    it("should reflect reserved amounts in available balance but not outstanding balance", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.DISBURSED,
        disbursedAmount: 15000,
        adjustedAmount: 0,
        returnedAmount: 0,
        reservedAmount: 5000,
      });

      // Available = 15000 - 0 - 0 - 5000 = 10000
      expect(Number(balances.availableBalance)).toBe(10000);
      // Outstanding = 15000 - 0 - 0 = 15000 (money is still with employee)
      expect(Number(balances.outstandingBalance)).toBe(15000);
    });

    it("should reduce both available and outstanding balance upon expense settlement", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.PARTIALLY_SETTLED,
        disbursedAmount: 15000,
        adjustedAmount: 6000,
        returnedAmount: 0,
        reservedAmount: 0,
      });

      // Available = 15000 - 6000 = 9000
      expect(Number(balances.availableBalance)).toBe(9000);
      // Outstanding = 15000 - 6000 = 9000
      expect(Number(balances.outstandingBalance)).toBe(9000);
    });

    it("should reach zero available and outstanding balance when return is logged", () => {
      const balances = calculateAdvanceBalances({
        currentStatus: AdvanceStatus.SETTLED,
        disbursedAmount: 15000,
        adjustedAmount: 6000,
        returnedAmount: 9000,
        reservedAmount: 0,
      });

      expect(Number(balances.availableBalance)).toBe(0);
      expect(Number(balances.outstandingBalance)).toBe(0);
    });

    it("should prevent requester from approving own advance request", () => {
      // User trying to approve own request
      const resEmployeeApproveOwn = canApproveAdvanceRequest({
        requesterId: "user_1",
        currentUserId: "user_1",
        currentUserRole: Role.ADMIN,
        status: AdvanceStatus.SUBMITTED,
      });
      expect(resEmployeeApproveOwn.allowed).toBe(false);

      // Another admin approving employee request
      const resAdminApproveOther = canApproveAdvanceRequest({
        requesterId: "user_1",
        currentUserId: "admin_1",
        currentUserRole: Role.ADMIN,
        status: AdvanceStatus.SUBMITTED,
      });
      expect(resAdminApproveOther.allowed).toBe(true);
    });

    it("should allow only SUPERADMIN to disburse advances", () => {
      expect(canDisburseAdvance({ currentUserRole: Role.ADMIN, status: AdvanceStatus.APPROVED }).allowed).toBe(false);
      expect(canDisburseAdvance({ currentUserRole: Role.USER, status: AdvanceStatus.APPROVED }).allowed).toBe(false);
      expect(canDisburseAdvance({ currentUserRole: Role.SUPERADMIN, status: AdvanceStatus.APPROVED }).allowed).toBe(true);
    });

    it("should validate employee return amount limits correctly", () => {
      const validReturn = canRecordEmployeeReturn({
        currentUserRole: Role.SUPERADMIN,
        status: AdvanceStatus.PARTIALLY_SETTLED,
        availableBalance: 5000,
        returnAmount: 3000,
      });
      expect(validReturn.allowed).toBe(true);

      // Exceeds available balance
      const invalidReturn = canRecordEmployeeReturn({
        currentUserRole: Role.SUPERADMIN,
        status: AdvanceStatus.PARTIALLY_SETTLED,
        availableBalance: 5000,
        returnAmount: 6000,
      });
      expect(invalidReturn.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // UNIT TESTS: Sequential Advance Number Generator
  // -------------------------------------------------------------
  describe("Advance Number Generator", () => {
    it("should generate sequential numbers matching ADV-YYYY-XXXXXX format", async () => {
      const num1 = await generateAdvanceNumber();
      const num2 = await generateAdvanceNumber();

      const year = new Date().getFullYear();
      expect(num1).toMatch(new RegExp(`^ADV-${year}-\\d{6}$`));
      expect(num2).toMatch(new RegExp(`^ADV-${year}-\\d{6}$`));
    });
  });

  // -------------------------------------------------------------
  // INTEGRATION TESTS: Complete Advance Lifecycle & Settlements
  // -------------------------------------------------------------
  describe("Advance End-to-End Workflow & Financial Lifecycle", () => {
    let testAdvance: any;
    let testReport: any;

    it("should create an Advance Request in DRAFT status", async () => {
      const advNum = await generateAdvanceNumber();
      testAdvance = await prisma.advanceRequest.create({
        data: {
          advanceNumber: advNum,
          userId: employeeUser.id,
          purpose: "Client on-site deployment in Bengaluru",
          requestedAmount: 12000,
          status: AdvanceStatus.DRAFT,
        },
      });
      testAdvanceIds.push(testAdvance.id);

      expect(testAdvance.status).toBe(AdvanceStatus.DRAFT);
      expect(Number(testAdvance.requestedAmount)).toBe(12000);
    });

    it("should submit advance request and create primary approval assignment", async () => {
      const updated = await prisma.advanceRequest.update({
        where: { id: testAdvance.id },
        data: {
          status: AdvanceStatus.SUBMITTED,
          submittedAt: new Date(),
          approvalAssignments: {
            create: {
              assigneeUserId: adminUser.id,
              assignedByUserId: employeeUser.id,
              status: AssignmentStatus.PENDING,
            },
          },
        },
        include: { approvalAssignments: true },
      });

      expect(updated.status).toBe(AdvanceStatus.SUBMITTED);
      expect(updated.approvalAssignments.length).toBe(1);
      expect(updated.approvalAssignments[0].assigneeUserId).toBe(adminUser.id);
    });

    it("should approve advance request with approved amount", async () => {
      const updated = await prisma.advanceRequest.update({
        where: { id: testAdvance.id },
        data: {
          status: AdvanceStatus.APPROVED,
          approvedAmount: 10000, // Reduced from 12000 to 10000
          approvedById: adminUser.id,
          approvedAt: new Date(),
          approvalNote: "Approved 10,000 for travel and lodging",
        },
      });

      expect(updated.status).toBe(AdvanceStatus.APPROVED);
      expect(Number(updated.approvedAmount)).toBe(10000);
    });

    it("should disburse advance by superadmin and create DISBURSEMENT ledger entry", async () => {
      const updated = await prisma.$transaction(async (tx) => {
        const adv = await tx.advanceRequest.update({
          where: { id: testAdvance.id },
          data: {
            status: AdvanceStatus.DISBURSED,
            disbursedAmount: 10000,
            disbursedById: superadminUser.id,
            disbursedAt: new Date(),
            paymentMode: "BANK_TRANSFER",
            paymentReference: "UTR9876543210",
          },
        });

        await tx.advanceLedgerEntry.create({
          data: {
            advanceRequestId: adv.id,
            type: AdvanceTransactionType.DISBURSEMENT,
            amount: 10000,
            runningBalance: 10000,
            performedById: superadminUser.id,
            paymentMode: "BANK_TRANSFER",
            paymentReference: "UTR9876543210",
            remark: "Initial advance disbursement",
          },
        });

        return adv;
      });

      expect(updated.status).toBe(AdvanceStatus.DISBURSED);
      expect(Number(updated.disbursedAmount)).toBe(10000);

      const entries = await prisma.advanceLedgerEntry.findMany({
        where: { advanceRequestId: testAdvance.id },
      });
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe(AdvanceTransactionType.DISBURSEMENT);
      expect(Number(entries[0].runningBalance)).toBe(10000);
    });

    it("should create expense tag linked to advance, reserve allocation on submission", async () => {
      const dynamicReportNumber = `EXP-${Date.now()}-ADV`;
      // 1. Create Draft Report linked to advance
      testReport = await prisma.expenseReport.create({
        data: {
          reportNumber: dynamicReportNumber,
          title: "BENGALURU TRIP EXPENSES",
          userId: employeeUser.id,
          status: ReportStatus.DRAFT,
          totalAmount: 6500,
          advanceAdjustedAmount: 6500,
          netPayableAmount: 0, // ₹6500 expense fully covered by ₹10000 advance
          advanceAllocation: {
            create: {
              advanceRequestId: testAdvance.id,
              allocatedAmount: 6500,
              status: AdvanceAllocationStatus.RESERVED,
            },
          },
        },
      });
      testReportIds.push(testReport.id);

      // Add an item
      await prisma.expenseItem.create({
        data: {
          reportId: testReport.id,
          expenseDate: new Date(),
          vendorName: "Hotel Bengaluru",
          description: "Hotel Stay",
          totalAmount: 6500,
          taxableValue: 5508.47,
          totalGstAmount: 991.53,
          categoryId: travelCategory.id,
          subcategoryId: travelSubcategory.id,
        },
      });

      // 2. Submit report & update reserved amount on advance
      await prisma.$transaction(async (tx) => {
        await tx.expenseReport.update({
          where: { id: testReport.id },
          data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() },
        });

        await tx.advanceRequest.update({
          where: { id: testAdvance.id },
          data: { reservedAmount: { increment: 6500 } },
        });
      });

      const advAfterSubmit = await prisma.advanceRequest.findUnique({
        where: { id: testAdvance.id },
      });
      expect(Number(advAfterSubmit?.reservedAmount)).toBe(6500);

      const balances = calculateAdvanceBalances({
        currentStatus: advAfterSubmit!.status,
        disbursedAmount: advAfterSubmit!.disbursedAmount,
        adjustedAmount: advAfterSubmit!.adjustedAmount,
        returnedAmount: advAfterSubmit!.returnedAmount,
        reservedAmount: advAfterSubmit!.reservedAmount,
      });
      // Available = 10000 - 6500 reserved = 3500
      expect(Number(balances.availableBalance)).toBe(3500);
      expect(Number(balances.outstandingBalance)).toBe(10000);
    });

    it("should convert allocation from RESERVED to SETTLED and record ledger entry upon admin approval", async () => {
      await prisma.$transaction(async (tx) => {
        // Approve report
        await tx.expenseReport.update({
          where: { id: testReport.id },
          data: {
            status: ReportStatus.APPROVED,
            approvedById: adminUser.id,
            approvedAt: new Date(),
          },
        });

        // Convert allocation to SETTLED
        await tx.advanceAllocation.updateMany({
          where: { expenseReportId: testReport.id },
          data: { status: AdvanceAllocationStatus.SETTLED },
        });

        // Decrement reservation and increment adjusted amount
        const updatedAdv = await tx.advanceRequest.update({
          where: { id: testAdvance.id },
          data: {
            reservedAmount: { decrement: 6500 },
            adjustedAmount: { increment: 6500 },
            status: AdvanceStatus.PARTIALLY_SETTLED,
          },
        });

        const newOut = Number(updatedAdv.disbursedAmount) - Number(updatedAdv.adjustedAmount) - Number(updatedAdv.returnedAmount);

        // Create EXPENSE_ADJUSTMENT ledger entry
        await tx.advanceLedgerEntry.create({
          data: {
            advanceRequestId: testAdvance.id,
            expenseReportId: testReport.id,
            type: AdvanceTransactionType.EXPENSE_ADJUSTMENT,
            amount: 6500,
            runningBalance: newOut,
            performedById: adminUser.id,
            remark: `Expense report ${testReport.reportNumber} approved and settled`,
          },
        });
      });

      const advAfterApprove = await prisma.advanceRequest.findUnique({
        where: { id: testAdvance.id },
      });
      expect(advAfterApprove?.status).toBe(AdvanceStatus.PARTIALLY_SETTLED);
      expect(Number(advAfterApprove?.reservedAmount)).toBe(0);
      expect(Number(advAfterApprove?.adjustedAmount)).toBe(6500);

      const balances = calculateAdvanceBalances({
        currentStatus: advAfterApprove!.status,
        disbursedAmount: advAfterApprove!.disbursedAmount,
        adjustedAmount: advAfterApprove!.adjustedAmount,
        returnedAmount: advAfterApprove!.returnedAmount,
        reservedAmount: advAfterApprove!.reservedAmount,
      });
      expect(Number(balances.availableBalance)).toBe(3500);
      expect(Number(balances.outstandingBalance)).toBe(3500);
    });

    it("should allow superadmin to record returned money and fully settle advance", async () => {
      await prisma.$transaction(async (tx) => {
        const updatedAdv = await tx.advanceRequest.update({
          where: { id: testAdvance.id },
          data: {
            returnedAmount: { increment: 3500 },
            status: AdvanceStatus.SETTLED,
            finalSettledAt: new Date(),
          },
        });

        const newOut = Number(updatedAdv.disbursedAmount) - Number(updatedAdv.adjustedAmount) - Number(updatedAdv.returnedAmount);

        await tx.advanceLedgerEntry.create({
          data: {
            advanceRequestId: testAdvance.id,
            type: AdvanceTransactionType.EMPLOYEE_RETURN,
            amount: 3500,
            runningBalance: newOut,
            performedById: superadminUser.id,
            paymentMode: "UPI",
            paymentReference: "UPI-RET-12345",
            remark: "Unspent travel balance returned by employee",
          },
        });
      });

      const settledAdv = await prisma.advanceRequest.findUnique({
        where: { id: testAdvance.id },
      });
      expect(settledAdv?.status).toBe(AdvanceStatus.SETTLED);
      expect(Number(settledAdv?.returnedAmount)).toBe(3500);
      expect(settledAdv?.finalSettledAt).not.toBeNull();

      const balances = calculateAdvanceBalances({
        currentStatus: settledAdv!.status,
        disbursedAmount: settledAdv!.disbursedAmount,
        adjustedAmount: settledAdv!.adjustedAmount,
        returnedAmount: settledAdv!.returnedAmount,
        reservedAmount: settledAdv!.reservedAmount,
      });
      expect(Number(balances.availableBalance)).toBe(0);
      expect(Number(balances.outstandingBalance)).toBe(0);

      const allEntries = await prisma.advanceLedgerEntry.findMany({
        where: { advanceRequestId: testAdvance.id },
        orderBy: { timestamp: "asc" },
      });
      expect(allEntries.length).toBe(3); // DISBURSEMENT, EXPENSE_ADJUSTMENT, EMPLOYEE_RETURN
      expect(allEntries[2].type).toBe(AdvanceTransactionType.EMPLOYEE_RETURN);
      expect(Number(allEntries[2].runningBalance)).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // PDF ENGINE VERIFICATION (Status label cleanup & advance breakdown)
  // -------------------------------------------------------------
  describe("PDF Status Label Cleanup & Advance Breakdown", () => {
    it("should generate PDF without visible (v1) status suffix", async () => {
      // Create a test report for PDF test
      const rep = await prisma.expenseReport.create({
        data: {
          reportNumber: `EXP-${Date.now()}-PDF`,
          title: "PDF STATUS CLEANUP TEST",
          userId: employeeUser.id,
          status: ReportStatus.SUBMITTED,
          totalAmount: 1000,
          items: {
            create: {
              expenseDate: new Date(),
              vendorName: "Test Vendor",
              description: "Test Desc",
              totalAmount: 1000,
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
            },
          },
        },
      });
      testReportIds.push(rep.id);

      const pdfData = await buildExpensePdfData(rep.id);
      const pdfBytes = await generateExpenseSummaryPdf(pdfData);
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(1000);

      // Verify that versionNumber is still tracked in data object
      expect(pdfData.versionNumber).toBe(1);
      expect(pdfData.workflowStatus).toBe(ReportStatus.SUBMITTED);
    });
  });

  // -------------------------------------------------------------
  // REPORTING & EXPORT VERIFICATION
  // -------------------------------------------------------------
  describe("Advance Register Reporting & Exports", () => {
    it("should query Advance Register data with aggregated totals", async () => {
      const regData = await getAdvanceRegisterData({}, false);

      expect(regData.rows.length).toBeGreaterThanOrEqual(1);
      expect(regData.summaryTotals.totalAdvancesCount).toBeGreaterThanOrEqual(1);
      expect(regData.summaryTotals.totalDisbursed).toBeGreaterThan(0);
    });

    it("should generate Advance Register Excel workbook bytes", async () => {
      const regData = await getAdvanceRegisterData({}, false);

      const excelBuffer = await generateAdvanceRegisterExcel({
        rows: regData.rows,
        summaryTotals: regData.summaryTotals,
        filterParams: {},
        generatedByUser: {
          name: superadminUser.name,
          email: superadminUser.email,
          role: superadminUser.role,
        },
      });

      expect(excelBuffer).toBeInstanceOf(Uint8Array);
      expect(excelBuffer.length).toBeGreaterThan(1000);
    });

    it("should generate Advance Register Landscape PDF bytes", async () => {
      const regData = await getAdvanceRegisterData({}, false);

      const pdfBuffer = await generateAdvanceRegisterPdf({
        rows: regData.rows,
        summaryTotals: regData.summaryTotals,
        filterParams: {},
        generatedByUser: {
          name: superadminUser.name,
          email: superadminUser.email,
          role: superadminUser.role,
        },
      });

      expect(pdfBuffer).toBeInstanceOf(Uint8Array);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });
  });
});
