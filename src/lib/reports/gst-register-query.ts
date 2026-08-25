import prisma from "@/lib/db";
import {
  ReportStatus,
  Role,
  TaxMode,
  ItcEligibility,
  VendorGstStatus,
  WorkflowStage,
  AssignmentStatus,
  Prisma,
} from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import {
  evaluateGstItemExceptions,
  GstExceptionItem,
  GstExceptionCode,
  RawGstItemForValidation,
} from "./gst-exceptions";

export const TIMEZONE = "Asia/Kolkata";
export const ORG_NAME = "RADICAL HEALTH TECH PVT LTD";
export const ORG_ADDRESS = "Action Area II , Ecospace | GSTIN: 19AAACR1234A1Z5";
export const GST_DISCLAIMER = "INTERNAL GST EXPENSE REGISTER – SUBJECT TO ACCOUNTS REVIEW";

export interface GstRegisterFilterParams {
  filterMode?: "DATE_RANGE" | "MULTIPLE_MONTHS";
  dateBasis?: "EXPENSE_DATE" | "SUBMITTED_DATE" | "APPROVED_DATE" | "REIMBURSED_DATE";
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  year?: number;
  selectedMonths?: number[];
  statuses?: ReportStatus[]; // Default: All or [SUBMITTED, APPROVED, REIMBURSED]
  submittedById?: string;
  vendorName?: string;
  vendorGstin?: string;
  categoryId?: string;
  subcategoryId?: string;
  gstTreatmentId?: string;
  gstRateId?: string;
  taxMode?: TaxMode;
  placeOfSupply?: string;
  itcEligibility?: ItcEligibility;
  reverseCharge?: boolean;
  hasEvidence?: boolean;
  hasException?: boolean;
  exceptionCode?: GstExceptionCode;
  globalSearch?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GstRegisterRow {
  // Identification
  itemId: string;
  reportId: string;
  reportNumber: string;
  tagTitle: string;
  status: ReportStatus;
  expenseDate: string;
  rawExpenseDate: Date;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;

  // Vendor & GST Treatment
  vendorName: string;
  vendorGstStatus?: VendorGstStatus | null;
  vendorGstin?: string | null;
  companyGstin?: string | null;
  documentType?: string | null;
  gstTreatmentName: string;
  isTaxableTreatment: boolean;
  categoryName: string;
  subcategoryName: string;
  placeOfSupply?: string | null;
  hsnSacCode?: string | null;
  taxMode?: TaxMode | null;

  // Financials
  taxableValue: number;
  gstRateLabel: string;
  gstRatePercent: number | null;
  cgstRate: number | null;
  cgstAmount: number;
  sgstRate: number | null;
  sgstAmount: number;
  igstRate: number | null;
  igstAmount: number;
  cessAmount: number;
  totalGstAmount: number;
  grossAmount: number;

  // Compliance & Classification
  reverseCharge: boolean;
  itcEligibility: ItcEligibility;
  gstRemarks?: string | null;
  evidenceCount: number;

  // Workflow
  submittedBy: string;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  reimbursedAt?: string | null;

  // Data Quality Exceptions
  exceptions: GstExceptionItem[];
  exceptionCount: number;
}

export interface GstSummaryKpis {
  grossExpense: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalGst: number;
  eligibleItc: number;
  ineligibleItc: number;
  pendingItcReview: number;
  rcmAmount: number;
  nonGstAmount: number;
  recordCount: number;
  exceptionCount: number;
}

export interface GstMonthlyTrendItem {
  monthKey: string; // "2026-01"
  monthLabel: string; // "Jan 2026"
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalGst: number;
  grossAmount: number;
}

export interface GstTaxComponentItem {
  component: string;
  amount: number;
  percentage: number;
  fill: string;
}

export interface GstRateBreakdownItem {
  rateLabel: string;
  taxableValue: number;
  totalGst: number;
  itemCount: number;
}

export interface GstItcBreakdownItem {
  eligibility: ItcEligibility;
  label: string;
  itcAmount: number;
  itemCount: number;
  percentage: number;
}

export interface GstCategorySummaryItem {
  categoryName: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  grossAmount: number;
  itemCount: number;
}

export interface GstVendorSummaryItem {
  vendorName: string;
  vendorGstin: string;
  taxableValue: number;
  totalGst: number;
  grossAmount: number;
  itemCount: number;
  hasExceptions: boolean;
}

export interface GstAnalyticsData {
  kpis: GstSummaryKpis;
  monthlyTrend: GstMonthlyTrendItem[];
  taxComponents: GstTaxComponentItem[];
  ratesBreakdown: GstRateBreakdownItem[];
  itcBreakdown: GstItcBreakdownItem[];
  categoriesSummary: GstCategorySummaryItem[];
  vendorsSummary: GstVendorSummaryItem[];
  rcmTransactions: GstRegisterRow[];
  nonGstTransactions: GstRegisterRow[];
  exceptionsList: { row: GstRegisterRow; exceptions: GstExceptionItem[] }[];
}

/**
 * Builds the Prisma where clause for GST Expense items
 */
export function buildGstRegisterWhereClause(
  filters: GstRegisterFilterParams
): Prisma.ExpenseItemWhereInput {
  const where: Prisma.ExpenseItemWhereInput = {};
  const andConditions: Prisma.ExpenseItemWhereInput[] = [];

  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const filterMode = filters.filterMode || "DATE_RANGE";

  // 1. Date Filtering
  if (filterMode === "DATE_RANGE") {
    if (filters.fromDate || filters.toDate) {
      let fromUtc: Date | undefined;
      let toUtc: Date | undefined;

      if (filters.fromDate) {
        fromUtc = new Date(`${filters.fromDate}T00:00:00.000+05:30`);
      }
      if (filters.toDate) {
        toUtc = new Date(`${filters.toDate}T23:59:59.999+05:30`);
      }

      const dateFilter: Prisma.DateTimeFilter = {};
      if (fromUtc) dateFilter.gte = fromUtc;
      if (toUtc) dateFilter.lte = toUtc;

      if (dateBasis === "EXPENSE_DATE") {
        andConditions.push({ expenseDate: dateFilter });
      } else if (dateBasis === "SUBMITTED_DATE") {
        andConditions.push({ report: { submittedAt: dateFilter } });
      } else if (dateBasis === "APPROVED_DATE") {
        andConditions.push({ report: { approvedAt: dateFilter } });
      } else if (dateBasis === "REIMBURSED_DATE") {
        andConditions.push({ report: { reimbursedAt: dateFilter } });
      }
    }
  } else if (filterMode === "MULTIPLE_MONTHS") {
    const year = filters.year || new Date().getFullYear();
    const months = filters.selectedMonths && filters.selectedMonths.length > 0 ? filters.selectedMonths : [];

    if (months.length > 0) {
      const monthOrConditions: Prisma.ExpenseItemWhereInput[] = months.map((monthNum) => {
        const monthPad = String(monthNum).padStart(2, "0");
        const startStr = `${year}-${monthPad}-01T00:00:00.000+05:30`;
        const startUtc = new Date(startStr);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endStr = `${year}-${monthPad}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`;
        const endUtc = new Date(endStr);

        const dateFilter = { gte: startUtc, lte: endUtc };

        if (dateBasis === "EXPENSE_DATE") {
          return { expenseDate: dateFilter };
        } else if (dateBasis === "SUBMITTED_DATE") {
          return { report: { submittedAt: dateFilter } };
        } else if (dateBasis === "APPROVED_DATE") {
          return { report: { approvedAt: dateFilter } };
        } else {
          return { report: { reimbursedAt: dateFilter } };
        }
      });

      andConditions.push({ OR: monthOrConditions });
    }
  }

  // 2. Statuses
  if (filters.statuses && filters.statuses.length > 0) {
    andConditions.push({ report: { status: { in: filters.statuses } } });
  }

  // 3. Vendor
  if (filters.vendorName?.trim()) {
    andConditions.push({
      vendorName: { contains: filters.vendorName.trim(), mode: "insensitive" },
    });
  }

  // 4. Vendor GSTIN
  if (filters.vendorGstin?.trim()) {
    andConditions.push({
      vendorGstin: { contains: filters.vendorGstin.trim(), mode: "insensitive" },
    });
  }

  // 5. Category & Subcategory
  if (filters.categoryId) {
    andConditions.push({ categoryId: filters.categoryId });
  }
  if (filters.subcategoryId) {
    andConditions.push({ subcategoryId: filters.subcategoryId });
  }

  // 6. GST Treatment & Rate
  if (filters.gstTreatmentId) {
    andConditions.push({ gstTreatmentId: filters.gstTreatmentId });
  }
  if (filters.gstRateId) {
    andConditions.push({ gstRateId: filters.gstRateId });
  }

  // 7. Tax Mode & Place of Supply
  if (filters.taxMode) {
    andConditions.push({ taxMode: filters.taxMode });
  }
  if (filters.placeOfSupply?.trim()) {
    andConditions.push({
      placeOfSupply: { contains: filters.placeOfSupply.trim(), mode: "insensitive" },
    });
  }

  // 8. ITC & Reverse Charge
  if (filters.itcEligibility) {
    andConditions.push({ itcEligibility: filters.itcEligibility });
  }
  if (filters.reverseCharge !== undefined) {
    andConditions.push({ reverseCharge: filters.reverseCharge });
  }

  // 9. Submitter
  if (filters.submittedById) {
    andConditions.push({ report: { userId: filters.submittedById } });
  }

  // 10. Evidence Attached
  if (filters.hasEvidence === true) {
    andConditions.push({ evidences: { some: {} } });
  } else if (filters.hasEvidence === false) {
    andConditions.push({ evidences: { none: {} } });
  }

  // 11. Global Search
  if (filters.globalSearch?.trim()) {
    const q = filters.globalSearch.trim();
    andConditions.push({
      OR: [
        { vendorName: { contains: q, mode: "insensitive" } },
        { vendorGstin: { contains: q, mode: "insensitive" } },
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { hsnSacCode: { contains: q, mode: "insensitive" } },
        { placeOfSupply: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { report: { reportNumber: { contains: q, mode: "insensitive" } } },
        { report: { title: { contains: q, mode: "insensitive" } } },
        { report: { user: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

/**
 * Finds all duplicate (Vendor GSTIN + Invoice Number) combinations across all reports
 */
async function findDuplicateInvoiceKeys(): Promise<Set<string>> {
  const items = await prisma.expenseItem.findMany({
    where: {
      vendorGstin: { not: null },
      invoiceNumber: { not: null },
    },
    select: { vendorGstin: true, invoiceNumber: true },
  });

  const countMap = new Map<string, number>();
  for (const it of items) {
    if (it.vendorGstin && it.invoiceNumber) {
      const k = `${it.vendorGstin.trim().toUpperCase()}__${it.invoiceNumber.trim().toUpperCase()}`;
      countMap.set(k, (countMap.get(k) || 0) + 1);
    }
  }

  const duplicates = new Set<string>();
  countMap.forEach((count, key) => {
    if (count > 1) {
      duplicates.add(key);
    }
  });

  return duplicates;
}

/**
 * Main query for GST Expense Register data with exception evaluation and KPIs
 */
export async function getGstRegisterData(
  filters: GstRegisterFilterParams,
  pagination = true
): Promise<{
  rows: GstRegisterRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  kpis: GstSummaryKpis;
}> {
  const where = buildGstRegisterWhereClause(filters);

  const duplicateKeys = await findDuplicateInvoiceKeys();

  // Fetch all matching items
  const rawItems = await prisma.expenseItem.findMany({
    where,
    include: {
      category: true,
      subcategory: true,
      gstTreatment: true,
      gstRate: true,
      evidences: { select: { id: true, originalName: true } },
      report: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          reimbursedBy: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { expenseDate: "desc" },
  });

  // Transform and evaluate exceptions for each row
  let allRows: GstRegisterRow[] = [];

  let grossExpense = 0;
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  let totalGst = 0;
  let eligibleItc = 0;
  let ineligibleItc = 0;
  let pendingItcReview = 0;
  let rcmAmount = 0;
  let nonGstAmount = 0;
  let totalExceptionCount = 0;

  for (const item of rawItems) {
    const itemGross = Number(item.totalAmount) || 0;
    const itemTaxable = Number(item.taxableValue) || 0;
    const itemCgst = Number(item.cgstAmount) || 0;
    const itemSgst = Number(item.sgstAmount) || 0;
    const itemIgst = Number(item.igstAmount) || 0;
    const itemCess = Number(item.cessAmount) || 0;
    const itemTotalGst = Number(item.totalGstAmount) || 0;

    const isTaxableTreatment = item.gstTreatment ? item.gstTreatment.isTaxable : itemTotalGst > 0;

    const validationPayload: RawGstItemForValidation = {
      id: item.id,
      reportId: item.report.id,
      reportNumber: item.report.reportNumber,
      vendorName: item.vendorName,
      vendorGstin: item.vendorGstin,
      vendorGstStatus: item.vendorGstStatus,
      invoiceNumber: item.invoiceNumber,
      invoiceDate: item.invoiceDate,
      documentType: item.documentType,
      gstTreatmentCode: item.gstTreatment?.code,
      gstTreatmentName: item.gstTreatment?.name,
      isTaxableTreatment,
      hsnSacCode: item.hsnSacCode,
      placeOfSupply: item.placeOfSupply,
      taxMode: item.taxMode,
      taxableValue: itemTaxable,
      gstRatePercent: item.gstRate ? Number(item.gstRate.ratePercent) : null,
      cgstAmount: itemCgst,
      sgstAmount: itemSgst,
      igstAmount: itemIgst,
      cessAmount: itemCess,
      totalGstAmount: itemTotalGst,
      totalAmount: itemGross,
      reverseCharge: item.reverseCharge,
      itcEligibility: item.itcEligibility,
      evidenceCount: item.evidences.length,
    };

    const exceptions = evaluateGstItemExceptions(validationPayload, duplicateKeys);
    if (exceptions.length > 0) {
      totalExceptionCount += exceptions.length;
    }

    grossExpense += itemGross;
    taxableValue += itemTaxable;
    cgst += itemCgst;
    sgst += itemSgst;
    igst += itemIgst;
    cess += itemCess;
    totalGst += itemTotalGst;

    if (item.itcEligibility === ItcEligibility.ELIGIBLE) {
      eligibleItc += itemTotalGst;
    } else if (item.itcEligibility === ItcEligibility.INELIGIBLE) {
      ineligibleItc += itemTotalGst;
    } else if (item.itcEligibility === ItcEligibility.PENDING_REVIEW) {
      pendingItcReview += itemTotalGst;
    }

    if (item.reverseCharge) {
      rcmAmount += itemGross;
    }

    if (!isTaxableTreatment || itemTotalGst === 0) {
      nonGstAmount += itemGross;
    }

    allRows.push({
      itemId: item.id,
      reportId: item.report.id,
      reportNumber: item.report.reportNumber,
      tagTitle: item.report.title,
      status: item.report.status,
      expenseDate: formatInTimeZone(new Date(item.expenseDate), TIMEZONE, "dd-MMM-yyyy"),
      rawExpenseDate: item.expenseDate,
      invoiceDate: item.invoiceDate
        ? formatInTimeZone(new Date(item.invoiceDate), TIMEZONE, "dd-MMM-yyyy")
        : null,
      invoiceNumber: item.invoiceNumber,

      vendorName: item.vendorName,
      vendorGstStatus: item.vendorGstStatus,
      vendorGstin: item.vendorGstin,
      companyGstin: item.companyGstin,
      documentType: item.documentType,
      gstTreatmentName: item.gstTreatment?.name || (itemTotalGst > 0 ? "Taxable Supply" : "Exempt / Non-GST"),
      isTaxableTreatment,
      categoryName: item.category.name,
      subcategoryName: item.subcategory.name,
      placeOfSupply: item.placeOfSupply,
      hsnSacCode: item.hsnSacCode,
      taxMode: item.taxMode,

      taxableValue: itemTaxable,
      gstRateLabel: item.gstRate?.label || (itemTotalGst > 0 ? "Custom" : "0%"),
      gstRatePercent: item.gstRate ? Number(item.gstRate.ratePercent) : null,
      cgstRate: item.cgstRate ? Number(item.cgstRate) : null,
      cgstAmount: itemCgst,
      sgstRate: item.sgstRate ? Number(item.sgstRate) : null,
      sgstAmount: itemSgst,
      igstRate: item.igstRate ? Number(item.igstRate) : null,
      igstAmount: itemIgst,
      cessAmount: itemCess,
      totalGstAmount: itemTotalGst,
      grossAmount: itemGross,

      reverseCharge: item.reverseCharge,
      itcEligibility: item.itcEligibility,
      gstRemarks: item.gstRemarks,
      evidenceCount: item.evidences.length,

      submittedBy: item.report.user.name,
      submittedAt: item.report.submittedAt
        ? formatInTimeZone(new Date(item.report.submittedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      approvedBy: item.report.approvedBy?.name || null,
      approvedAt: item.report.approvedAt
        ? formatInTimeZone(new Date(item.report.approvedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      reimbursedAt: item.report.reimbursedAt
        ? formatInTimeZone(new Date(item.report.reimbursedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,

      exceptions,
      exceptionCount: exceptions.length,
    });
  }

  // Filter by hasException or exceptionCode if requested
  if (filters.hasException === true) {
    allRows = allRows.filter((r) => r.exceptionCount > 0);
  } else if (filters.hasException === false) {
    allRows = allRows.filter((r) => r.exceptionCount === 0);
  }

  if (filters.exceptionCode) {
    allRows = allRows.filter((r) => r.exceptions.some((e) => e.code === filters.exceptionCode));
  }

  // Sorting
  const sortBy = filters.sortBy || "expenseDate";
  const sortOrder = filters.sortOrder || "desc";

  allRows.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "expenseDate") {
      cmp = new Date(a.rawExpenseDate).getTime() - new Date(b.rawExpenseDate).getTime();
    } else if (sortBy === "taxableValue") {
      cmp = a.taxableValue - b.taxableValue;
    } else if (sortBy === "totalGstAmount") {
      cmp = a.totalGstAmount - b.totalGstAmount;
    } else if (sortBy === "grossAmount") {
      cmp = a.grossAmount - b.grossAmount;
    } else if (sortBy === "vendorName") {
      cmp = a.vendorName.localeCompare(b.vendorName);
    } else if (sortBy === "exceptionCount") {
      cmp = a.exceptionCount - b.exceptionCount;
    } else if (sortBy === "reportNumber") {
      cmp = a.reportNumber.localeCompare(b.reportNumber);
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const totalCount = allRows.length;
  const page = Math.max(1, filters.page || 1);
  const pageSize = pagination ? Math.max(1, Math.min(100, filters.pageSize || 25)) : 100000;
  const paginatedRows = pagination ? allRows.slice((page - 1) * pageSize, page * pageSize) : allRows;

  const kpis: GstSummaryKpis = {
    grossExpense,
    taxableValue,
    cgst,
    sgst,
    igst,
    cess,
    totalGst,
    eligibleItc,
    ineligibleItc,
    pendingItcReview,
    rcmAmount,
    nonGstAmount,
    recordCount: rawItems.length,
    exceptionCount: totalExceptionCount,
  };

  return {
    rows: paginatedRows,
    totalCount,
    page,
    pageSize,
    kpis,
  };
}

/**
 * Computes deep GST analytics aggregations across tax components, rates, ITC, categories, vendors
 */
export async function getGstAnalyticsData(
  filters: GstRegisterFilterParams
): Promise<GstAnalyticsData> {
  const { rows, kpis } = await getGstRegisterData(filters, false);

  // 1. Monthly GST Trend
  const monthMap = new Map<string, GstMonthlyTrendItem>();
  const rateMap = new Map<string, { rateLabel: string; taxableValue: number; totalGst: number; itemCount: number }>();
  const itcMap = new Map<ItcEligibility, { itcAmount: number; itemCount: number }>();
  const categoryMap = new Map<string, GstCategorySummaryItem>();
  const vendorMap = new Map<string, GstVendorSummaryItem>();

  const rcmTransactions: GstRegisterRow[] = [];
  const nonGstTransactions: GstRegisterRow[] = [];
  const exceptionsList: { row: GstRegisterRow; exceptions: GstExceptionItem[] }[] = [];

  for (const r of rows) {
    // Monthly
    const mKey = formatInTimeZone(new Date(r.rawExpenseDate), TIMEZONE, "yyyy-MM");
    const mLabel = formatInTimeZone(new Date(r.rawExpenseDate), TIMEZONE, "MMM yyyy");
    if (!monthMap.has(mKey)) {
      monthMap.set(mKey, {
        monthKey: mKey,
        monthLabel: mLabel,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        totalGst: 0,
        grossAmount: 0,
      });
    }
    const mEntry = monthMap.get(mKey)!;
    mEntry.taxableValue += r.taxableValue;
    mEntry.cgst += r.cgstAmount;
    mEntry.sgst += r.sgstAmount;
    mEntry.igst += r.igstAmount;
    mEntry.cess += r.cessAmount;
    mEntry.totalGst += r.totalGstAmount;
    mEntry.grossAmount += r.grossAmount;

    // Rates
    const rKey = r.gstRateLabel || "0%";
    if (!rateMap.has(rKey)) {
      rateMap.set(rKey, { rateLabel: rKey, taxableValue: 0, totalGst: 0, itemCount: 0 });
    }
    const rateEntry = rateMap.get(rKey)!;
    rateEntry.taxableValue += r.taxableValue;
    rateEntry.totalGst += r.totalGstAmount;
    rateEntry.itemCount += 1;

    // ITC
    if (!itcMap.has(r.itcEligibility)) {
      itcMap.set(r.itcEligibility, { itcAmount: 0, itemCount: 0 });
    }
    const itcEntry = itcMap.get(r.itcEligibility)!;
    itcEntry.itcAmount += r.totalGstAmount;
    itcEntry.itemCount += 1;

    // Category
    if (!categoryMap.has(r.categoryName)) {
      categoryMap.set(r.categoryName, {
        categoryName: r.categoryName,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGst: 0,
        grossAmount: 0,
        itemCount: 0,
      });
    }
    const catEntry = categoryMap.get(r.categoryName)!;
    catEntry.taxableValue += r.taxableValue;
    catEntry.cgst += r.cgstAmount;
    catEntry.sgst += r.sgstAmount;
    catEntry.igst += r.igstAmount;
    catEntry.totalGst += r.totalGstAmount;
    catEntry.grossAmount += r.grossAmount;
    catEntry.itemCount += 1;

    // Vendor
    const vKey = `${r.vendorName}__${r.vendorGstin || "NO_GSTIN"}`;
    if (!vendorMap.has(vKey)) {
      vendorMap.set(vKey, {
        vendorName: r.vendorName,
        vendorGstin: r.vendorGstin || "Unregistered / None",
        taxableValue: 0,
        totalGst: 0,
        grossAmount: 0,
        itemCount: 0,
        hasExceptions: false,
      });
    }
    const vEntry = vendorMap.get(vKey)!;
    vEntry.taxableValue += r.taxableValue;
    vEntry.totalGst += r.totalGstAmount;
    vEntry.grossAmount += r.grossAmount;
    vEntry.itemCount += 1;
    if (r.exceptionCount > 0) vEntry.hasExceptions = true;

    if (r.reverseCharge) rcmTransactions.push(r);
    if (!r.isTaxableTreatment || r.totalGstAmount === 0) nonGstTransactions.push(r);
    if (r.exceptionCount > 0) exceptionsList.push({ row: r, exceptions: r.exceptions });
  }

  // 2. Tax Components
  const totalGst = kpis.totalGst || 1;
  const taxComponents: GstTaxComponentItem[] = [
    { component: "CGST", amount: kpis.cgst, percentage: Number(((kpis.cgst / totalGst) * 100).toFixed(2)), fill: "#3B82F6" },
    { component: "SGST / UTGST", amount: kpis.sgst, percentage: Number(((kpis.sgst / totalGst) * 100).toFixed(2)), fill: "#10B981" },
    { component: "IGST", amount: kpis.igst, percentage: Number(((kpis.igst / totalGst) * 100).toFixed(2)), fill: "#8B5CF6" },
    { component: "Cess", amount: kpis.cess, percentage: Number(((kpis.cess / totalGst) * 100).toFixed(2)), fill: "#F59E0B" },
  ].filter((c) => c.amount > 0 || c.component !== "Cess");

  // 3. ITC Breakdown
  const itcBreakdown: GstItcBreakdownItem[] = [
    {
      eligibility: ItcEligibility.ELIGIBLE,
      label: "Eligible ITC",
      itcAmount: kpis.eligibleItc,
      itemCount: itcMap.get(ItcEligibility.ELIGIBLE)?.itemCount || 0,
      percentage: totalGst > 0 ? Number(((kpis.eligibleItc / totalGst) * 100).toFixed(2)) : 0,
    },
    {
      eligibility: ItcEligibility.INELIGIBLE,
      label: "Ineligible ITC",
      itcAmount: kpis.ineligibleItc,
      itemCount: itcMap.get(ItcEligibility.INELIGIBLE)?.itemCount || 0,
      percentage: totalGst > 0 ? Number(((kpis.ineligibleItc / totalGst) * 100).toFixed(2)) : 0,
    },
    {
      eligibility: ItcEligibility.PENDING_REVIEW,
      label: "Pending ITC Review",
      itcAmount: kpis.pendingItcReview,
      itemCount: itcMap.get(ItcEligibility.PENDING_REVIEW)?.itemCount || 0,
      percentage: totalGst > 0 ? Number(((kpis.pendingItcReview / totalGst) * 100).toFixed(2)) : 0,
    },
    {
      eligibility: ItcEligibility.NOT_APPLICABLE,
      label: "Not Applicable",
      itcAmount: itcMap.get(ItcEligibility.NOT_APPLICABLE)?.itcAmount || 0,
      itemCount: itcMap.get(ItcEligibility.NOT_APPLICABLE)?.itemCount || 0,
      percentage: totalGst > 0 ? Number((((itcMap.get(ItcEligibility.NOT_APPLICABLE)?.itcAmount || 0) / totalGst) * 100).toFixed(2)) : 0,
    },
  ];

  return {
    kpis,
    monthlyTrend: Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    taxComponents,
    ratesBreakdown: Array.from(rateMap.values()).sort((a, b) => b.totalGst - a.totalGst),
    itcBreakdown,
    categoriesSummary: Array.from(categoryMap.values()).sort((a, b) => b.totalGst - a.totalGst),
    vendorsSummary: Array.from(vendorMap.values()).sort((a, b) => b.totalGst - a.totalGst).slice(0, 20),
    rcmTransactions,
    nonGstTransactions,
    exceptionsList,
  };
}
