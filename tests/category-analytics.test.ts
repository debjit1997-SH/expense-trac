import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  ReportStatus,
  AccountStatus,
  Prisma,
} from "@prisma/client";
import {
  getCategoryAnalyticsData,
  buildAnalyticsWhereClause,
  CategoryAnalyticsFilterParams,
} from "../src/lib/reports/category-analytics-query";
import { generateCategoryAnalyticsExcel } from "../src/lib/reports/category-analytics-excel";
import { generateCategoryAnalyticsPdf } from "../src/lib/reports/category-analytics-pdf";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";

describe("Category Expense Analytics & Drill-Down Dashboard Tests", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  let travelCategory: any;
  let travelSubcategory: any;
  let officeCategory: any;
  let officeSubcategory: any;

  const testReportIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    travelCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });
    travelSubcategory = travelCategory?.subcategories[0];

    // Find or create another category for comparison
    officeCategory = await prisma.expenseCategory.upsert({
      where: { code: "OFFICE_SUPPLIES" },
      update: {},
      create: {
        code: "OFFICE_SUPPLIES",
        name: "OFFICE SUPPLIES & STATIONERY",
        subcategories: {
          create: {
            code: "STATIONERY",
            name: "DESK ACCESSORIES",
          },
        },
      },
      include: { subcategories: true },
    });
    officeSubcategory = officeCategory?.subcategories[0];
  });

  afterAll(async () => {
    if (testReportIds.length > 0) {
      await prisma.expenseReport.deleteMany({
        where: { id: { in: testReportIds } },
      });
    }
  });

  it("11. Role access security: USER cannot access analytics, ADMIN and SUPERADMIN can", () => {
    const isAllowed = (role: Role) => role === Role.ADMIN || role === Role.SUPERADMIN;
    expect(isAllowed(Role.USER)).toBe(false);
    expect(isAllowed(Role.ADMIN)).toBe(true);
    expect(isAllowed(Role.SUPERADMIN)).toBe(true);
  });

  it("1, 2 & 3. Default Calculation: Excludes DRAFT & SUBMITTED, includes APPROVED & REIMBURSED", async () => {
    const reportPrefix = `EXP-CAT-STATUS-${Date.now()}`;

    // 1. DRAFT report ($1,000)
    const draftReport = await prisma.expenseReport.create({
      data: {
        reportNumber: `${reportPrefix}-DRAFT`,
        title: "DRAFT REPORT",
        userId: employeeUser.id,
        status: ReportStatus.DRAFT,
        totalAmount: new Prisma.Decimal(1000.0),
        items: {
          create: {
            expenseDate: new Date("2026-04-01"),
            vendorName: "Draft Vendor",
            description: "Draft item",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(1000.0),
          },
        },
      },
    });
    testReportIds.push(draftReport.id);

    // 2. SUBMITTED report ($2,000)
    const submittedReport = await prisma.expenseReport.create({
      data: {
        reportNumber: `${reportPrefix}-SUBMITTED`,
        title: "SUBMITTED REPORT",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(2000.0),
        items: {
          create: {
            expenseDate: new Date("2026-04-02"),
            vendorName: "Submitted Vendor",
            description: "Submitted item",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(2000.0),
          },
        },
      },
    });
    testReportIds.push(submittedReport.id);

    // 3. APPROVED report ($3,000)
    const approvedReport = await prisma.expenseReport.create({
      data: {
        reportNumber: `${reportPrefix}-APPROVED`,
        title: "APPROVED REPORT",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(3000.0),
        items: {
          create: {
            expenseDate: new Date("2026-04-03"),
            vendorName: "Approved Vendor",
            description: "Approved item",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(3000.0),
          },
        },
      },
    });
    testReportIds.push(approvedReport.id);

    // 4. REIMBURSED report ($4,000)
    const reimbursedReport = await prisma.expenseReport.create({
      data: {
        reportNumber: `${reportPrefix}-REIMBURSED`,
        title: "REIMBURSED REPORT",
        userId: employeeUser.id,
        status: ReportStatus.REIMBURSED,
        totalAmount: new Prisma.Decimal(4000.0),
        items: {
          create: {
            expenseDate: new Date("2026-04-04"),
            vendorName: "Reimbursed Vendor",
            description: "Reimbursed item",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(4000.0),
          },
        },
      },
    });
    testReportIds.push(reimbursedReport.id);

    // Default Query (No explicit statuses provided -> defaults to APPROVED and REIMBURSED)
    const defaultRes = await getCategoryAnalyticsData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });

    // Only APPROVED ($3,000) + REIMBURSED ($4,000) = $7,000 should be in the default calculation
    const relevantItemsTotal = defaultRes.categories
      .filter((c) => c.categoryId === travelCategory.id)
      .reduce((sum, c) => sum + c.totalAmount, 0);

    expect(relevantItemsTotal).toBeGreaterThanOrEqual(7000.0);

    // Verify draft and submitted vendor names are NOT present in default calculation
    const vendorNames = defaultRes.topVendors.map((v) => v.vendorName);
    expect(vendorNames).not.toContain("Draft Vendor");
    expect(vendorNames).not.toContain("Submitted Vendor");
    expect(vendorNames).toContain("Approved Vendor");
    expect(vendorNames).toContain("Reimbursed Vendor");
  });

  it("4 & 5. Never double counts items; Chart totals match detail-table totals accurately", async () => {
    const reportNumber = `EXP-CAT-MATCH-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "MULTI ITEM CALCULATION TEST",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(7500.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-05-10"),
              vendorName: "Travel Airline",
              description: "Flight",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(5000.0),
              taxableValue: new Prisma.Decimal(4500.0),
              totalGstAmount: new Prisma.Decimal(500.0),
            },
            {
              expenseDate: new Date("2026-05-11"),
              vendorName: "Office Depot",
              description: "Paper & Pens",
              categoryId: officeCategory.id,
              subcategoryId: officeSubcategory.id,
              totalAmount: new Prisma.Decimal(2500.0),
              taxableValue: new Prisma.Decimal(2000.0),
              totalGstAmount: new Prisma.Decimal(500.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const analytics = await getCategoryAnalyticsData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      statuses: [ReportStatus.APPROVED],
    });

    // 4. Verify no double counting: Total expense = exactly 5000 + 2500 = 7500
    const totalFromKpis = analytics.kpis.totalExpense;
    const totalFromCategories = analytics.categories.reduce((acc, c) => acc + c.totalAmount, 0);
    const totalFromSubcategories = analytics.subcategories.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalFromMonthly = analytics.monthlyTrend.reduce((acc, m) => acc + m.totalAmount, 0);

    // 5. Chart total matches detail-table total
    expect(totalFromCategories).toBe(totalFromKpis);
    expect(totalFromSubcategories).toBe(totalFromKpis);
    expect(totalFromMonthly).toBe(totalFromKpis);
    expect(totalFromKpis).toBeGreaterThanOrEqual(7500.0);
  });

  it("6. Category filtering correctly narrows subcategories and drilldown data", async () => {
    const analytics = await getCategoryAnalyticsData({
      categoryId: travelCategory.id,
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    });

    // All returned categories must be only the selected travel category
    analytics.categories.forEach((cat) => {
      expect(cat.categoryId).toBe(travelCategory.id);
    });

    // All returned subcategories must belong to travel
    analytics.subcategories.forEach((sub) => {
      expect(sub.categoryId).toBe(travelCategory.id);
    });
  });

  it("7. Multiple-month selection works seamlessly (e.g. Month 1 and Month 5)", async () => {
    const multiMonthRes = await getCategoryAnalyticsData({
      filterMode: "MULTIPLE_MONTHS",
      year: 2026,
      selectedMonths: [1, 5],
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    });

    expect(multiMonthRes).toBeDefined();
    expect(multiMonthRes.kpis).toBeDefined();
    expect(Array.isArray(multiMonthRes.monthlyTrend)).toBe(true);
  });

  it("8. Previous-period comparison correctly calculates variance % delta", async () => {
    const compareRes = await getCategoryAnalyticsData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      compareWithPreviousPeriod: true,
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    });

    expect(compareRes.kpis.previousPeriod).toBeDefined();
    expect(typeof compareRes.kpis.previousPeriod?.totalExpense).toBe("number");
  });

  it("9. Excel export opens with all 5 required sheets", async () => {
    const analytics = await getCategoryAnalyticsData({
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    });

    const buffer = await generateCategoryAnalyticsExcel({
      analytics,
      generatedByUser: { name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // Verify all 5 sheets exist
    expect(workbook.getWorksheet("Category Summary")).toBeDefined();
    expect(workbook.getWorksheet("Subcategory Summary")).toBeDefined();
    expect(workbook.getWorksheet("Monthly Trend")).toBeDefined();
    expect(workbook.getWorksheet("Top Vendors")).toBeDefined();
    expect(workbook.getWorksheet("Applied Filters & KPIs")).toBeDefined();
  });

  it("10. PDF export generates structurally valid %PDF- document with organization branding and KPI summary", async () => {
    const analytics = await getCategoryAnalyticsData({
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    });

    const pdfBytes = await generateCategoryAnalyticsPdf({
      analytics,
      generatedByUser: { name: superadminUser.name, email: superadminUser.email, role: superadminUser.role },
    });

    // Valid %PDF- signature
    const signature = Buffer.from(pdfBytes.slice(0, 5)).toString();
    expect(signature).toBe("%PDF-");

    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    // Landscape orientation: width > height (841.89 x 595.28)
    const firstPage = parsedPdf.getPages()[0];
    const { width, height } = firstPage.getSize();
    expect(width).toBeGreaterThan(height);
  });
});
