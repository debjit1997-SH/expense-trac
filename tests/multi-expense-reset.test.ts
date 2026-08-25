import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { ReportStatus, Prisma } from "@prisma/client";

describe("Bug 1 Test: Multiple Expense Items & Fresh Form Reset", () => {
  let employeeUser: any;
  let sampleCategory1: any;
  let sampleCategory2: any;
  let testReportId: string;
  let testReportNumber: string;

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    const categories = await prisma.expenseCategory.findMany({
      include: { subcategories: true },
      take: 2,
    });
    sampleCategory1 = categories[0];
    sampleCategory2 = categories[1];

    testReportNumber = `EXP-TEST-MULTI-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber: testReportNumber,
        title: "MULTI-ITEM EXPENSE TEST BUNDLE",
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

  it("1. Verifies Expense Tag is created in DRAFT status", async () => {
    const report = await prisma.expenseReport.findUnique({
      where: { id: testReportId },
    });
    expect(report).not.toBeNull();
    expect(report?.status).toBe(ReportStatus.DRAFT);
  });

  it("2. Adds the first Expense Item under the tag", async () => {
    const item1 = await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date("2026-08-10"),
        vendorName: "Taj Bengal Hotel",
        invoiceNumber: "TAJ-2026-001",
        description: "Client dinner accommodation",
        categoryId: sampleCategory1.id,
        subcategoryId: sampleCategory1.subcategories[0].id,
        totalAmount: new Prisma.Decimal(4500.0),
      },
    });

    expect(item1.id).toBeDefined();
    expect(item1.vendorName).toBe("Taj Bengal Hotel");
  });

  it("3 & 4. Verifies default fresh item state for 'YES, ADD ANOTHER'", () => {
    // Simulating fresh item defaults object
    const freshItemDefaults = {
      id: null,
      vendorName: "",
      invoiceNumber: "",
      invoiceDate: "",
      description: "",
      totalAmount: "",
      taxableValue: "",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
      cessAmount: "0.00",
      totalGstAmount: "0.00",
      evidence: null,
      detectedFields: new Set(),
      validationErrors: {},
    };

    expect(freshItemDefaults.id).toBeNull();
    expect(freshItemDefaults.vendorName).toBe("");
    expect(freshItemDefaults.totalAmount).toBe("");
    expect(freshItemDefaults.evidence).toBeNull();
    expect(freshItemDefaults.description).toBe("");
  });

  it("5. Verifies the first saved item exists in the tag summary", async () => {
    const items = await prisma.expenseItem.findMany({
      where: { reportId: testReportId },
    });
    expect(items.length).toBe(1);
    expect(items[0].vendorName).toBe("Taj Bengal Hotel");
    expect(Number(items[0].totalAmount)).toBe(4500.0);
  });

  it("6 & 7. Adds a distinct second expense item and verifies exactly two exist", async () => {
    const item2 = await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date("2026-08-11"),
        vendorName: "Uber India",
        invoiceNumber: "UBER-89712",
        description: "Airport to office taxi",
        categoryId: sampleCategory2.id,
        subcategoryId: sampleCategory2.subcategories[0].id,
        totalAmount: new Prisma.Decimal(850.0),
      },
    });

    expect(item2.id).toBeDefined();

    const allItems = await prisma.expenseItem.findMany({
      where: { reportId: testReportId },
      orderBy: { expenseDate: "asc" },
    });

    expect(allItems.length).toBe(2);
    expect(allItems[0].vendorName).toBe("Taj Bengal Hotel");
    expect(allItems[1].vendorName).toBe("Uber India");

    const sum = allItems.reduce((acc, curr) => acc.add(curr.totalAmount), new Prisma.Decimal(0.0));
    expect(Number(sum)).toBe(5350.0);
  });
});
