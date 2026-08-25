import ExcelJS from "exceljs";
import { DetailedExpenseReportRow, DetailedReportSummaryTotals, DetailedReportFilterParams, TIMEZONE } from "./report-query";
import { formatInTimeZone } from "date-fns-tz";

const ORG_NAME = "RADICAL HEALTH TECH PVT LTD";

/**
 * Escapes formulas to prevent spreadsheet formula injection attacks
 */
function sanitizeForExcel(val: any): any {
  if (typeof val === "string") {
    if (/^[=+\-@\t\r]/.test(val)) {
      return `'${val}`;
    }
  }
  return val;
}

export interface ExcelColumnDef {
  id: string;
  header: string;
  accessor: (row: DetailedExpenseReportRow) => any;
  width?: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
}

/**
 * Master dictionary of all 40+ available report columns
 */
export const ALL_REPORT_COLUMNS: Record<string, ExcelColumnDef> = {
  // Report columns
  reportNumber: { id: "reportNumber", header: "Report #", accessor: (r) => r.reportNumber, width: 18, align: "left" },
  tagTitle: { id: "tagTitle", header: "Expense Tag", accessor: (r) => r.tagTitle, width: 24, align: "left" },
  tagDescription: { id: "tagDescription", header: "Tag Description", accessor: (r) => r.tagDescription || "", width: 28, align: "left" },
  tagStatus: { id: "tagStatus", header: "Status", accessor: (r) => r.tagStatus, width: 14, align: "center" },
  tagTotal: { id: "tagTotal", header: "Tag Total (INR)", accessor: (r) => r.tagTotal, width: 16, numFmt: "₹#,##0.00", align: "right" },
  itemIndex: { id: "itemIndex", header: "Item #", accessor: (r) => r.itemIndex, width: 10, align: "center" },
  itemCount: { id: "itemCount", header: "Items In Tag", accessor: (r) => r.itemCount, width: 14, align: "center" },

  // Expense item columns
  expenseDate: { id: "expenseDate", header: "Expense Date", accessor: (r) => r.expenseDate, width: 14, align: "center" },
  vendorName: { id: "vendorName", header: "Vendor / Merchant", accessor: (r) => r.vendorName, width: 26, align: "left" },
  invoiceNumber: { id: "invoiceNumber", header: "Invoice #", accessor: (r) => r.invoiceNumber || "", width: 18, align: "left" },
  invoiceDate: { id: "invoiceDate", header: "Invoice Date", accessor: (r) => r.invoiceDate || "", width: 14, align: "center" },
  itemDescription: { id: "itemDescription", header: "Business Purpose", accessor: (r) => r.itemDescription, width: 32, align: "left" },
  categoryName: { id: "categoryName", header: "Category", accessor: (r) => r.categoryName, width: 20, align: "left" },
  subcategoryName: { id: "subcategoryName", header: "Subcategory", accessor: (r) => r.subcategoryName, width: 22, align: "left" },
  documentType: { id: "documentType", header: "Doc Type", accessor: (r) => r.documentType || "", width: 16, align: "center" },
  itemAmount: { id: "itemAmount", header: "Amount (INR)", accessor: (r) => r.itemAmount, width: 16, numFmt: "₹#,##0.00", align: "right" },
  currency: { id: "currency", header: "Currency", accessor: (r) => r.currency, width: 10, align: "center" },
  evidenceCount: { id: "evidenceCount", header: "Receipts", accessor: (r) => r.evidenceCount, width: 12, align: "center" },

  // GST columns
  gstTreatmentName: { id: "gstTreatmentName", header: "GST Treatment", accessor: (r) => r.gstTreatmentName || "Exempt", width: 20, align: "left" },
  vendorGstStatus: { id: "vendorGstStatus", header: "Vendor GST Reg", accessor: (r) => r.vendorGstStatus || "", width: 18, align: "center" },
  vendorGstin: { id: "vendorGstin", header: "Vendor GSTIN", accessor: (r) => r.vendorGstin || "", width: 18, align: "left" },
  companyGstin: { id: "companyGstin", header: "Recipient GSTIN", accessor: (r) => r.companyGstin || "", width: 18, align: "left" },
  placeOfSupply: { id: "placeOfSupply", header: "Place Of Supply", accessor: (r) => r.placeOfSupply || "", width: 16, align: "left" },
  hsnSacCode: { id: "hsnSacCode", header: "HSN / SAC", accessor: (r) => r.hsnSacCode || "", width: 14, align: "center" },
  taxMode: { id: "taxMode", header: "Tax Mode", accessor: (r) => r.taxMode || "", width: 16, align: "center" },
  taxableValue: { id: "taxableValue", header: "Taxable Value (INR)", accessor: (r) => r.taxableValue, width: 18, numFmt: "₹#,##0.00", align: "right" },
  gstRateLabel: { id: "gstRateLabel", header: "GST Rate", accessor: (r) => r.gstRateLabel || "0%", width: 12, align: "center" },
  cgstRate: { id: "cgstRate", header: "CGST %", accessor: (r) => (r.cgstRate ? `${r.cgstRate}%` : "-"), width: 12, align: "center" },
  cgstAmount: { id: "cgstAmount", header: "CGST (INR)", accessor: (r) => r.cgstAmount, width: 14, numFmt: "₹#,##0.00", align: "right" },
  sgstRate: { id: "sgstRate", header: "SGST %", accessor: (r) => (r.sgstRate ? `${r.sgstRate}%` : "-"), width: 12, align: "center" },
  sgstAmount: { id: "sgstAmount", header: "SGST (INR)", accessor: (r) => r.sgstAmount, width: 14, numFmt: "₹#,##0.00", align: "right" },
  igstRate: { id: "igstRate", header: "IGST %", accessor: (r) => (r.igstRate ? `${r.igstRate}%` : "-"), width: 12, align: "center" },
  igstAmount: { id: "igstAmount", header: "IGST (INR)", accessor: (r) => r.igstAmount, width: 14, numFmt: "₹#,##0.00", align: "right" },
  cessAmount: { id: "cessAmount", header: "Cess (INR)", accessor: (r) => r.cessAmount, width: 14, numFmt: "₹#,##0.00", align: "right" },
  totalGstAmount: { id: "totalGstAmount", header: "Total GST (INR)", accessor: (r) => r.totalGstAmount, width: 16, numFmt: "₹#,##0.00", align: "right" },
  reverseCharge: { id: "reverseCharge", header: "Reverse Charge", accessor: (r) => (r.reverseCharge ? "YES" : "NO"), width: 16, align: "center" },
  itcEligibility: { id: "itcEligibility", header: "ITC Eligibility", accessor: (r) => r.itcEligibility, width: 18, align: "center" },
  gstRemarks: { id: "gstRemarks", header: "GST Remarks", accessor: (r) => r.gstRemarks || "", width: 24, align: "left" },

  // Workflow columns
  submittedBy: { id: "submittedBy", header: "Submitted By", accessor: (r) => r.submittedBy, width: 20, align: "left" },
  submitterEmail: { id: "submitterEmail", header: "Submitter Email", accessor: (r) => r.submitterEmail, width: 24, align: "left" },
  submitterRole: { id: "submitterRole", header: "Submitter Role", accessor: (r) => r.submitterRole, width: 16, align: "center" },
  createdAt: { id: "createdAt", header: "Created At", accessor: (r) => r.createdAt, width: 18, align: "center" },
  submittedAt: { id: "submittedAt", header: "Submitted At", accessor: (r) => r.submittedAt || "-", width: 18, align: "center" },
  primaryApprover: { id: "primaryApprover", header: "Primary Approver", accessor: (r) => r.primaryApprover || "Unassigned", width: 20, align: "left" },
  approvedBy: { id: "approvedBy", header: "Approved By", accessor: (r) => r.approvedBy || "-", width: 20, align: "left" },
  approvedAt: { id: "approvedAt", header: "Approved At", accessor: (r) => r.approvedAt || "-", width: 18, align: "center" },
  reimbursementOwner: { id: "reimbursementOwner", header: "Reimbursement Owner", accessor: (r) => r.reimbursementOwner || "Unassigned", width: 22, align: "left" },
  reimbursedBy: { id: "reimbursedBy", header: "Reimbursed By", accessor: (r) => r.reimbursedBy || "-", width: 20, align: "left" },
  reimbursedAt: { id: "reimbursedAt", header: "Reimbursed At", accessor: (r) => r.reimbursedAt || "-", width: 18, align: "center" },
  paymentMethod: { id: "paymentMethod", header: "Payment Method", accessor: (r) => r.paymentMethod || "-", width: 18, align: "center" },
  reimbursementRef: { id: "reimbursementRef", header: "Ref / UTR #", accessor: (r) => r.reimbursementRef || "-", width: 20, align: "left" },
  transactionId: { id: "transactionId", header: "Txn ID", accessor: (r) => r.transactionId || "-", width: 18, align: "left" },
  lastUpdatedAt: { id: "lastUpdatedAt", header: "Last Updated", accessor: (r) => r.lastUpdatedAt, width: 18, align: "center" },
};

