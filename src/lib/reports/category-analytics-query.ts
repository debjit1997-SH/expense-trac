import prisma from "@/lib/db";
import {
  ReportStatus,
  Role,
  Prisma,
} from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { differenceInDays, subDays } from "date-fns";

export const TIMEZONE = "Asia/Kolkata";
export const ORG_NAME = "RADICAL HEALTH TECH PVT LTD";
export const ORG_ADDRESS = "Action Area II , Ecospace | GSTIN: 19AAACR1234A1Z5";

export interface CategoryAnalyticsFilterParams {
  filterMode?: "DATE_RANGE" | "MULTIPLE_MONTHS";
  dateBasis?: "EXPENSE_DATE" | "SUBMITTED_DATE" | "APPROVED_DATE" | "REIMBURSED_DATE";
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  year?: number; // e.g. 2026
  selectedMonths?: number[]; // 1 to 12
  statuses?: ReportStatus[]; // Default: [APPROVED, REIMBURSED]
  submittedById?: string;
  categoryId?: string;
  subcategoryId?: string;
  vendorName?: string;
  compareWithPreviousPeriod?: boolean;
}

export interface KpiSummary {
  totalExpense: number;
  totalReimbursed: number;
  approvedAwaitingReimbursement: number;
  totalGst: number;
  totalTaxableValue: number;
  itemCount: number;
  averageExpenseAmount: number;
  highestExpenseCategory: { name: string; amount: number } | null;
  highestExpenseVendor: { name: string; amount: number } | null;

  // Previous Period comparison (if enabled)
  previousPeriod?: {
    totalExpense: number;
    totalReimbursed: number;
    totalGst: number;
    itemCount: number;
    averageExpenseAmount: number;
    expenseDeltaPct: number | null; // % change vs previous
    reimbursedDeltaPct: number | null;
  };
}

export interface CategorySummaryItem {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  itemCount: number;
  totalAmount: number;
  taxableValue: number;
  totalGst: number;
  avgAmount: number;
  maxAmount: number;
  percentageOfTotal: number;
  subcategories: SubcategorySummaryItem[];
}

export interface SubcategorySummaryItem {
  subcategoryId: string;
  subcategoryCode: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  itemCount: number;
  totalAmount: number;
  taxableValue: number;
  totalGst: number;
  avgAmount: number;
  maxAmount: number;
  percentageOfCategory: number;
  percentageOfTotal: number;
}

export interface MonthlyTrendItem {
  monthKey: string; // "2026-01"
  monthLabel: string; // "Jan 2026"
  totalAmount: number;
  categoryBreakdown: Record<string, number>; // categoryName -> amount
}

export interface TopVendorItem {
  vendorName: string;
  totalAmount: number;
  itemCount: number;
  taxableValue: number;
  totalGst: number;
  percentageOfTotal: number;
}

export interface CategoryAnalyticsResult {
  kpis: KpiSummary;
  categories: CategorySummaryItem[];
  subcategories: SubcategorySummaryItem[];
  monthlyTrend: MonthlyTrendItem[];
  topVendors: TopVendorItem[];
  activeFilters: CategoryAnalyticsFilterParams;
}

/**
 * Builds the Prisma where clause for analytics filtering
 */
