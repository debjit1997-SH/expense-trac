import { PDFDocument, StandardFonts, rgb, degrees, PDFPage, grayscale } from "pdf-lib";
import prisma from "../db";
import { downloadStorageFile, uploadDocumentPdf } from "../storage";
import { formatInTimeZone } from "date-fns-tz";
import { Role, ReportStatus, DocumentGenStatus, WorkflowStage, AssignmentStatus, RecipientType } from "@prisma/client";
import crypto from "crypto";

const TIMEZONE = "Asia/Kolkata";
const ORG_NAME = "RADICAL HEALTH TECH PVT LTD";
const ORG_ADDRESS = "Action Area II , Ecospace | GSTIN: 19AAACR1234A1Z5";

export interface ExpenseItemPdfData {
  serialNumber: number;
  expenseDate: string;
  vendorName: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  description: string;
  categoryName: string;
  subcategoryName: string;
  documentType?: string | null;
  totalAmount: number;
  gstTreatmentName?: string | null;
  vendorGstin?: string | null;
  placeOfSupply?: string | null;
  hsnSacCode?: string | null;
  taxableValue?: number | null;
  gstRateLabel?: string | null;
  taxMode?: string | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  cessAmount?: number | null;
  totalGstAmount?: number | null;
  reverseCharge?: boolean;
  itcEligibility?: string | null;
  gstRemarks?: string | null;
  evidence?: {
    originalName: string;
    mimeType: string;
    storagePath: string;
    fileSize: number;
  } | null;
}

export interface ExpenseReportPdfData {
  id: string;
  reportNumber: string;
  title: string;
  description?: string | null;
  workflowStatus: ReportStatus;
  versionNumber: number;
  createdAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  reimbursedAt?: string | null;
  currency: string;
  
  // Totals
  itemCount: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  totalGst: number;
  grandTotal: number;

  // Advance Adjustment
  advanceNumber?: string | null;
  advanceAdjustedAmount: number;
  netPayableAmount: number;

  // Submitter
  submitter: {
    name: string;
    email: string;
    phone: string;
    role: string;
  };

  // Workflow history
  workflow: {
    submittedBy?: string | null;
    submittedAt?: string | null;
    primaryApprover?: string | null;
    ccApprovers?: string[];
    approvedBy?: string | null;
    approvedAt?: string | null;
    approvalNote?: string | null;
    reimbursementOwner?: string | null;
    reimbursedBy?: string | null;
    reimbursedAt?: string | null;
    paymentMethod?: string | null;
    reimbursementRef?: string | null;
    transactionId?: string | null;
    reimbursementNote?: string | null;
  };

  items: ExpenseItemPdfData[];
}

/**
 * Fetch and construct comprehensive structured data for PDF generation
 */
