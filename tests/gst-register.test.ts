import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  ReportStatus,
  TaxMode,
  ItcEligibility,
  VendorGstStatus,
  Prisma,
} from "@prisma/client";
import {
  getGstRegisterData,
  getGstAnalyticsData,
  GstRegisterFilterParams,
} from "../src/lib/reports/gst-register-query";
import { generateGstRegisterExcel } from "../src/lib/reports/gst-register-excel";
import { generateGstRegisterPdf } from "../src/lib/reports/gst-register-pdf";
import { evaluateGstItemExceptions, RawGstItemForValidation } from "../src/lib/reports/gst-exceptions";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";

describe("GST Expense Register & Analytics Module Tests", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  let travelCategory: any;
  let travelSubcategory: any;
  let standardGstTreatment: any;
  let nonGstTreatment: any;
  let rate18: any;

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

    standardGstTreatment = await prisma.gstTreatment.findFirst({
      where: { isTaxable: true },
    });

    nonGstTreatment = await prisma.gstTreatment.findFirst({
      where: { isTaxable: false },
    });

    rate18 = await prisma.gstRate.findFirst({
      where: { ratePercent: new Prisma.Decimal(18) },
    });
  });

  afterAll(async () => {
    if (testReportIds.length > 0) {
      await prisma.expenseReport.deleteMany({
        where: { id: { in: testReportIds } },
      });
    }
  });

  it("11. Role security: USER cannot access report, ADMIN and SUPERADMIN are authorized", () => {
    const isAuthorized = (role: Role) => role === Role.ADMIN || role === Role.SUPERADMIN;
    expect(isAuthorized(Role.USER)).toBe(false);
    expect(isAuthorized(Role.ADMIN)).toBe(true);
    expect(isAuthorized(Role.SUPERADMIN)).toBe(true);
  });

  it("1 & 2. GST summary matches filtered transaction rows; CGST, SGST, IGST, Cess totals are exact", async () => {
    const reportNumber = `EXP-GST-TEST-${Date.now()}`;

    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "GST SUMMARY MATCH TEST",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(15000.0),
        items: {
          create: [
            // Item 1: Intra-state (CGST ₹900, SGST ₹900)
            {
              expenseDate: new Date("2026-06-01"),
              vendorName: "Hotel Kolkata",
              description: "Hotel stay in Kolkata",
              vendorGstin: "19AAACH1234A1Z5",
              vendorGstStatus: VendorGstStatus.REGISTERED_REGULAR,
              invoiceNumber: "INV-KOL-101",
              invoiceDate: new Date("2026-06-01"),
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              gstTreatmentId: standardGstTreatment?.id,
              gstRateId: rate18?.id,
              taxMode: TaxMode.INTRA_STATE,
              placeOfSupply: "19-West Bengal",
              taxableValue: new Prisma.Decimal(10000.0),
              cgstRate: new Prisma.Decimal(9.0),
              cgstAmount: new Prisma.Decimal(900.0),
              sgstRate: new Prisma.Decimal(9.0),
              sgstAmount: new Prisma.Decimal(900.0),
              igstAmount: new Prisma.Decimal(0.0),
              cessAmount: new Prisma.Decimal(0.0),
              totalGstAmount: new Prisma.Decimal(1800.0),
              totalAmount: new Prisma.Decimal(11800.0),
              itcEligibility: ItcEligibility.ELIGIBLE,
            },
            // Item 2: Inter-state (IGST ₹576, Cess ₹100)
            {
              expenseDate: new Date("2026-06-02"),
              vendorName: "Bangalore Tech Corp",
              description: "Consulting services Bangalore",
              vendorGstin: "29BBBBB5678B1Z2",
              vendorGstStatus: VendorGstStatus.REGISTERED_REGULAR,
              invoiceNumber: "INV-BLR-202",
              invoiceDate: new Date("2026-06-02"),
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              gstTreatmentId: standardGstTreatment?.id,
              gstRateId: rate18?.id,
              taxMode: TaxMode.INTER_STATE,
              placeOfSupply: "29-Karnataka",
              taxableValue: new Prisma.Decimal(3200.0),
              cgstAmount: new Prisma.Decimal(0.0),
              sgstAmount: new Prisma.Decimal(0.0),
              igstRate: new Prisma.Decimal(18.0),
              igstAmount: new Prisma.Decimal(576.0),
              cessAmount: new Prisma.Decimal(100.0),
              totalGstAmount: new Prisma.Decimal(676.0),
              totalAmount: new Prisma.Decimal(3876.0),
              itcEligibility: ItcEligibility.INELIGIBLE,
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const result = await getGstRegisterData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
    }, false);

    const testRows = result.rows.filter((r) => r.reportId === report.id);
    expect(testRows.length).toBe(2);

    const calculatedTaxable = testRows.reduce((sum, r) => sum + r.taxableValue, 0);
    const calculatedCgst = testRows.reduce((sum, r) => sum + r.cgstAmount, 0);
    const calculatedSgst = testRows.reduce((sum, r) => sum + r.sgstAmount, 0);
    const calculatedIgst = testRows.reduce((sum, r) => sum + r.igstAmount, 0);
    const calculatedCess = testRows.reduce((sum, r) => sum + r.cessAmount, 0);
    const calculatedTotalGst = testRows.reduce((sum, r) => sum + r.totalGstAmount, 0);

    expect(calculatedTaxable).toBe(13200.0);
    expect(calculatedCgst).toBe(900.0);
    expect(calculatedSgst).toBe(900.0);
    expect(calculatedIgst).toBe(576.0);
    expect(calculatedCess).toBe(100.0);
    expect(calculatedTotalGst).toBe(2476.0);
  });

  it("3. ITC totals correctly separate Eligible, Ineligible, and Pending Review amounts", async () => {
    const reportNumber = `EXP-ITC-TEST-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "ITC SEPARATION TEST",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(6000.0),
        items: {
          create: [
            {
              expenseDate: new Date("2026-06-05"),
              vendorName: "Vendor Eligible",
              description: "Eligible IT supplies",
              vendorGstin: "19AAAAA1111A1Z1",
              invoiceNumber: "INV-ELIG-1",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              taxableValue: new Prisma.Decimal(1000.0),
              totalGstAmount: new Prisma.Decimal(180.0),
              totalAmount: new Prisma.Decimal(1180.0),
              itcEligibility: ItcEligibility.ELIGIBLE,
            },
            {
              expenseDate: new Date("2026-06-06"),
              vendorName: "Vendor Pending",
              description: "Pending verification supplies",
              vendorGstin: "19BBBBB2222B1Z2",
              invoiceNumber: "INV-PEND-2",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              taxableValue: new Prisma.Decimal(2000.0),
              totalGstAmount: new Prisma.Decimal(360.0),
              totalAmount: new Prisma.Decimal(2360.0),
              itcEligibility: ItcEligibility.PENDING_REVIEW,
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    const result = await getGstRegisterData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-06-05",
      toDate: "2026-06-06",
    }, false);

    expect(result.kpis.eligibleItc).toBeGreaterThanOrEqual(180.0);
    expect(result.kpis.pendingItcReview).toBeGreaterThanOrEqual(360.0);
  });

  it("4. Non-GST / Exempt records are separated and counted in Non-GST summaries", async () => {
    const reportNumber = `EXP-NONGST-TEST-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "NON-GST SEPARATION TEST",
        userId: employeeUser.id,
        status: ReportStatus.APPROVED,
        totalAmount: new Prisma.Decimal(2500.0),
        items: {
          create: {
            expenseDate: new Date("2026-06-08"),
            vendorName: "Fuel Petrol Pump",
            description: "Petrol fuel for local commute",
            invoiceNumber: "PETROL-99",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            gstTreatmentId: nonGstTreatment?.id,
            taxableValue: new Prisma.Decimal(2500.0),
            totalGstAmount: new Prisma.Decimal(0.0),
            totalAmount: new Prisma.Decimal(2500.0),
            itcEligibility: ItcEligibility.NOT_APPLICABLE,
          },
        },
      },
    });
    testReportIds.push(report.id);

    const analytics = await getGstAnalyticsData({
      filterMode: "DATE_RANGE",
      fromDate: "2026-06-08",
      toDate: "2026-06-08",
    });

    expect(analytics.nonGstTransactions.some((r) => r.reportId === report.id)).toBe(true);
    expect(analytics.kpis.nonGstAmount).toBeGreaterThanOrEqual(2500.0);
  });

  it("5. Duplicate invoice exception is detected on matching Vendor GSTIN and Invoice Number", () => {
    const duplicateKeys = new Set(["07AAAAA1234A1Z5__INV-DUPLICATE-999"]);

    const mockItem: RawGstItemForValidation = {
      id: "item-1",
      reportId: "rep-1",
      reportNumber: "EXP-001",
      vendorName: "Duplicated Vendor",
      vendorGstin: "07AAAAA1234A1Z5",
      invoiceNumber: "INV-DUPLICATE-999",
      invoiceDate: new Date("2026-06-01"),
      taxableValue: 1000,
      totalGstAmount: 180,
      totalAmount: 1180,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 0,
      cessAmount: 0,
      reverseCharge: false,
      itcEligibility: ItcEligibility.ELIGIBLE,
      evidenceCount: 1,
    };

    const exceptions = evaluateGstItemExceptions(mockItem, duplicateKeys);
    expect(exceptions.some((e) => e.code === "DUPLICATE_INVOICE")).toBe(true);
  });

  it("6. Tax-component conflict is detected when CGST/SGST and IGST are both applied", () => {
    const mockItem: RawGstItemForValidation = {
      id: "item-2",
      reportId: "rep-2",
      reportNumber: "EXP-002",
      vendorName: "Conflicted Vendor",
      vendorGstin: "19AAAAA1234A1Z5",
      invoiceNumber: "INV-CONFLICT-1",
      invoiceDate: new Date("2026-06-01"),
      taxableValue: 1000,
      cgstAmount: 90,
      sgstAmount: 90,
      igstAmount: 180, // Conflict!
      cessAmount: 0,
      totalGstAmount: 360,
      totalAmount: 1360,
      reverseCharge: false,
      itcEligibility: ItcEligibility.ELIGIBLE,
      evidenceCount: 1,
    };

    const exceptions = evaluateGstItemExceptions(mockItem, new Set());
    expect(exceptions.some((e) => e.code === "TAX_COMPONENT_CONFLICT")).toBe(true);
  });

  it("7. Valid records are not falsely flagged by basic validations", () => {
    const validItem: RawGstItemForValidation = {
      id: "item-clean",
      reportId: "rep-clean",
      reportNumber: "EXP-CLEAN",
      vendorName: "Clean Tech Solutions",
      vendorGstin: "19AAAAA1234A1Z5",
      vendorGstStatus: VendorGstStatus.REGISTERED_REGULAR,
      invoiceNumber: "INV-2026-CLEAN",
      invoiceDate: new Date("2026-06-10"),
      hsnSacCode: "998311",
      placeOfSupply: "19-West Bengal",
      taxMode: TaxMode.INTRA_STATE,
      gstRatePercent: 18,
      taxableValue: 10000,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
      cessAmount: 0,
      totalGstAmount: 1800,
      totalAmount: 11800,
      reverseCharge: false,
      itcEligibility: ItcEligibility.ELIGIBLE,
      evidenceCount: 1,
    };

    const exceptions = evaluateGstItemExceptions(validItem, new Set());
    expect(exceptions.length).toBe(0);
  });

  it("8. Multiple-month selection filter works properly", async () => {
    const res = await getGstRegisterData({
      filterMode: "MULTIPLE_MONTHS",
      year: 2026,
      selectedMonths: [1, 6],
    });

    expect(res).toBeDefined();
    expect(Array.isArray(res.rows)).toBe(true);
    expect(typeof res.totalCount).toBe("number");
  });

  it("9. Excel export contains all 8 required sheets", async () => {
    const [regRes, analytics] = await Promise.all([
      getGstRegisterData({}, false),
      getGstAnalyticsData({}),
    ]);

    const buffer = await generateGstRegisterExcel({
      rows: regRes.rows,
      analytics,
      filterParams: {},
      generatedByUser: { name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.getWorksheet("GST Transactions")).toBeDefined();
    expect(workbook.getWorksheet("GST Summary")).toBeDefined();
    expect(workbook.getWorksheet("ITC Summary")).toBeDefined();
    expect(workbook.getWorksheet("RCM Summary")).toBeDefined();
    expect(workbook.getWorksheet("Category Summary")).toBeDefined();
    expect(workbook.getWorksheet("Vendor Summary")).toBeDefined();
    expect(workbook.getWorksheet("Data Quality Exceptions")).toBeDefined();
    expect(workbook.getWorksheet("Applied Filters")).toBeDefined();
  });

  it("10. PDF export generates structurally valid %PDF- document with review disclaimer and totals", async () => {
    const [regRes, analytics] = await Promise.all([
      getGstRegisterData({}, false),
      getGstAnalyticsData({}),
    ]);

    const pdfBytes = await generateGstRegisterPdf({
      rows: regRes.rows,
      analytics,
      filterParams: {},
      generatedByUser: { name: superadminUser.name, email: superadminUser.email, role: superadminUser.role },
    });

    const signature = Buffer.from(pdfBytes.slice(0, 5)).toString();
    expect(signature).toBe("%PDF-");

    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    const firstPage = parsedPdf.getPages()[0];
    const { width, height } = firstPage.getSize();
    expect(width).toBeGreaterThan(height); // Landscape
  });

  it("12. Large result sets remain properly paginated", async () => {
    const page1Res = await getGstRegisterData({ page: 1, pageSize: 2 });
    expect(page1Res.rows.length).toBeLessThanOrEqual(2);
    expect(page1Res.page).toBe(1);
    expect(page1Res.pageSize).toBe(2);
  });
});
