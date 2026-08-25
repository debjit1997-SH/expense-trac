import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { ReportStatus, Prisma } from "@prisma/client";
import { findDuplicateExpenseItems } from "../src/lib/workflow-rules";
import { logAudit } from "../src/lib/audit";

describe("Bug 2 Test: Duplicate Expense Detection & Override Flow", () => {
  let employeeUser: any;
  let sampleCategory: any;
  let testReportId: string;
  let originalItemId: string;

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    sampleCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });

    const reportNumber = `EXP-TEST-DUP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "DUPLICATE DETECTION TEST REPORT",
        userId: employeeUser.id,
        status: ReportStatus.DRAFT,
        totalAmount: new Prisma.Decimal(0.0),
      },
    });

    testReportId = report.id;
  });

  afterAll(async () => {
    if (testReportId) {
      await prisma.expenseReport.deleteMany({ where: { id: testReportId } });
    }
  });

  it("1. Adds an initial Expense Item", async () => {
    const item = await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date("2026-08-15"),
        vendorName: "Indigo Airlines",
        invoiceNumber: "6E-998231",
        description: "Delhi to Mumbai return flight",
        categoryId: sampleCategory.id,
        subcategoryId: sampleCategory.subcategories[0].id,
        totalAmount: new Prisma.Decimal(6200.0),
      },
    });

    originalItemId = item.id;
    expect(item.id).toBeDefined();
  });

  it("2 & 3. Detects duplicate when attempting to add identical expense item", async () => {
    const candidateItem = {
      expenseDate: "2026-08-15",
      vendorName: "  Indigo Airlines  ", // Test normalization
      invoiceNumber: "6e-998231", // Test lowercase normalization
      totalAmount: 6200.0,
      categoryId: sampleCategory.id,
      subcategoryId: sampleCategory.subcategories[0].id,
      description: "Delhi to Mumbai return flight",
    };

    const dupResult = await findDuplicateExpenseItems({
      reportId: testReportId,
      item: candidateItem,
    });

    expect(dupResult.isDuplicate).toBe(true);
    expect(dupResult.matchedItem).toBeDefined();
    expect(dupResult.matchedItem?.id).toBe(originalItemId);
    expect(dupResult.reason).toContain("Matches existing item");
  });

  it("4. Cancels new expense and verifies no duplicate is created", async () => {
    // Simulating user choosing 'CANCEL NEW EXPENSE'
    const itemsCount = await prisma.expenseItem.count({
      where: { reportId: testReportId },
    });
    expect(itemsCount).toBe(1);
  });

  it("5, 6 & 7. Adds duplicate anyway (Override) and verifies audit log entry", async () => {
    // User proceeds with 'ADD ANYWAY' + confirmation
    const duplicateItem = await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date("2026-08-15"),
        vendorName: "Indigo Airlines",
        invoiceNumber: "6E-998231",
        description: "Delhi to Mumbai return flight (Duplicate approved for coworker)",
        categoryId: sampleCategory.id,
        subcategoryId: sampleCategory.subcategories[0].id,
        totalAmount: new Prisma.Decimal(6200.0),
      },
    });

    await logAudit({
      actorId: employeeUser.id,
      action: "EXPENSE_DUPLICATE_OVERRIDE",
      entityType: "ExpenseItem",
      entityId: duplicateItem.id,
      reportId: testReportId,
      newVal: {
        vendorName: duplicateItem.vendorName,
        amount: duplicateItem.totalAmount.toString(),
        invoiceNumber: duplicateItem.invoiceNumber,
        duplicateOverride: true,
      },
      reason: "User confirmed duplicate override for coworker ticket",
    });

    const itemsCount = await prisma.expenseItem.count({
      where: { reportId: testReportId },
    });
    expect(itemsCount).toBe(2);

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        reportId: testReportId,
        action: "EXPENSE_DUPLICATE_OVERRIDE",
      },
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actorId).toBe(employeeUser.id);
    expect(auditEntry?.reason).toContain("duplicate override");
  });

  it("8. Does not flag item as duplicate when editing and comparing with itself", async () => {
    const editSelfCandidate = {
      expenseDate: "2026-08-15",
      vendorName: "Indigo Airlines",
      invoiceNumber: "6E-998231",
      totalAmount: 6200.0,
      categoryId: sampleCategory.id,
      subcategoryId: sampleCategory.subcategories[0].id,
      description: "Delhi to Mumbai return flight",
    };

    // Passing excludeItemId = originalItemId
    const dupResult = await findDuplicateExpenseItems({
      reportId: testReportId,
      item: editSelfCandidate,
      excludeItemId: originalItemId,
    });

    // Matches the second duplicate item, but originalItemId is excluded
    expect(dupResult.matchedItem?.id).not.toBe(originalItemId);
  });
});