export const DEFAULT_COLUMN_IDS = [
  "reportNumber",
  "tagTitle",
  "tagStatus",
  "expenseDate",
  "vendorName",
  "categoryName",
  "itemDescription",
  "taxableValue",
  "totalGstAmount",
  "itemAmount",
  "submittedBy",
  "primaryApprover",
  "approvedBy",
  "reimbursementRef",
];

/**
 * Builds the complete formatted Excel spreadsheet using exceljs
 */
export async function generateDetailedExpenseExcel(params: {
  rows: DetailedExpenseReportRow[];
  summaryTotals: DetailedReportSummaryTotals;
  filterParams: DetailedReportFilterParams;
  visibleColumnIds?: string[];
  generatedByUser: { name: string; email: string; role: string };
}): Promise<Buffer> {
  const { rows, summaryTotals, filterParams, visibleColumnIds, generatedByUser } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${ORG_NAME} - Expense Management System`;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Detailed Expense Report", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true },
  });

  const activeColumnIds =
    visibleColumnIds && visibleColumnIds.length > 0 ? visibleColumnIds : DEFAULT_COLUMN_IDS;

  const columns: ExcelColumnDef[] = activeColumnIds
    .map((id) => ALL_REPORT_COLUMNS[id])
    .filter(Boolean);

  const timestamp = formatInTimeZone(new Date(), TIMEZONE, "dd-MMM-yyyy HH:mm:ss zzz");

  // Row 1: Org Header
  worksheet.mergeCells(1, 1, 1, columns.length);
  const row1 = worksheet.getRow(1);
  row1.getCell(1).value = ORG_NAME;
  row1.getCell(1).font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  row1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2B5C" } };
  row1.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row1.height = 28;

  // Row 2: Report Title
  worksheet.mergeCells(2, 1, 2, columns.length);
  const row2 = worksheet.getRow(2);
  row2.getCell(1).value = "DETAILED EXPENSE & GST REIMBURSEMENT REPORT";
  row2.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF0F2B5C" } };
  row2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF2FA" } };
  row2.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row2.height = 22;

  // Row 3: Meta Info (Generated By & At)
  worksheet.mergeCells(3, 1, 3, columns.length);
  const row3 = worksheet.getRow(3);
  row3.getCell(1).value = `Generated By: ${generatedByUser.name} (${generatedByUser.email} - ${generatedByUser.role}) | Generated On: ${timestamp} | Records Count: ${rows.length}`;
  row3.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF555555" } };
  row3.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FC" } };
  row3.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row3.height = 18;

  // Row 4: Applied Filter Summary
  const filterDescParts: string[] = [];
  if (filterParams.filterMode === "DATE_RANGE") {
    filterDescParts.push(`Date Range (${filterParams.dateBasis || "EXPENSE_DATE"}): ${filterParams.fromDate || "All"} to ${filterParams.toDate || "All"}`);
  } else if (filterParams.filterMode === "MULTIPLE_MONTHS") {
    filterDescParts.push(`Months: ${filterParams.selectedMonths?.join(", ") || "All"} in Year ${filterParams.year || new Date().getFullYear()}`);
  }
  if (filterParams.status) filterDescParts.push(`Status: ${filterParams.status}`);
  if (filterParams.vendorName) filterDescParts.push(`Vendor: ${filterParams.vendorName}`);
  if (filterParams.globalSearch) filterDescParts.push(`Search: "${filterParams.globalSearch}"`);

  worksheet.mergeCells(4, 1, 4, columns.length);
  const row4 = worksheet.getRow(4);
  row4.getCell(1).value = `Applied Filters: ${filterDescParts.length > 0 ? filterDescParts.join(" | ") : "All Records (No Filters)"}`;
  row4.getCell(1).font = { name: "Calibri", size: 8.5, color: { argb: "FF333333" } };
  row4.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FC" } };
  row4.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  row4.height = 18;

  // Row 5: Empty Spacer
  worksheet.getRow(5).height = 8;

  // Row 6: Table Header Row
  const headerRow = worksheet.getRow(6);
  headerRow.height = 24;

  columns.forEach((col, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "medium", color: { argb: "FF0F2B5C" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };

    worksheet.getColumn(colIdx + 1).width = col.width || 18;
  });

  // Enable Auto-filter on header row
  worksheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: columns.length },
  };

  // Data Rows
  let currentRowNum = 7;
  for (const rowData of rows) {
    const dataRow = worksheet.getRow(currentRowNum);
    dataRow.height = 20;

    const isEven = currentRowNum % 2 === 0;

    columns.forEach((col, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      const rawVal = col.accessor(rowData);
      cell.value = sanitizeForExcel(rawVal);

      cell.font = { name: "Calibri", size: 9.5, color: { argb: "FF111827" } };
      if (col.numFmt && typeof rawVal === "number") {
        cell.numFmt = col.numFmt;
      }
      cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFF9FAFB" : "FFFFFFFF" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    currentRowNum++;
  }

  // Summary Totals Row
  const totalsRow = worksheet.getRow(currentRowNum);
  totalsRow.height = 24;

  columns.forEach((col, colIdx) => {
    const cell = totalsRow.getCell(colIdx + 1);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F2B5C" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF1E3A8A" } },
      bottom: { style: "double", color: { argb: "FF1E3A8A" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };

    if (colIdx === 0) {
      cell.value = "TOTALS / AGGREGATE";
    } else if (col.id === "taxableValue") {
      cell.value = summaryTotals.totalTaxableValue;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "cgstAmount") {
      cell.value = summaryTotals.totalCgst;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "sgstAmount") {
      cell.value = summaryTotals.totalSgst;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "igstAmount") {
      cell.value = summaryTotals.totalIgst;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "cessAmount") {
      cell.value = summaryTotals.totalCess;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "totalGstAmount") {
      cell.value = summaryTotals.totalGst;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (col.id === "itemAmount" || col.id === "tagTotal") {
      cell.value = summaryTotals.grandTotal;
      cell.numFmt = "₹#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else {
      cell.value = "";
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
