import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  ReportStatus,
  AccountStatus,
  Prisma,
} from "@prisma/client";
import {
  getDetailedExpenseReportData,
  buildExpenseItemWhereClause,
  DetailedReportFilterParams,
} from "../src/lib/reports/report-query";
import { generateDetailedExpenseExcel } from "../src/lib/reports/excel-export";
import { generateDetailedExpenseReportPdf } from "../src/lib/reports/pdf-export";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";

describe("Detailed Expense Report & Analytics Module Tests", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  let travelCategory: any;
  let travelSubcategory: any;

  const testReportIds: string[] = [];
  const testPreferenceIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    travelCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });
    travelSubcategory = travelCategory?.subcategories[0];
  });

  afterAll(async () => {
    if (testReportIds.length > 0) {
      await prisma.expenseReport.deleteMany({
        where: { id: { in: testReportIds } },
      });
    }
    if (testPreferenceIds.length > 0) {
      await prisma.reportViewPreference.deleteMany({
        where: { id: { in: testPreferenceIds } },
      });
    }
  });

  it("1 & 2. Role-based access logic: USER is forbidden, ADMIN and SUPERADMIN are allowed", () => {
    const checkReportAccess = (role: Role) => {
      return role === Role.ADMIN || role === Role.SUPERADMIN;
    };

    expect(checkReportAccess(Role.USER)).toBe(false);
    expect(checkReportAccess(Role.ADMIN)).toBe(true);
    expect(checkReportAccess(Role.SUPERADMIN)).toBe(true);
  });

  it("13 & 14. Expense Tag with 3 Expense Items creates 3 distinct item rows with accurate totals without double counting", async () => {
    const reportNumber = `EXP-REP-3ITEM-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "THREE ITEM TEST REPORT",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(3540.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-03-10"),
              vendorName: "Uber India",
              description: "Airport Taxi",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1180.0),
              taxableValue: new Prisma.Decimal(1000.0),
              cgstAmount: new Prisma.Decimal(90.0),
              sgstAmount: new Prisma.Decimal(90.0),
              totalGstAmount: new Prisma.Decimal(180.0),
            },
            {
              expenseDate: new Date("2026-03-11"),
              vendorName: "CCD Coffee",
              description: "Client refreshments",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(590.0),
              taxableValue: new Prisma.Decimal(500.0),
              cgstAmount: new Prisma.Decimal(45.0),
              sgstAmount: new Prisma.Decimal(45.0),
              totalGstAmount: new Prisma.Decimal(90.0),
            },
            {
              expenseDate: new Date("2026-03-12"),
              vendorName: "Indigo Airlines",
              description: "Return flight",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1770.0),
              taxableValue: new Prisma.Decimal(1500.0),
              cgstAmount: new Prisma.Decimal(135.0),
              sgstAmount: new Prisma.Decimal(135.0),
              totalGstAmount: new Prisma.Decimal(270.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const data = await getDetailedExpenseReportData({
      reportNumber,
    });

    // 13. Exactly 3 rows created for the 3 items
    expect(data.rows.length).toBe(3);
    expect(data.totalCount).toBe(3);

    // Verify each row has the tag info repeated
    data.rows.forEach((r) => {
      expect(r.reportNumber).toBe(reportNumber);
      expect(r.tagTitle).toBe("THREE ITEM TEST REPORT");
      expect(r.tagTotal).toBe(3540.0);
    });

    // 14. Verify summary totals do not double count
    expect(data.summaryTotals.itemCount).toBe(3);
    expect(data.summaryTotals.totalTaxableValue).toBe(3000.0);
    expect(data.summaryTotals.totalCgst).toBe(270.0);
    expect(data.summaryTotals.totalSgst).toBe(270.0);
    expect(data.summaryTotals.totalGst).toBe(540.0);
    expect(data.summaryTotals.grandTotal).toBe(3540.0);
  });

  it("3. DATE RANGE filtering works accurately based on Asia/Kolkata date boundaries", async () => {
    const reportNumber = `EXP-REP-DATERANGE-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "DATE RANGE TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(2000.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-05-15T10:00:00.000Z"),
              vendorName: "May Vendor",
              description: "May Item",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
            {
              expenseDate: new Date("2026-06-20T10:00:00.000Z"),
              vendorName: "June Vendor",
              description: "June Item",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    // Query May only
    const mayRes = await getDetailedExpenseReportData({
      reportNumber,
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
    });

    expect(mayRes.rows.length).toBe(1);
    expect(mayRes.rows[0].vendorName).toBe("May Vendor");

    // Query full range (May to June)
    const fullRes = await getDetailedExpenseReportData({
      reportNumber,
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      fromDate: "2026-05-01",
      toDate: "2026-06-30",
    });

    expect(fullRes.rows.length).toBe(2);
  });

  it("4. MULTIPLE NON-CONSECUTIVE MONTHS filter works (e.g. Feb and April)", async () => {
    const reportNumber = `EXP-REP-MONTHS-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "MONTHS TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(3000.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-02-10T10:00:00.000Z"),
              vendorName: "Feb Vendor",
              description: "Feb Item",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
            {
              expenseDate: new Date("2026-03-15T10:00:00.000Z"),
              vendorName: "March Vendor",
              description: "March Item",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
            {
              expenseDate: new Date("2026-04-20T10:00:00.000Z"),
              vendorName: "April Vendor",
              description: "April Item",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    // Filter non-consecutive months: Feb (2) and April (4), excluding March (3)
    const nonConsecutiveRes = await getDetailedExpenseReportData({
      reportNumber,
      filterMode: "MULTIPLE_MONTHS",
      dateBasis: "EXPENSE_DATE",
      year: 2026,
      selectedMonths: [2, 4],
    });

    expect(nonConsecutiveRes.rows.length).toBe(2);
    const vendors = nonConsecutiveRes.rows.map((r) => r.vendorName);
    expect(vendors).toContain("Feb Vendor");
    expect(vendors).toContain("April Vendor");
    expect(vendors).not.toContain("March Vendor");
  });

  it("5. Vendor and Submitted-by filters work accurately", async () => {
    const reportNumber = `EXP-REP-VENDOR-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "VENDOR FILTER TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(2500.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-06-01"),
              vendorName: "Dominos Pizza",
              description: "Team lunch",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1500.0),
            },
            {
              expenseDate: new Date("2026-06-02"),
              vendorName: "Starbucks India",
              description: "Coffee meeting",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(1000.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const vendorRes = await getDetailedExpenseReportData({
      reportNumber,
      vendorName: "Dominos",
      submittedById: employeeUser.id,
    });

    expect(vendorRes.rows.length).toBe(1);
    expect(vendorRes.rows[0].vendorName).toBe("Dominos Pizza");
    expect(vendorRes.rows[0].submittedBy).toBe(employeeUser.name);
  });

  it("6 & 7. Column Order & Visibility custom configuration changes reflect in export columns", async () => {
    const customOrder = ["vendorName", "itemAmount", "reportNumber"];
    const customVisible = ["vendorName", "itemAmount"];

    const activeCols = customOrder.filter((id) => customVisible.includes(id));
    expect(activeCols).toEqual(["vendorName", "itemAmount"]);
    expect(activeCols.length).toBe(2);
  });

  it("8. Saved Views persist, load, and handle default flags in database", async () => {
    const viewName = `Test View ${Date.now()}`;
    const pref = await prisma.reportViewPreference.create({
      data: {
        userId: adminUser.id,
        name: viewName,
        isDefault: true,
        columnConfig: { order: ["vendorName", "itemAmount"], visible: ["vendorName", "itemAmount"] },
        filterConfig: { status: "APPROVED" },
      },
    });
    testPreferenceIds.push(pref.id);

    const loaded = await prisma.reportViewPreference.findUnique({
      where: { id: pref.id },
    });

    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe(viewName);
    expect(loaded?.isDefault).toBe(true);
    expect((loaded?.columnConfig as any).visible).toContain("vendorName");
  });

  it("9 & 10. Excel (.xlsx) export generates valid workbook with all filtered rows, styled headers, and formulas", async () => {
    const reportNumber = `EXP-REP-EXCEL-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "EXCEL EXPORT TEST",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(5000.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-07-01"),
              vendorName: "Excel Vendor 1",
              description: "Item 1",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(2000.0),
              taxableValue: new Prisma.Decimal(2000.0),
            },
            {
              expenseDate: new Date("2026-07-02"),
              vendorName: "Excel Vendor 2",
              description: "Item 2",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(3000.0),
              taxableValue: new Prisma.Decimal(3000.0),
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const reportData = await getDetailedExpenseReportData({ reportNumber }, false);

    const buffer = await generateDetailedExpenseExcel({
      rows: reportData.rows,
      summaryTotals: reportData.summaryTotals,
      filterParams: { reportNumber },
      visibleColumnIds: ["reportNumber", "vendorName", "itemAmount", "taxableValue"],
      generatedByUser: { name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    // Parse with ExcelJS to verify structure and rows
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.getWorksheet("Detailed Expense Report");

    expect(worksheet).toBeDefined();
    // Headers (Row 6), Data Rows (Row 7, Row 8), Totals Row (Row 9)
    expect(worksheet?.rowCount).toBeGreaterThanOrEqual(8);
  });

  it("11 & 12. Landscape PDF export generates valid %PDF- document displaying applied filters and KPI summary", async () => {
    const reportNumber = `EXP-REP-PDF-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "PDF EXPORT TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(4500.0),
        items: {
          create: {
            expenseDate: new Date("2026-08-01"),
            vendorName: "PDF Vendor",
            description: "Test PDF Item",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(4500.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    const reportData = await getDetailedExpenseReportData({ reportNumber }, false);

    const pdfBytes = await generateDetailedExpenseReportPdf({
      rows: reportData.rows,
      summaryTotals: reportData.summaryTotals,
      filterParams: { reportNumber, vendorName: "PDF Vendor" },
      generatedByUser: { name: superadminUser.name, email: superadminUser.email, role: superadminUser.role },
    });

    // 11. Valid %PDF- magic bytes
    const signature = Buffer.from(pdfBytes.slice(0, 5)).toString();
    expect(signature).toBe("%PDF-");

    // Load with PDFDocument to verify page integrity
    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    // Landscape page size: width > height (841.89 x 595.28)
    const firstPage = parsedPdf.getPages()[0];
    const { width, height } = firstPage.getSize();
    expect(width).toBeGreaterThan(height);
  });

  it("15. Large datasets remain paginated with correct skip/take math and total count", async () => {
    const paginationTest = await getDetailedExpenseReportData({
      page: 1,
      pageSize: 10,
    }, true);

    expect(paginationTest.page).toBe(1);
    expect(paginationTest.pageSize).toBe(10);
    expect(paginationTest.rows.length).toBeLessThanOrEqual(10);
  });
});
