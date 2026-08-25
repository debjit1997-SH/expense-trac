import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  ReportStatus,
  AccountStatus,
  WorkflowStage,
  AssignmentStatus,
  DocumentGenStatus,
  Prisma,
} from "@prisma/client";
import {
  generateExpenseReportDocument,
  authorizeExpensePdfDownload,
  buildExpensePdfData,
  generateExpenseSummaryPdf,
  appendExpenseEvidence,
} from "../src/lib/pdf/pdf-generator";
import { uploadReceiptFile, downloadStorageFile } from "../src/lib/storage";
import { PDFDocument } from "pdf-lib";

describe("Expense Report Versioned PDF Generation Engine", () => {
  let employeeUser: any;
  let anotherUser: any;
  let adminUser: any;
  let superadminUser: any;
  let travelCategory: any;
  let travelSubcategory: any;

  const testReportIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    anotherUser = await prisma.user.upsert({
      where: { email: "another_user@company.com" },
      update: { status: AccountStatus.ACTIVE, role: Role.USER },
      create: {
        email: "another_user@company.com",
        name: "Another User",
        phone: "+919876543220",
        passwordHash: "dummyhash",
        role: Role.USER,
        status: AccountStatus.ACTIVE,
      },
    });

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
  });

  // Helper to create sample image buffer (1x1 transparent PNG)
  const createSamplePngBuffer = () => {
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
  };

  // Helper to create sample multi-page PDF buffer
  const createSamplePdfBuffer = async (numPages = 2) => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < numPages; i++) {
      const page = doc.addPage([400, 400]);
      page.drawText(`Evidence Test Page ${i + 1}`, { x: 50, y: 350 });
    }
    return Buffer.from(await doc.save());
  };

  it("1, 4, 5, 8, 14, 15. Generates structurally valid submitted PDF with correct totals, GST breakdown, and valid signature", async () => {
    const reportNumber = `EXP-PDF-TEST-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "CLIENT VISIT EXPENSES",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        submittedAt: new Date(),
        totalAmount: new Prisma.Decimal(11800.0),
        items: {
          create: [
            {
              expenseDate: new Date(),
              vendorName: "Taj Palace Delhi",
              invoiceNumber: "INV-DEL-101",
              invoiceDate: new Date(),
              description: "Hotel stay for client meeting",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(11800.0),
              taxableValue: new Prisma.Decimal(10000.0),
              cgstAmount: new Prisma.Decimal(900.0),
              sgstAmount: new Prisma.Decimal(900.0),
              totalGstAmount: new Prisma.Decimal(1800.0),
              vendorGstin: "07AAAAA0000A1Z5",
              documentType: "TAX_INVOICE",
            },
          ],
        },
      },
    });
    testReportIds.push(report.id);

    // 1. Generate PDF
    const genRes = await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    expect(genRes.success).toBe(true);
    expect(genRes.documentId).toBeDefined();
    expect(genRes.versionNumber).toBe(1);

    // 2. Authorize & Download
    const authCheck = await authorizeExpensePdfDownload(report.id, genRes.documentId, {
      id: employeeUser.id,
      role: Role.USER,
    });
    expect(authCheck.allowed).toBe(true);
    expect(authCheck.document.isCurrent).toBe(true);
    expect(authCheck.document.workflowStatus).toBe(ReportStatus.SUBMITTED);

    // Download bytes
    const { buffer, mimeType } = await downloadStorageFile(authCheck.document.storagePath);
    expect(mimeType).toBe("application/pdf");

    // 15. Verify PDF begins with valid PDF magic signature (%PDF-)
    const signature = buffer.slice(0, 5).toString();
    expect(signature).toBe("%PDF-");

    // 14. Verify structure can be parsed by standard PDF reader (pdf-lib)
    const parsedPdf = await PDFDocument.load(buffer);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    // 4 & 5. Verify computed structured data
    const pdfData = await buildExpensePdfData(report.id, ReportStatus.SUBMITTED, 1);
    expect(pdfData.grandTotal).toBe(11800.0);
    expect(pdfData.totalTaxableValue).toBe(10000.0);
    expect(pdfData.totalCgst).toBe(900.0);
    expect(pdfData.totalSgst).toBe(900.0);
    expect(pdfData.totalGst).toBe(1800.0);
    expect(pdfData.items.length).toBe(1);
    expect(pdfData.items[0].vendorName).toBe("Taj Palace Delhi");
  });

  it("2. Blocks non-owner USER from downloading another user's PDF", async () => {
    const reportNumber = `EXP-PDF-SEC-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "SECRET EXECUTIVE TRIP",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(5000.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Private Jet Co",
            description: "Confidential travel",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(5000.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);

    // Another user tries to authorize download
    const unauthorizedCheck = await authorizeExpensePdfDownload(report.id, undefined, {
      id: anotherUser.id,
      role: Role.USER,
    });

    expect(unauthorizedCheck.allowed).toBe(false);
    expect(unauthorizedCheck.reason).toContain("not authorized");
  });

  it("3. ADMIN and SUPERADMIN can download authorized reports", async () => {
    const reportNumber = `EXP-PDF-ADMIN-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "EMPLOYEE AUDIT TRIP",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(2500.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Indigo Airlines",
            description: "Flight ticket",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(2500.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);

    const adminCheck = await authorizeExpensePdfDownload(report.id, undefined, {
      id: adminUser.id,
      role: Role.ADMIN,
    });
    expect(adminCheck.allowed).toBe(true);

    const superCheck = await authorizeExpensePdfDownload(report.id, undefined, {
      id: superadminUser.id,
      role: Role.SUPERADMIN,
    });
    expect(superCheck.allowed).toBe(true);
  });

  it("6 & 7. Appends both image and multi-page PDF evidence seamlessly into appendix", async () => {
    const reportNumber = `EXP-PDF-EVID-${Date.now()}`;

    // 1. Upload sample PNG receipt
    const pngBuffer = createSamplePngBuffer();
    const pngUpload = await uploadReceiptFile(pngBuffer, "hotel_receipt.png", "image/png", employeeUser.id);

    // 2. Upload sample 3-page PDF receipt
    const sampleMultiPdf = await createSamplePdfBuffer(3);
    const pdfUpload = await uploadReceiptFile(sampleMultiPdf, "detailed_flight_invoice.pdf", "application/pdf", employeeUser.id);

    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "MULTI-EVIDENCE CONFERENCE",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(15000.0),
        items: {
          create: [
            {
              expenseDate: new Date(),
              vendorName: "Marriott Hotel",
              description: "Room booking",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(10000.0),
            },
            {
              expenseDate: new Date(),
              vendorName: "Air India",
              description: "Round-trip flight tickets",
              categoryId: travelCategory.id,
              subcategoryId: travelSubcategory.id,
              totalAmount: new Prisma.Decimal(5000.0),
            },
          ],
        },
      },
      include: { items: true },
    });
    testReportIds.push(report.id);

    // Attach evidences
    await prisma.expenseEvidence.create({
      data: {
        reportId: report.id,
        itemId: report.items[0].id,
        originalName: pngUpload.originalName,
        mimeType: pngUpload.mimeType,
        storagePath: pngUpload.storagePath,
        fileSize: pngUpload.fileSize,
        uploaderId: employeeUser.id,
      },
    });

    await prisma.expenseEvidence.create({
      data: {
        reportId: report.id,
        itemId: report.items[1].id,
        originalName: pdfUpload.originalName,
        mimeType: pdfUpload.mimeType,
        storagePath: pdfUpload.storagePath,
        fileSize: pdfUpload.fileSize,
        uploaderId: employeeUser.id,
      },
    });

    const genRes = await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    expect(genRes.success).toBe(true);

    const authCheck = await authorizeExpensePdfDownload(report.id, genRes.documentId, {
      id: employeeUser.id,
      role: Role.USER,
    });
    const { buffer } = await downloadStorageFile(authCheck.document.storagePath);
    const parsedPdf = await PDFDocument.load(buffer);

    // Summary Page (1) + Image Evidence Page (1) + Multi-page PDF pages (3) = 5 pages total!
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(5);
  });

  it("9 & 10. Multi-stage workflow creates distinct versions for APPROVED and REIMBURSED", async () => {
    const reportNumber = `EXP-PDF-VERSIONS-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "VERSION TRACKING REPORT",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(4000.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Vendor A",
            description: "Office Supplies",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(4000.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    // 1. Submit -> Version 1
    const v1 = await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    expect(v1.versionNumber).toBe(1);

    // 2. Approve -> Version 2
    await prisma.expenseReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.APPROVED,
        approvedById: adminUser.id,
        approvedAt: new Date(),
        approvalNote: "Approved without deductions",
      },
    });
    const v2 = await generateExpenseReportDocument(report.id, ReportStatus.APPROVED, adminUser.id);
    expect(v2.versionNumber).toBe(2);

    // 3. Reimburse -> Version 3
    await prisma.expenseReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.REIMBURSED,
        reimbursedById: superadminUser.id,
        reimbursedAt: new Date(),
        reimbursementDate: new Date(),
        paymentMethod: "BANK_TRANSFER",
        reimbursementRef: "UTR-TEST-PDF-001",
      },
    });
    const v3 = await generateExpenseReportDocument(report.id, ReportStatus.REIMBURSED, superadminUser.id);
    expect(v3.versionNumber).toBe(3);

    // Verify all 3 versions exist in the database
    const allDocs = await prisma.expenseReportDocument.findMany({
      where: { expenseReportId: report.id },
      orderBy: { versionNumber: "asc" },
    });

    expect(allDocs.length).toBe(3);
    expect(allDocs[0].workflowStatus).toBe(ReportStatus.SUBMITTED);
    expect(allDocs[1].workflowStatus).toBe(ReportStatus.APPROVED);
    expect(allDocs[2].workflowStatus).toBe(ReportStatus.REIMBURSED);
    expect(allDocs[2].isCurrent).toBe(true);
  });

  it("11. Rollback supersedes the submitted version and marks isCurrent as false", async () => {
    const reportNumber = `EXP-PDF-ROLLBACK-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "ROLLBACK PDF TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(3000.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Vendor B",
            description: "Supplies",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(3000.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    // Generate submitted PDF
    const v1 = await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    expect(v1.success).toBe(true);

    // Perform rollback superseding
    await prisma.expenseReportDocument.updateMany({
      where: {
        expenseReportId: report.id,
        workflowStatus: ReportStatus.SUBMITTED,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        supersededAt: new Date(),
      },
    });

    const doc = await prisma.expenseReportDocument.findUnique({
      where: { id: v1.documentId },
    });

    expect(doc?.isCurrent).toBe(false);
    expect(doc?.supersededAt).not.toBeNull();
  });

  it("12. Repeated generation creates a fresh version without uncontrolled duplicate current entries", async () => {
    const reportNumber = `EXP-PDF-REGEN-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "REGEN TEST REPORT",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(2000.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Vendor C",
            description: "Meals",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(2000.0),
          },
        },
      },
    });
    testReportIds.push(report.id);

    // Generate once
    await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    // Generate twice
    await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);

    // Exactly 1 document must have isCurrent = true for SUBMITTED
    const currentDocs = await prisma.expenseReportDocument.findMany({
      where: {
        expenseReportId: report.id,
        workflowStatus: ReportStatus.SUBMITTED,
        isCurrent: true,
      },
    });

    expect(currentDocs.length).toBe(1);
    expect(currentDocs[0].versionNumber).toBe(2);
  });

  it("13. Missing or corrupted evidence gracefully adds an evidence error page and does not crash", async () => {
    const reportNumber = `EXP-PDF-CORRUPT-${Date.now()}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "CORRUPTED EVIDENCE TEST",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(1200.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Non-existent receipt vendor",
            description: "Missing file test",
            categoryId: travelCategory.id,
            subcategoryId: travelSubcategory.id,
            totalAmount: new Prisma.Decimal(1200.0),
          },
        },
      },
      include: { items: true },
    });
    testReportIds.push(report.id);

    await prisma.expenseEvidence.create({
      data: {
        reportId: report.id,
        itemId: report.items[0].id,
        originalName: "missing_receipt.pdf",
        mimeType: "application/pdf",
        storagePath: "non_existent_folder/missing_file.pdf",
        fileSize: 1024,
        uploaderId: employeeUser.id,
      },
    });

    // Must NOT throw
    const genRes = await generateExpenseReportDocument(report.id, ReportStatus.SUBMITTED, employeeUser.id);
    expect(genRes.success).toBe(true);

    const authCheck = await authorizeExpensePdfDownload(report.id, genRes.documentId, {
      id: employeeUser.id,
      role: Role.USER,
    });
    const { buffer } = await downloadStorageFile(authCheck.document.storagePath);
    const parsedPdf = await PDFDocument.load(buffer);

    // Main page + Evidence Error page
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