export async function buildExpensePdfData(
  reportId: string,
  targetStatus?: ReportStatus,
  versionNumber: number = 1
): Promise<ExpenseReportPdfData> {
  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: {
      user: true,
      approvedBy: true,
      reimbursedBy: true,
      approvalAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          assignee: true,
        },
      },
      workflowRecipients: {
        include: {
          recipient: true,
        },
      },
      advanceAllocation: {
        include: {
          advanceRequest: true,
        },
      },
      items: {
        orderBy: { expenseDate: "asc" },
        include: {
          category: true,
          subcategory: true,
          gstTreatment: true,
          gstRate: true,
          evidences: true,
        },
      },
    },
  });

  if (!report) {
    throw new Error(`Expense report ${reportId} not found.`);
  }

  const effectiveStatus = targetStatus || report.status;

  // Compute aggregated tax totals
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalCess = 0;
  let totalGst = 0;
  let grandTotal = Number(report.totalAmount) || 0;

  const items: ExpenseItemPdfData[] = report.items.map((item, idx) => {
    const itemTaxable = Number(item.taxableValue) || 0;
    const itemCgst = Number(item.cgstAmount) || 0;
    const itemSgst = Number(item.sgstAmount) || 0;
    const itemIgst = Number(item.igstAmount) || 0;
    const itemCess = Number(item.cessAmount) || 0;
    const itemGst = Number(item.totalGstAmount) || 0;
    const itemTotal = Number(item.totalAmount) || 0;

    totalTaxableValue += itemTaxable;
    totalCgst += itemCgst;
    totalSgst += itemSgst;
    totalIgst += itemIgst;
    totalCess += itemCess;
    totalGst += itemGst;

    const evidence = item.evidences && item.evidences.length > 0 ? item.evidences[0] : null;

    return {
      serialNumber: idx + 1,
      expenseDate: formatInTimeZone(new Date(item.expenseDate), TIMEZONE, "dd-MMM-yyyy"),
      vendorName: item.vendorName,
      invoiceNumber: item.invoiceNumber,
      invoiceDate: item.invoiceDate
        ? formatInTimeZone(new Date(item.invoiceDate), TIMEZONE, "dd-MMM-yyyy")
        : null,
      description: item.description,
      categoryName: item.category.name,
      subcategoryName: item.subcategory.name,
      documentType: item.documentType,
      totalAmount: itemTotal,
      gstTreatmentName: item.gstTreatment?.name,
      vendorGstin: item.vendorGstin,
      placeOfSupply: item.placeOfSupply,
      hsnSacCode: item.hsnSacCode,
      taxableValue: itemTaxable || null,
      gstRateLabel: item.gstRate?.label,
      taxMode: item.taxMode,
      cgstAmount: itemCgst || null,
      sgstAmount: itemSgst || null,
      igstAmount: itemIgst || null,
      cessAmount: itemCess || null,
      totalGstAmount: itemGst || null,
      reverseCharge: item.reverseCharge,
      itcEligibility: item.itcEligibility,
      gstRemarks: item.gstRemarks,
      evidence: evidence
        ? {
            originalName: evidence.originalName,
            mimeType: evidence.mimeType,
            storagePath: evidence.storagePath,
            fileSize: evidence.fileSize,
          }
        : null,
    };
  });

  // Approver assignments
  const adminAssignment = report.approvalAssignments.find(
    (a) => a.stage === WorkflowStage.ADMIN_APPROVAL && a.status !== AssignmentStatus.CANCELLED
  );
  const reimbursementAssignment = report.approvalAssignments.find(
    (a) => a.stage === WorkflowStage.REIMBURSEMENT && a.status !== AssignmentStatus.CANCELLED
  );

  const ccRecipients = report.workflowRecipients
    .filter((r) => r.workflowStage === WorkflowStage.ADMIN_APPROVAL && r.recipientType === RecipientType.CC)
    .map((r) => r.recipient.name);

  return {
    id: report.id,
    reportNumber: report.reportNumber,
    title: report.title,
    description: report.description,
    workflowStatus: effectiveStatus,
    versionNumber,
    createdAt: formatInTimeZone(new Date(report.createdAt), TIMEZONE, "dd-MMM-yyyy HH:mm:ss"),
    submittedAt: report.submittedAt
      ? formatInTimeZone(new Date(report.submittedAt), TIMEZONE, "dd-MMM-yyyy HH:mm:ss")
      : null,
    approvedAt: report.approvedAt
      ? formatInTimeZone(new Date(report.approvedAt), TIMEZONE, "dd-MMM-yyyy HH:mm:ss")
      : null,
    reimbursedAt: report.reimbursedAt
      ? formatInTimeZone(new Date(report.reimbursedAt), TIMEZONE, "dd-MMM-yyyy HH:mm:ss")
      : null,
    currency: report.currency,
    itemCount: items.length,
    totalTaxableValue,
    totalCgst,
    totalSgst,
    totalIgst,
    totalCess,
    totalGst,
    grandTotal,
    advanceNumber: report.advanceAllocation?.advanceRequest?.advanceNumber || null,
    advanceAdjustedAmount: Number(report.advanceAdjustedAmount) || (report.advanceAllocation ? Number(report.advanceAllocation.allocatedAmount) : 0),
    netPayableAmount: Number(report.netPayableAmount) !== undefined ? Number(report.netPayableAmount) : Math.max(0, grandTotal - (Number(report.advanceAdjustedAmount) || 0)),
    submitter: {
      name: report.user.name,
      email: report.user.email,
      phone: report.user.phone,
      role: report.user.role,
    },
    workflow: {
      submittedBy: report.user.name,
      submittedAt: report.submittedAt
        ? formatInTimeZone(new Date(report.submittedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      primaryApprover: adminAssignment?.assignee.name || null,
      ccApprovers: ccRecipients,
      approvedBy: report.approvedBy?.name || null,
      approvedAt: report.approvedAt
        ? formatInTimeZone(new Date(report.approvedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      approvalNote: report.approvalNote,
      reimbursementOwner: reimbursementAssignment?.assignee.name || null,
      reimbursedBy: report.reimbursedBy?.name || null,
      reimbursedAt: report.reimbursedAt
        ? formatInTimeZone(new Date(report.reimbursedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      paymentMethod: report.paymentMethod,
      reimbursementRef: report.reimbursementRef,
      transactionId: report.transactionId,
      reimbursementNote: report.reimbursementNote,
    },
    items,
  };
}

/**
 * Format currency in INR format (₹ XX,XXX.XX)
 */
function formatInr(val: number | null | undefined): string {
  if (val === null || val === undefined) return "0.00";
  return Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generates the clean, corporate, multi-page Summary PDF document using pdf-lib
 */
export async function generateExpenseSummaryPdf(data: ExpenseReportPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // A4 Dimensions: 595.28 x 841.89 points
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 36;
  const MARGIN_RIGHT = 36;
  const MARGIN_TOP = 40;
  const MARGIN_BOTTOM = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  // Helper to add new page
  const checkNewPage = (neededHeight: number) => {
    if (cursorY - neededHeight < MARGIN_BOTTOM) {
      drawFooter(currentPage);
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
      drawHeader(currentPage, true);
    }
  };

  // Draw Watermark
  const drawWatermark = (page: PDFPage) => {
    const text = data.workflowStatus;
    const textSize = 64;
    const textWidth = fontBold.widthOfTextAtSize(text, textSize);

    page.drawText(text, {
      x: PAGE_WIDTH / 2 - textWidth / 2,
      y: PAGE_HEIGHT / 2,
      size: textSize,
      font: fontBold,
      color: rgb(0.85, 0.88, 0.92),
      rotate: degrees(35),
      opacity: 0.35,
    });
  };

  // Draw Running Header
  const drawHeader = (page: PDFPage, isSubsequent: boolean = false) => {
    drawWatermark(page);

    if (isSubsequent) {
      // Compact header for page 2+
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: cursorY - 18,
        width: CONTENT_WIDTH,
        height: 20,
        color: rgb(0.95, 0.96, 0.98),
      });

      page.drawText(`${ORG_NAME} | ${data.reportNumber} - ${data.title}`, {
        x: MARGIN_LEFT + 6,
        y: cursorY - 12,
        size: 8,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.35),
      });

      page.drawText(`Status: ${data.workflowStatus}`, {
        x: PAGE_WIDTH - MARGIN_RIGHT - 110,
        y: cursorY - 12,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.35, 0.7),
      });

      cursorY -= 28;
      return;
    }

    // Full Primary Header on Page 1
    // Org Header Banner
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 48,
      width: CONTENT_WIDTH,
      height: 48,
      color: rgb(0.08, 0.2, 0.4),
    });

    page.drawText(ORG_NAME, {
      x: MARGIN_LEFT + 12,
      y: cursorY - 20,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(ORG_ADDRESS, {
      x: MARGIN_LEFT + 12,
      y: cursorY - 36,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    cursorY -= 56;

    // Report Title & Meta Row
    page.drawText("EXPENSE REIMBURSEMENT REPORT", {
      x: MARGIN_LEFT,
      y: cursorY - 14,
      size: 15,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    const statusBadgeText = `STATUS: ${data.workflowStatus}`;
    page.drawText(statusBadgeText, {
      x: PAGE_WIDTH - MARGIN_RIGHT - fontBold.widthOfTextAtSize(statusBadgeText, 9) - 8,
      y: cursorY - 12,
      size: 9,
      font: fontBold,
      color:
        data.workflowStatus === ReportStatus.REIMBURSED
          ? rgb(0.1, 0.55, 0.2)
          : data.workflowStatus === ReportStatus.APPROVED
          ? rgb(0.1, 0.4, 0.8)
          : rgb(0.8, 0.45, 0.05),
    });

    cursorY -= 26;

    // Metadata Grid Box
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 52,
      width: CONTENT_WIDTH,
      height: 52,
      borderColor: rgb(0.8, 0.84, 0.9),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 1),
    });

    // Col 1: Report Details
    page.drawText("Report Number:", { x: MARGIN_LEFT + 8, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(data.reportNumber, { x: MARGIN_LEFT + 75, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Expense Tag:", { x: MARGIN_LEFT + 8, y: cursorY - 26, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(data.title.substring(0, 32), { x: MARGIN_LEFT + 75, y: cursorY - 26, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Created Date:", { x: MARGIN_LEFT + 8, y: cursorY - 38, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(data.createdAt, { x: MARGIN_LEFT + 75, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    // Col 2: Submitter
    page.drawText("Submitted By:", { x: MARGIN_LEFT + 220, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(`${data.submitter.name} (${data.submitter.role})`, { x: MARGIN_LEFT + 285, y: cursorY - 14, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Email:", { x: MARGIN_LEFT + 220, y: cursorY - 26, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(data.submitter.email, { x: MARGIN_LEFT + 285, y: cursorY - 26, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText("Phone:", { x: MARGIN_LEFT + 220, y: cursorY - 38, size: 8, font: fontBold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(data.submitter.phone || "N/A", { x: MARGIN_LEFT + 285, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    // Col 3: Grand Total
    page.drawText("TOTAL AMOUNT", { x: PAGE_WIDTH - MARGIN_RIGHT - 115, y: cursorY - 15, size: 8, font: fontBold, color: rgb(0.08, 0.2, 0.4) });
    const grandTotalStr = `INR ${formatInr(data.grandTotal)}`;
    page.drawText(grandTotalStr, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 115,
      y: cursorY - 32,
      size: 13,
      font: fontBold,
      color: rgb(0.08, 0.2, 0.55),
    });
    page.drawText(`${data.itemCount} Expense Item(s)`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 115,
      y: cursorY - 44,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });

    cursorY -= 62;
  };

  // Draw Running Footer
  const drawFooter = (page: PDFPage) => {
    const timestamp = formatInTimeZone(new Date(), TIMEZONE, "dd-MMM-yyyy HH:mm:ss zzz");
    page.drawLine({
      start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM },
      thickness: 0.5,
      color: rgb(0.7, 0.75, 0.8),
    });

    page.drawText("CONFIDENTIAL - INTERNAL USE ONLY", {
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM - 12,
      size: 7,
      font: fontBold,
      color: rgb(0.5, 0.55, 0.6),
    });

    page.drawText(`Report: ${data.reportNumber} | Generated: ${timestamp}`, {
      x: MARGIN_LEFT + 155,
      y: MARGIN_BOTTOM - 12,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  };

  // Render initial Header
  drawHeader(currentPage, false);

  // 1. FINANCIAL TAX & GST SUMMARY TABLE
  checkNewPage(85);
  currentPage.drawText("1. FINANCIAL & TAX SUMMARY", {
    x: MARGIN_LEFT,
    y: cursorY - 10,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.2, 0.4),
  });
  cursorY -= 16;

  // Table header
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - 16,
    width: CONTENT_WIDTH,
    height: 16,
    color: rgb(0.9, 0.93, 0.97),
  });

  const taxCols = [
    { label: "Items", x: MARGIN_LEFT + 6, width: 45 },
    { label: "Taxable Value", x: MARGIN_LEFT + 55, width: 80 },
    { label: "CGST", x: MARGIN_LEFT + 140, width: 65 },
    { label: "SGST / UTGST", x: MARGIN_LEFT + 210, width: 75 },
    { label: "IGST", x: MARGIN_LEFT + 290, width: 65 },
    { label: "Cess", x: MARGIN_LEFT + 360, width: 50 },
    { label: "Total GST", x: MARGIN_LEFT + 415, width: 60 },
    { label: "Grand Total", x: PAGE_WIDTH - MARGIN_RIGHT - 65, width: 65 },
  ];

  taxCols.forEach((col) => {
    currentPage.drawText(col.label, {
      x: col.x,
      y: cursorY - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });
  });
  cursorY -= 18;

  // Table Row
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - 16,
    width: CONTENT_WIDTH,
    height: 16,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  currentPage.drawText(String(data.itemCount), { x: taxCols[0].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalTaxableValue), { x: taxCols[1].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalCgst), { x: taxCols[2].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalSgst), { x: taxCols[3].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalIgst), { x: taxCols[4].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalCess), { x: taxCols[5].x, y: cursorY - 11, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(formatInr(data.totalGst), { x: taxCols[6].x, y: cursorY - 11, size: 8, font: fontBold, color: rgb(0.1, 0.35, 0.7) });
  currentPage.drawText(formatInr(data.grandTotal), { x: taxCols[7].x, y: cursorY - 11, size: 8.5, font: fontBold, color: rgb(0.08, 0.2, 0.5) });

  cursorY -= 22;

  // Advance adjustment box if advance is linked
  if (data.advanceAdjustedAmount > 0 || data.advanceNumber) {
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 22,
      width: CONTENT_WIDTH,
      height: 22,
      borderColor: rgb(0.7, 0.8, 0.95),
      borderWidth: 1,
      color: rgb(0.95, 0.97, 1),
    });

    const advLabel = data.advanceNumber ? `Company Advance (${data.advanceNumber}):` : "Company Advance Adjusted:";
    currentPage.drawText(`Expense: INR ${formatInr(data.grandTotal)}`, {
      x: MARGIN_LEFT + 8,
      y: cursorY - 14,
      size: 8,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.35),
    });

    currentPage.drawText(`${advLabel} -INR ${formatInr(data.advanceAdjustedAmount)}`, {
      x: MARGIN_LEFT + 150,
      y: cursorY - 14,
      size: 8,
      font: fontBold,
      color: rgb(0.7, 0.35, 0.05),
    });

    currentPage.drawText(`Net Payable: INR ${formatInr(data.netPayableAmount)}`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 180,
      y: cursorY - 14,
      size: 8.5,
      font: fontBold,
      color: rgb(0.08, 0.5, 0.2),
    });

    cursorY -= 28;
  } else {
    cursorY -= 8;
  }

  // 2. DETAILED EXPENSE ITEMS TABLE
  checkNewPage(120);
  currentPage.drawText("2. ITEMIZED EXPENSES & GST BREAKDOWN", {
    x: MARGIN_LEFT,
    y: cursorY - 10,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.2, 0.4),
  });
  cursorY -= 16;

  // Table Column Headers
  const drawItemsTableHeader = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - 16,
      width: CONTENT_WIDTH,
      height: 16,
      color: rgb(0.08, 0.2, 0.4),
    });

    page.drawText("#", { x: MARGIN_LEFT + 4, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Date", { x: MARGIN_LEFT + 20, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Vendor / Merchant", { x: MARGIN_LEFT + 75, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Category & Purpose", { x: MARGIN_LEFT + 185, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("GST Info", { x: MARGIN_LEFT + 345, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Taxable", { x: MARGIN_LEFT + 425, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Total (INR)", { x: PAGE_WIDTH - MARGIN_RIGHT - 55, y: cursorY - 11, size: 7.5, font: fontBold, color: rgb(1, 1, 1) });

    cursorY -= 18;
  };

  drawItemsTableHeader(currentPage);

  for (const item of data.items) {
    const itemCardHeight = 44;
    checkNewPage(itemCardHeight + 10);

    // Alternating Row Background
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - itemCardHeight,
      width: CONTENT_WIDTH,
      height: itemCardHeight,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 0.5,
      color: item.serialNumber % 2 === 0 ? rgb(0.98, 0.99, 1) : rgb(1, 1, 1),
    });

    // Row Line 1
    currentPage.drawText(String(item.serialNumber), { x: MARGIN_LEFT + 4, y: cursorY - 12, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(item.expenseDate, { x: MARGIN_LEFT + 18, y: cursorY - 12, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

    const vendorText = item.vendorName.length > 22 ? `${item.vendorName.substring(0, 22)}...` : item.vendorName;
    currentPage.drawText(vendorText, { x: MARGIN_LEFT + 75, y: cursorY - 12, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

    const catText = `${item.categoryName} > ${item.subcategoryName}`;
    currentPage.drawText(catText.substring(0, 32), { x: MARGIN_LEFT + 185, y: cursorY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

    const gstLabel = item.gstRateLabel ? `${item.gstTreatmentName || "GST"} (${item.gstRateLabel})` : item.gstTreatmentName || "Exempt";
    currentPage.drawText(gstLabel.substring(0, 18), { x: MARGIN_LEFT + 345, y: cursorY - 12, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

    currentPage.drawText(formatInr(item.taxableValue), { x: MARGIN_LEFT + 425, y: cursorY - 12, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    currentPage.drawText(formatInr(item.totalAmount), { x: PAGE_WIDTH - MARGIN_RIGHT - 55, y: cursorY - 12, size: 8.5, font: fontBold, color: rgb(0.08, 0.2, 0.5) });

    // Row Line 2: Invoices & Descriptions
    const invoiceStr = item.invoiceNumber ? `Inv: ${item.invoiceNumber}${item.invoiceDate ? ` (${item.invoiceDate})` : ""}` : "No Invoice #";
    currentPage.drawText(invoiceStr, { x: MARGIN_LEFT + 75, y: cursorY - 24, size: 7, font: fontRegular, color: rgb(0.45, 0.5, 0.55) });

    const descStr = item.description.length > 36 ? `${item.description.substring(0, 36)}...` : item.description;
    currentPage.drawText(`Purpose: ${descStr}`, { x: MARGIN_LEFT + 185, y: cursorY - 24, size: 7, font: fontOblique, color: rgb(0.4, 0.45, 0.5) });

    const gstGstin = item.vendorGstin ? `GSTIN: ${item.vendorGstin}` : "Unregistered";
    currentPage.drawText(gstGstin, { x: MARGIN_LEFT + 345, y: cursorY - 24, size: 7, font: fontRegular, color: rgb(0.45, 0.5, 0.55) });

    const gstAmtStr = item.totalGstAmount ? `GST: INR ${formatInr(item.totalGstAmount)}` : "";
    currentPage.drawText(gstAmtStr, { x: MARGIN_LEFT + 425, y: cursorY - 24, size: 7, font: fontBold, color: rgb(0.1, 0.35, 0.7) });

    // Row Line 3: Attached evidence note
    if (item.evidence) {
      currentPage.drawText(`Attached Evidence: [Appended in Appendix] ${item.evidence.originalName} (${(item.evidence.fileSize / 1024).toFixed(1)} KB)`, {
        x: MARGIN_LEFT + 75,
        y: cursorY - 36,
        size: 6.8,
        font: fontRegular,
        color: rgb(0.1, 0.45, 0.75),
      });
    } else {
      currentPage.drawText("No receipt evidence attached", {
        x: MARGIN_LEFT + 75,
        y: cursorY - 36,
        size: 6.8,
        font: fontOblique,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    cursorY -= itemCardHeight + 2;
  }

  cursorY -= 12;

  // 3. WORKFLOW AUDIT & APPROVAL RESPONSIBILITY
  checkNewPage(120);
  currentPage.drawText("3. APPROVAL & REIMBURSEMENT WORKFLOW TRAIL", {
    x: MARGIN_LEFT,
    y: cursorY - 10,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.2, 0.4),
  });
  cursorY -= 16;

  // Workflow Grid Box
  const wfBoxHeight = 85;
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: cursorY - wfBoxHeight,
    width: CONTENT_WIDTH,
    height: wfBoxHeight,
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  });

  // Stage 1: Submission
  currentPage.drawText("STAGE 1: SUBMISSION", { x: MARGIN_LEFT + 8, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.08, 0.2, 0.4) });
  currentPage.drawText(`Submitted By: ${data.workflow.submittedBy || "N/A"}`, { x: MARGIN_LEFT + 8, y: cursorY - 26, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(`Submitted At: ${data.workflow.submittedAt || "N/A"}`, { x: MARGIN_LEFT + 8, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText(`Assigned Primary Approver: ${data.workflow.primaryApprover || "N/A"}`, { x: MARGIN_LEFT + 8, y: cursorY - 50, size: 7.5, font: fontBold, color: rgb(0.1, 0.35, 0.7) });
  if (data.workflow.ccApprovers && data.workflow.ccApprovers.length > 0) {
    currentPage.drawText(`CC: ${data.workflow.ccApprovers.join(", ")}`, { x: MARGIN_LEFT + 8, y: cursorY - 62, size: 7, font: fontRegular, color: rgb(0.4, 0.45, 0.5) });
  }

  // Stage 2: Admin Approval
  currentPage.drawText("STAGE 2: ADMIN APPROVAL", { x: MARGIN_LEFT + 180, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.08, 0.2, 0.4) });
  if (data.workflow.approvedBy) {
    currentPage.drawText(`Approved By: ${data.workflow.approvedBy}`, { x: MARGIN_LEFT + 180, y: cursorY - 26, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(`Approved At: ${data.workflow.approvedAt}`, { x: MARGIN_LEFT + 180, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    if (data.workflow.approvalNote) {
      currentPage.drawText(`Note: "${data.workflow.approvalNote.substring(0, 28)}"`, { x: MARGIN_LEFT + 180, y: cursorY - 50, size: 7, font: fontOblique, color: rgb(0.3, 0.3, 0.3) });
    }
  } else {
    currentPage.drawText("Status: NOT YET COMPLETED", { x: MARGIN_LEFT + 180, y: cursorY - 26, size: 7.5, font: fontBold, color: rgb(0.7, 0.4, 0.05) });
  }

  // Stage 3: Superadmin Reimbursement
  currentPage.drawText("STAGE 3: REIMBURSEMENT", { x: MARGIN_LEFT + 345, y: cursorY - 14, size: 8, font: fontBold, color: rgb(0.08, 0.2, 0.4) });
  if (data.workflow.reimbursedBy) {
    currentPage.drawText(`Disbursed By: ${data.workflow.reimbursedBy}`, { x: MARGIN_LEFT + 345, y: cursorY - 26, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(`Disbursed At: ${data.workflow.reimbursedAt}`, { x: MARGIN_LEFT + 345, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(`Method: ${data.workflow.paymentMethod || "N/A"}`, { x: MARGIN_LEFT + 345, y: cursorY - 50, size: 7.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(`Ref: ${data.workflow.reimbursementRef || "N/A"}`, { x: MARGIN_LEFT + 345, y: cursorY - 62, size: 7, font: fontBold, color: rgb(0.1, 0.4, 0.2) });
  } else {
    currentPage.drawText("Status: NOT YET COMPLETED", { x: MARGIN_LEFT + 345, y: cursorY - 26, size: 7.5, font: fontBold, color: rgb(0.7, 0.4, 0.05) });
    if (data.workflow.reimbursementOwner) {
      currentPage.drawText(`Assigned: ${data.workflow.reimbursementOwner}`, { x: MARGIN_LEFT + 345, y: cursorY - 38, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.4) });
    }
  }

  cursorY -= wfBoxHeight + 15;

  // Final footer on the last summary page
  drawFooter(currentPage);

  // Add Page Numbers (Page X of Y)
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const pageNumStr = `Page ${i + 1} of ${totalPages}`;
    page.drawText(pageNumStr, {
      x: PAGE_WIDTH - MARGIN_RIGHT - fontRegular.widthOfTextAtSize(pageNumStr, 7),
      y: MARGIN_BOTTOM - 12,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  return await pdfDoc.save();
}

/**
 * Append uploaded image or PDF evidence to the main summary document
 */
export async function appendExpenseEvidence(
  mainPdfBytes: Uint8Array,
  items: ExpenseItemPdfData[]
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.load(mainPdfBytes);
  const fontBold = await mergedDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await mergedDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 36;
  const MARGIN_RIGHT = 36;
  const MARGIN_TOP = 40;
  const MARGIN_BOTTOM = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  for (const item of items) {
    if (!item.evidence) continue;

    try {
      const { buffer, mimeType } = await downloadStorageFile(item.evidence.storagePath);

      if (mimeType === "application/pdf" || item.evidence.originalName.toLowerCase().endsWith(".pdf")) {
        // Embed PDF Evidence
        try {
          const evidencePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
          const copiedPages = await mergedDoc.copyPages(evidencePdf, evidencePdf.getPageIndices());

          for (let pIdx = 0; pIdx < copiedPages.length; pIdx++) {
            const page = copiedPages[pIdx];
            // Add Header Banner onto the evidence page
            page.drawRectangle({
              x: 0,
              y: page.getHeight() - 28,
              width: page.getWidth(),
              height: 28,
              color: rgb(0.08, 0.2, 0.4),
            });

            page.drawText(
              `EVIDENCE APPENDIX - Item #${item.serialNumber}: ${item.vendorName} | Inv: ${item.invoiceNumber || "N/A"} | File: ${item.evidence.originalName} (Page ${pIdx + 1} of ${copiedPages.length})`,
              {
                x: 18,
                y: page.getHeight() - 18,
                size: 8,
                font: fontBold,
                color: rgb(1, 1, 1),
              }
            );

            mergedDoc.addPage(page);
          }
        } catch (pdfErr: any) {
          // If corrupted PDF, add error page
          addEvidenceErrorPage(
            mergedDoc,
            item,
            `Failed to parse PDF evidence: ${pdfErr.message || "Invalid or encrypted PDF"}`
          );
        }
      } else if (
        mimeType.startsWith("image/") ||
        item.evidence.originalName.match(/\.(png|jpg|jpeg)$/i)
      ) {
        // Embed Image Evidence
        try {
          let embeddedImage;
          if (mimeType === "image/png" || item.evidence.originalName.toLowerCase().endsWith(".png")) {
            embeddedImage = await mergedDoc.embedPng(buffer);
          } else {
            embeddedImage = await mergedDoc.embedJpg(buffer);
          }

          const page = mergedDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

          // Header Banner
          page.drawRectangle({
            x: MARGIN_LEFT,
            y: PAGE_HEIGHT - MARGIN_TOP - 22,
            width: CONTENT_WIDTH,
            height: 22,
            color: rgb(0.08, 0.2, 0.4),
          });

          page.drawText(
            `EVIDENCE APPENDIX - Item #${item.serialNumber}: ${item.vendorName} | ${item.expenseDate}`,
            {
              x: MARGIN_LEFT + 8,
              y: PAGE_HEIGHT - MARGIN_TOP - 15,
              size: 8,
              font: fontBold,
              color: rgb(1, 1, 1),
            }
          );

          page.drawText(`File: ${item.evidence.originalName} (${(item.evidence.fileSize / 1024).toFixed(1)} KB)`, {
            x: PAGE_WIDTH - MARGIN_RIGHT - 180,
            y: PAGE_HEIGHT - MARGIN_TOP - 15,
            size: 7.5,
            font: fontRegular,
            color: rgb(0.85, 0.9, 0.98),
          });

          // Calculate aspect-ratio scaling
          const maxImgWidth = CONTENT_WIDTH;
          const maxImgHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - 45;

          const imgDims = embeddedImage.scale(1);
          let scale = Math.min(maxImgWidth / imgDims.width, maxImgHeight / imgDims.height);
          if (scale > 1) scale = 1; // Don't upscale small images

          const finalWidth = imgDims.width * scale;
          const finalHeight = imgDims.height * scale;
          const posX = MARGIN_LEFT + (CONTENT_WIDTH - finalWidth) / 2;
          const posY = MARGIN_BOTTOM + (maxImgHeight - finalHeight) / 2;

          // Draw image border box
          page.drawRectangle({
            x: posX - 2,
            y: posY - 2,
            width: finalWidth + 4,
            height: finalHeight + 4,
            borderColor: rgb(0.8, 0.84, 0.9),
            borderWidth: 1,
            color: rgb(0.98, 0.98, 0.98),
          });

          page.drawImage(embeddedImage, {
            x: posX,
            y: posY,
            width: finalWidth,
            height: finalHeight,
          });
        } catch (imgErr: any) {
          addEvidenceErrorPage(
            mergedDoc,
            item,
            `Failed to embed image evidence: ${imgErr.message || "Unsupported image encoding"}`
          );
        }
      } else {
        // Unsupported format
        addEvidenceErrorPage(
          mergedDoc,
          item,
          `Unsupported file format: ${mimeType || "Unknown"}`
        );
      }
    } catch (fetchErr: any) {
      // Evidence file missing or failed to download from storage
      addEvidenceErrorPage(
        mergedDoc,
        item,
        `Evidence file unavailable from storage: ${fetchErr.message || "File not found"}`
      );
    }
  }

  return await mergedDoc.save();
}

/**
 * Adds a clean evidence error page if an attachment fails to load or parse
 */
function addEvidenceErrorPage(doc: PDFDocument, item: ExpenseItemPdfData, reason: string) {
  const fontBold = doc.embedStandardFont(StandardFonts.HelveticaBold);
  const fontRegular = doc.embedStandardFont(StandardFonts.Helvetica);

  const page = doc.addPage([595.28, 841.89]);
  const MARGIN_LEFT = 36;
  const CONTENT_WIDTH = 595.28 - 72;

  // Header Banner
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: 841.89 - 40 - 22,
    width: CONTENT_WIDTH,
    height: 22,
    color: rgb(0.7, 0.15, 0.15),
  });

  page.drawText(`EVIDENCE ERROR - Item #${item.serialNumber}: ${item.vendorName}`, {
    x: MARGIN_LEFT + 8,
    y: 841.89 - 40 - 15,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Error Info Box
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: 841.89 - 180,
    width: CONTENT_WIDTH,
    height: 100,
    borderColor: rgb(0.9, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.99, 0.95, 0.95),
  });

  page.drawText("Attachment Could Not Be Rendered In PDF:", {
    x: MARGIN_LEFT + 12,
    y: 841.89 - 105,
    size: 9,
    font: fontBold,
    color: rgb(0.7, 0.1, 0.1),
  });

  page.drawText(`Expense Item: #${item.serialNumber} (${item.vendorName} - INR ${formatInr(item.totalAmount)})`, {
    x: MARGIN_LEFT + 12,
    y: 841.89 - 122,
    size: 8,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(`Original Filename: ${item.evidence?.originalName || "Unknown"}`, {
    x: MARGIN_LEFT + 12,
    y: 841.89 - 138,
    size: 8,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(`Reason: ${reason}`, {
    x: MARGIN_LEFT + 12,
    y: 841.89 - 155,
    size: 8,
    font: fontRegular,
    color: rgb(0.6, 0.1, 0.1),
  });
}

/**
 * Orchestrates full PDF generation, evidence merging, storage persistence, and document versioning
 */
export async function generateExpenseReportDocument(
  reportId: string,
  targetStatus?: ReportStatus,
  userId?: string
): Promise<{ success: boolean; documentId?: string; versionNumber?: number; error?: string }> {
  try {
    const report = await prisma.expenseReport.findUnique({
      where: { id: reportId },
      include: {
        documents: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!report) {
      return { success: false, error: "Expense report not found." };
    }

    const workflowStatus = targetStatus || report.status;
    if (workflowStatus === ReportStatus.DRAFT) {
      return { success: false, error: "Draft reports do not produce official versioned PDFs." };
    }

    // Determine new version number
    const lastDoc = report.documents[0];
    const newVersionNumber = lastDoc ? lastDoc.versionNumber + 1 : 1;

    // 1. Build structured data
    const pdfData = await buildExpensePdfData(reportId, workflowStatus, newVersionNumber);

    // 2. Generate summary PDF
    const summaryPdfBytes = await generateExpenseSummaryPdf(pdfData);

    // 3. Append uploaded evidence (PDFs & images)
    const fullPdfBytes = await appendExpenseEvidence(summaryPdfBytes, pdfData.items);
    const pdfBuffer = Buffer.from(fullPdfBytes);

    // 4. Compute Checksum
    const checksum = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const filename = `${report.reportNumber}-v${newVersionNumber}-${workflowStatus.toLowerCase()}.pdf`;

    // 5. Store in Supabase / Local Storage
    const uploadRes = await uploadDocumentPdf(pdfBuffer, filename, report.userId);

    // 6. Mark previous current documents as superseded in transaction
    const document = await prisma.$transaction(async (tx) => {
      await tx.expenseReportDocument.updateMany({
        where: {
          expenseReportId: report.id,
          workflowStatus,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          supersededAt: new Date(),
        },
      });

      return await tx.expenseReportDocument.create({
        data: {
          expenseReportId: report.id,
          versionNumber: newVersionNumber,
          workflowStatus,
          storagePath: uploadRes.storagePath,
          filename: uploadRes.originalName,
          mimeType: "application/pdf",
          fileSize: uploadRes.fileSize,
          checksum,
          generationStatus: DocumentGenStatus.GENERATED,
          generatedByUserId: userId || report.userId,
          isCurrent: true,
        },
      });
    });

    return {
      success: true,
      documentId: document.id,
      versionNumber: newVersionNumber,
    };
  } catch (err: any) {
    console.error("PDF generation failure:", err);
    return {
      success: false,
      error: err.message || "Failed to generate expense report PDF.",
    };
  }
}

/**
 * Authorizes a user to download an expense report PDF document
 */
export async function authorizeExpensePdfDownload(
  reportId: string,
  documentId?: string,
  user?: { id: string; role: Role }
): Promise<{ allowed: boolean; document?: any; reason?: string }> {
  if (!user) {
    return { allowed: false, reason: "Authentication required." };
  }

  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: {
      approvalAssignments: true,
      workflowRecipients: true,
      documents: {
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!report) {
    return { allowed: false, reason: "Expense report not found." };
  }

  const isOwner = report.userId === user.id;
  const isAdmin = user.role === Role.ADMIN;
  const isSuperAdmin = user.role === Role.SUPERADMIN;

  // Check role authorization
  let isAuthorized = isOwner || isSuperAdmin;
  if (!isAuthorized && isAdmin) {
    // Admin can access if assigned or if they are admin reviewer
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return { allowed: false, reason: "You are not authorized to download this expense report." };
  }

  let doc = null;
  if (documentId) {
    doc = report.documents.find((d) => d.id === documentId);
  } else {
    // Return latest current document
    doc = report.documents.find((d) => d.isCurrent) || report.documents[0];
  }

  if (!doc) {
    return { allowed: false, reason: "No generated PDF document found for this report." };
  }

  return { allowed: true, document: doc };
}