export function buildAnalyticsWhereClause(
  filters: CategoryAnalyticsFilterParams,
  overrideDateRange?: { fromUtc?: Date; toUtc?: Date }
): Prisma.ExpenseItemWhereInput {
  const where: Prisma.ExpenseItemWhereInput = {};
  const andConditions: Prisma.ExpenseItemWhereInput[] = [];

  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const filterMode = filters.filterMode || "DATE_RANGE";

  // 1. Status Filter (Default: APPROVED and REIMBURSED)
  const activeStatuses =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses
      : [ReportStatus.APPROVED, ReportStatus.REIMBURSED];

  andConditions.push({
    report: { status: { in: activeStatuses } },
  });

  // 2. Date Filter
  if (overrideDateRange) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (overrideDateRange.fromUtc) dateFilter.gte = overrideDateRange.fromUtc;
    if (overrideDateRange.toUtc) dateFilter.lte = overrideDateRange.toUtc;

    if (dateBasis === "EXPENSE_DATE") {
      andConditions.push({ expenseDate: dateFilter });
    } else if (dateBasis === "SUBMITTED_DATE") {
      andConditions.push({ report: { submittedAt: dateFilter } });
    } else if (dateBasis === "APPROVED_DATE") {
      andConditions.push({ report: { approvedAt: dateFilter } });
    } else if (dateBasis === "REIMBURSED_DATE") {
      andConditions.push({ report: { reimbursedAt: dateFilter } });
    }
  } else if (filterMode === "DATE_RANGE") {
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

  // 3. Category & Subcategory
  if (filters.categoryId) {
    andConditions.push({ categoryId: filters.categoryId });
  }
  if (filters.subcategoryId) {
    andConditions.push({ subcategoryId: filters.subcategoryId });
  }

  // 4. Vendor
  if (filters.vendorName?.trim()) {
    andConditions.push({
      vendorName: { contains: filters.vendorName.trim(), mode: "insensitive" },
    });
  }

  // 5. Submitter
  if (filters.submittedById) {
    andConditions.push({ report: { userId: filters.submittedById } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

/**
 * Calculates previous period date bounds
 */
function calculatePreviousPeriodBounds(filters: CategoryAnalyticsFilterParams): { fromUtc?: Date; toUtc?: Date } | null {
  if (filters.filterMode === "DATE_RANGE" && filters.fromDate && filters.toDate) {
    const currentFrom = new Date(`${filters.fromDate}T00:00:00.000+05:30`);
    const currentTo = new Date(`${filters.toDate}T23:59:59.999+05:30`);
    const durationDays = differenceInDays(currentTo, currentFrom) + 1;

    const prevTo = subDays(currentFrom, 1);
    const prevFrom = subDays(prevTo, durationDays - 1);
    return { fromUtc: prevFrom, toUtc: prevTo };
  } else if (filters.filterMode === "MULTIPLE_MONTHS") {
    const year = (filters.year || new Date().getFullYear()) - 1; // compare same months in previous year
    const months = filters.selectedMonths || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const minMonth = Math.min(...months);
    const maxMonth = Math.max(...months);

    const fromStr = `${year}-${String(minMonth).padStart(2, "0")}-01T00:00:00.000+05:30`;
    const lastDay = new Date(year, maxMonth, 0).getDate();
    const toStr = `${year}-${String(maxMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`;

    return { fromUtc: new Date(fromStr), toUtc: new Date(toStr) };
  }
  return null;
}

/**
 * Main analytics aggregator function
 */
export async function getCategoryAnalyticsData(
  filters: CategoryAnalyticsFilterParams
): Promise<CategoryAnalyticsResult> {
  const where = buildAnalyticsWhereClause(filters);

  // Fetch all matching items with relations
  const items = await prisma.expenseItem.findMany({
    where,
    include: {
      category: true,
      subcategory: true,
      report: {
        select: {
          id: true,
          status: true,
          submittedAt: true,
          approvedAt: true,
          reimbursedAt: true,
          totalAmount: true,
          userId: true,
        },
      },
    },
    orderBy: { expenseDate: "asc" },
  });

  // Calculate Primary Totals
  let totalExpense = 0;
  let totalReimbursed = 0;
  let approvedAwaitingReimbursement = 0;
  let totalGst = 0;
  let totalTaxableValue = 0;

  const categoryMap = new Map<string, {
    category: { id: string; code: string; name: string };
    items: typeof items;
    totalAmount: number;
    taxableValue: number;
    totalGst: number;
    maxAmount: number;
    subcategoryMap: Map<string, {
      subcategory: { id: string; code: string; name: string };
      items: typeof items;
      totalAmount: number;
      taxableValue: number;
      totalGst: number;
      maxAmount: number;
    }>;
  }>();

  const vendorMap = new Map<string, { totalAmount: number; itemCount: number; taxableValue: number; totalGst: number }>();
  const monthlyTrendMap = new Map<string, { monthKey: string; monthLabel: string; totalAmount: number; categoryBreakdown: Record<string, number> }>();

  for (const item of items) {
    const itemAmt = Number(item.totalAmount) || 0;
    const taxableAmt = Number(item.taxableValue) || 0;
    const gstAmt = Number(item.totalGstAmount) || 0;

    totalExpense += itemAmt;
    totalTaxableValue += taxableAmt;
    totalGst += gstAmt;

    if (item.report.status === ReportStatus.REIMBURSED) {
      totalReimbursed += itemAmt;
    } else if (item.report.status === ReportStatus.APPROVED) {
      approvedAwaitingReimbursement += itemAmt;
    }

    // 1. Group by Category
    if (!categoryMap.has(item.categoryId)) {
      categoryMap.set(item.categoryId, {
        category: item.category,
        items: [],
        totalAmount: 0,
        taxableValue: 0,
        totalGst: 0,
        maxAmount: 0,
        subcategoryMap: new Map(),
      });
    }
    const catEntry = categoryMap.get(item.categoryId)!;
    catEntry.items.push(item);
    catEntry.totalAmount += itemAmt;
    catEntry.taxableValue += taxableAmt;
    catEntry.totalGst += gstAmt;
    catEntry.maxAmount = Math.max(catEntry.maxAmount, itemAmt);

    // Subcategory within category
    if (!catEntry.subcategoryMap.has(item.subcategoryId)) {
      catEntry.subcategoryMap.set(item.subcategoryId, {
        subcategory: item.subcategory,
        items: [],
        totalAmount: 0,
        taxableValue: 0,
        totalGst: 0,
        maxAmount: 0,
      });
    }
    const subEntry = catEntry.subcategoryMap.get(item.subcategoryId)!;
    subEntry.items.push(item);
    subEntry.totalAmount += itemAmt;
    subEntry.taxableValue += taxableAmt;
    subEntry.totalGst += gstAmt;
    subEntry.maxAmount = Math.max(subEntry.maxAmount, itemAmt);

    // 2. Group by Vendor
    const vendorNorm = (item.vendorName || "Unknown").trim();
    if (!vendorMap.has(vendorNorm)) {
      vendorMap.set(vendorNorm, { totalAmount: 0, itemCount: 0, taxableValue: 0, totalGst: 0 });
    }
    const vEntry = vendorMap.get(vendorNorm)!;
    vEntry.totalAmount += itemAmt;
    vEntry.itemCount += 1;
    vEntry.taxableValue += taxableAmt;
    vEntry.totalGst += gstAmt;

    // 3. Monthly Trend (using Asia/Kolkata date format YYYY-MM)
    const monthKey = formatInTimeZone(new Date(item.expenseDate), TIMEZONE, "yyyy-MM");
    const monthLabel = formatInTimeZone(new Date(item.expenseDate), TIMEZONE, "MMM yyyy");

    if (!monthlyTrendMap.has(monthKey)) {
      monthlyTrendMap.set(monthKey, {
        monthKey,
        monthLabel,
        totalAmount: 0,
        categoryBreakdown: {},
      });
    }
    const mEntry = monthlyTrendMap.get(monthKey)!;
    mEntry.totalAmount += itemAmt;
    mEntry.categoryBreakdown[item.category.name] =
      (mEntry.categoryBreakdown[item.category.name] || 0) + itemAmt;
  }

  const itemCount = items.length;
  const averageExpenseAmount = itemCount > 0 ? totalExpense / itemCount : 0;

  // Build Categories & Subcategories lists
  const categorySummaries: CategorySummaryItem[] = [];
  const allSubcategorySummaries: SubcategorySummaryItem[] = [];

  categoryMap.forEach((c) => {
    const catPct = totalExpense > 0 ? (c.totalAmount / totalExpense) * 100 : 0;
    const subcategories: SubcategorySummaryItem[] = [];

    c.subcategoryMap.forEach((s) => {
      const subCatPct = c.totalAmount > 0 ? (s.totalAmount / c.totalAmount) * 100 : 0;
      const subTotalPct = totalExpense > 0 ? (s.totalAmount / totalExpense) * 100 : 0;

      const subSummary: SubcategorySummaryItem = {
        subcategoryId: s.subcategory.id,
        subcategoryCode: s.subcategory.code,
        subcategoryName: s.subcategory.name,
        categoryId: c.category.id,
        categoryName: c.category.name,
        itemCount: s.items.length,
        totalAmount: s.totalAmount,
        taxableValue: s.taxableValue,
        totalGst: s.totalGst,
        avgAmount: s.items.length > 0 ? s.totalAmount / s.items.length : 0,
        maxAmount: s.maxAmount,
        percentageOfCategory: Number(subCatPct.toFixed(2)),
        percentageOfTotal: Number(subTotalPct.toFixed(2)),
      };
      subcategories.push(subSummary);
      allSubcategorySummaries.push(subSummary);
    });

    subcategories.sort((a, b) => b.totalAmount - a.totalAmount);

    categorySummaries.push({
      categoryId: c.category.id,
      categoryCode: c.category.code,
      categoryName: c.category.name,
      itemCount: c.items.length,
      totalAmount: c.totalAmount,
      taxableValue: c.taxableValue,
      totalGst: c.totalGst,
      avgAmount: c.items.length > 0 ? c.totalAmount / c.items.length : 0,
      maxAmount: c.maxAmount,
      percentageOfTotal: Number(catPct.toFixed(2)),
      subcategories,
    });
  });

  categorySummaries.sort((a, b) => b.totalAmount - a.totalAmount);
  allSubcategorySummaries.sort((a, b) => b.totalAmount - a.totalAmount);

  // Top Vendors
  const topVendors: TopVendorItem[] = Array.from(vendorMap.entries())
    .map(([vendorName, data]) => ({
      vendorName,
      totalAmount: data.totalAmount,
      itemCount: data.itemCount,
      taxableValue: data.taxableValue,
      totalGst: data.totalGst,
      percentageOfTotal: totalExpense > 0 ? Number(((data.totalAmount / totalExpense) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 15);

  // Monthly Trend sorted by monthKey ascending
  const monthlyTrend: MonthlyTrendItem[] = Array.from(monthlyTrendMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  const highestExpenseCategory =
    categorySummaries.length > 0
      ? { name: categorySummaries[0].categoryName, amount: categorySummaries[0].totalAmount }
      : null;

  const highestExpenseVendor =
    topVendors.length > 0
      ? { name: topVendors[0].vendorName, amount: topVendors[0].totalAmount }
      : null;

  // Previous Period Comparison (if requested)
  let previousPeriodKpi: KpiSummary["previousPeriod"] | undefined;
  if (filters.compareWithPreviousPeriod) {
    const prevBounds = calculatePreviousPeriodBounds(filters);
    if (prevBounds) {
      const prevWhere = buildAnalyticsWhereClause(filters, prevBounds);
      const prevItems = await prisma.expenseItem.findMany({
        where: prevWhere,
        include: { report: { select: { status: true } } },
      });

      let prevTotalExpense = 0;
      let prevTotalReimbursed = 0;
      let prevTotalGst = 0;

      for (const pItem of prevItems) {
        const amt = Number(pItem.totalAmount) || 0;
        prevTotalExpense += amt;
        prevTotalGst += Number(pItem.totalGstAmount) || 0;
        if (pItem.report.status === ReportStatus.REIMBURSED) {
          prevTotalReimbursed += amt;
        }
      }

      const prevCount = prevItems.length;
      const prevAvg = prevCount > 0 ? prevTotalExpense / prevCount : 0;

      const expenseDeltaPct =
        prevTotalExpense > 0
          ? Number((((totalExpense - prevTotalExpense) / prevTotalExpense) * 100).toFixed(1))
          : null;

      const reimbursedDeltaPct =
        prevTotalReimbursed > 0
          ? Number((((totalReimbursed - prevTotalReimbursed) / prevTotalReimbursed) * 100).toFixed(1))
          : null;

      previousPeriodKpi = {
        totalExpense: prevTotalExpense,
        totalReimbursed: prevTotalReimbursed,
        totalGst: prevTotalGst,
        itemCount: prevCount,
        averageExpenseAmount: prevAvg,
        expenseDeltaPct,
        reimbursedDeltaPct,
      };
    }
  }

  return {
    kpis: {
      totalExpense,
      totalReimbursed,
      approvedAwaitingReimbursement,
      totalGst,
      totalTaxableValue,
      itemCount,
      averageExpenseAmount,
      highestExpenseCategory,
      highestExpenseVendor,
      previousPeriod: previousPeriodKpi,
    },
    categories: categorySummaries,
    subcategories: allSubcategorySummaries,
    monthlyTrend,
    topVendors,
    activeFilters: filters,
  };
}
