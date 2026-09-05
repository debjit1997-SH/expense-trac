import prisma from "@/lib/db";
import {
  ReportStatus,
  Role,
  TaxMode,
  ItcEligibility,
  VendorGstStatus,
  WorkflowStage,
  AssignmentStatus,
  RecipientType,
  AdvanceStatus,
  Prisma,
} from "@prisma/client";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { startOfMonth, endOfMonth } from "date-fns";
import { getNormalizedAdvanceSummary } from "@/lib/advance-summary";

export const TIMEZONE = "Asia/Kolkata";

export type DateBasisType = "EXPENSE_DATE" | "SUBMITTED_DATE" | "APPROVED_DATE" | "REIMBURSED_DATE";
export type FilterModeType = "DATE_RANGE" | "MULTIPLE_MONTHS";

export interface DetailedReportFilterParams {
  filterMode?: FilterModeType;
  dateBasis?: DateBasisType;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  year?: number; // e.g. 2026
  selectedMonths?: number[]; // 1 to 12 (1 = Jan, 12 = Dec)
  reportNumber?: string;
  tagTitle?: string;
  status?: ReportStatus;
  vendorName?: string;
  submittedById?: string;
  primaryApproverId?: string;
  reimbursementOwnerId?: string;
  categoryId?: string;
  subcategoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  gstTreatmentId?: string;
  gstRateId?: string;
  itcEligibility?: ItcEligibility;
  reverseCharge?: boolean;
  hasEvidence?: boolean;
  globalSearch?: string;
  advanceLinked?: boolean;
  advanceRequestNumber?: string;
  advanceStatus?: AdvanceStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface DetailedExpenseReportRow {
  // Report identifiers
  reportId: string;
  reportNumber: string;
  tagTitle: string;
  tagDescription?: string | null;
  tagStatus: ReportStatus;
  tagTotal: number;
  itemIndex: number;
  itemCount: number;

  // Advance linkage
  advanceRequestNumber?: string | null;
  advanceStatus?: AdvanceStatus | null;
  advanceAdjustedAmount: number;
  netPayableAmount: number;

  // Expense item fields
  itemId: string;
  expenseDate: string;
  rawExpenseDate: Date;
  vendorName: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  itemDescription: string;
  categoryName: string;
  categoryCode: string;
  subcategoryName: string;
  subcategoryCode: string;
  documentType?: string | null;
  itemAmount: number;
  currency: string;
  evidenceCount: number;

  // GST fields
  gstTreatmentName?: string | null;
  vendorGstStatus?: VendorGstStatus | null;
  vendorGstin?: string | null;
  companyGstin?: string | null;
  placeOfSupply?: string | null;
  hsnSacCode?: string | null;
  taxMode?: TaxMode | null;
  taxableValue: number;
  gstRateLabel?: string | null;
  cgstRate?: number | null;
  cgstAmount: number;
  sgstRate?: number | null;
  sgstAmount: number;
  igstRate?: number | null;
  igstAmount: number;
  cessAmount: number;
  totalGstAmount: number;
  reverseCharge: boolean;
  itcEligibility: ItcEligibility;
  gstRemarks?: string | null;

  // Workflow & Audit fields
  submittedBy: string;
  submitterEmail: string;
  submitterRole: Role;
  createdAt: string;
  submittedAt?: string | null;
  primaryApprover?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  reimbursementOwner?: string | null;
  reimbursedBy?: string | null;
  reimbursedAt?: string | null;
  paymentMethod?: string | null;
  reimbursementRef?: string | null;
  transactionId?: string | null;
  lastUpdatedAt: string;
}

export interface DetailedReportSummaryTotals {
  itemCount: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  totalGst: number;
  grandTotal: number;
  totalAdvanceAdjusted: number;
  totalNetReimbursement: number;
}

/**
 * Builds the Prisma where clause for ExpenseItem based on comprehensive filters
 */
export function buildExpenseItemWhereClause(
  filters: DetailedReportFilterParams
): Prisma.ExpenseItemWhereInput {
  const where: Prisma.ExpenseItemWhereInput = {};
  const andConditions: Prisma.ExpenseItemWhereInput[] = [];

  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const filterMode = filters.filterMode || "DATE_RANGE";

  // 1. Date Filtering (Asia/Kolkata boundary converted to UTC)
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
        // monthNum is 1-12
        const monthPad = String(monthNum).padStart(2, "0");
        const startStr = `${year}-${monthPad}-01T00:00:00.000+05:30`;
        const startUtc = new Date(startStr);
        // Calculate last day of the month in IST
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

  // 2. Report Status
  if (filters.status) {
    andConditions.push({ report: { status: filters.status } });
  }

  // 3. Report Number
  if (filters.reportNumber?.trim()) {
    andConditions.push({
      report: { reportNumber: { contains: filters.reportNumber.trim(), mode: "insensitive" } },
    });
  }

  // 4. Tag Title
  if (filters.tagTitle?.trim()) {
    andConditions.push({
      report: { title: { contains: filters.tagTitle.trim(), mode: "insensitive" } },
    });
  }

  // 5. Vendor
  if (filters.vendorName?.trim()) {
    andConditions.push({
      vendorName: { contains: filters.vendorName.trim(), mode: "insensitive" },
    });
  }

  // 6. Submitter
  if (filters.submittedById) {
    andConditions.push({ report: { userId: filters.submittedById } });
  }

  // 7. Category & Subcategory
  if (filters.categoryId) {
    andConditions.push({ categoryId: filters.categoryId });
  }
  if (filters.subcategoryId) {
    andConditions.push({ subcategoryId: filters.subcategoryId });
  }

  // 8. GST Treatment & Rate
  if (filters.gstTreatmentId) {
    andConditions.push({ gstTreatmentId: filters.gstTreatmentId });
  }
  if (filters.gstRateId) {
    andConditions.push({ gstRateId: filters.gstRateId });
  }

  // 9. ITC & Reverse Charge
  if (filters.itcEligibility) {
    andConditions.push({ itcEligibility: filters.itcEligibility });
  }
  if (filters.reverseCharge !== undefined) {
    andConditions.push({ reverseCharge: filters.reverseCharge });
  }

  // 10. Amount Range
  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    const amountFilter: Prisma.DecimalFilter = {};
    if (filters.minAmount !== undefined) amountFilter.gte = new Prisma.Decimal(filters.minAmount);
    if (filters.maxAmount !== undefined) amountFilter.lte = new Prisma.Decimal(filters.maxAmount);
    andConditions.push({ totalAmount: amountFilter });
  }

  // 11. Evidence Attached
  if (filters.hasEvidence === true) {
    andConditions.push({ evidences: { some: {} } });
  } else if (filters.hasEvidence === false) {
    andConditions.push({ evidences: { none: {} } });
  }

  // 12. Primary Approver Filter
  if (filters.primaryApproverId) {
    andConditions.push({
      report: {
        approvalAssignments: {
          some: {
            stage: WorkflowStage.ADMIN_APPROVAL,
            assigneeUserId: filters.primaryApproverId,
            status: { not: AssignmentStatus.CANCELLED },
          },
        },
      },
    });
  }

  // 13. Reimbursement Owner Filter
  if (filters.reimbursementOwnerId) {
    andConditions.push({
      report: {
        approvalAssignments: {
          some: {
            stage: WorkflowStage.REIMBURSEMENT,
            assigneeUserId: filters.reimbursementOwnerId,
            status: { not: AssignmentStatus.CANCELLED },
          },
        },
      },
    });
  }

  // 14. Global Search
  if (filters.globalSearch?.trim()) {
    const q = filters.globalSearch.trim();
    andConditions.push({
      OR: [
        { vendorName: { contains: q, mode: "insensitive" } },
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { vendorGstin: { contains: q, mode: "insensitive" } },
        { hsnSacCode: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
        { subcategory: { name: { contains: q, mode: "insensitive" } } },
        { report: { reportNumber: { contains: q, mode: "insensitive" } } },
        { report: { title: { contains: q, mode: "insensitive" } } },
        { report: { user: { name: { contains: q, mode: "insensitive" } } } },
        { report: { user: { email: { contains: q, mode: "insensitive" } } } },
        { report: { advanceAllocation: { advanceRequest: { advanceNumber: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }

  // 15. Advance Linked Filter
  if (filters.advanceLinked === true) {
    andConditions.push({ report: { advanceAllocation: { isNot: null } } });
  } else if (filters.advanceLinked === false) {
    andConditions.push({ report: { advanceAllocation: null } });
  }

  // 16. Advance Request Number
  if (filters.advanceRequestNumber?.trim()) {
    andConditions.push({
      report: {
        advanceAllocation: {
          advanceRequest: {
            advanceNumber: { contains: filters.advanceRequestNumber.trim(), mode: "insensitive" },
          },
        },
      },
    });
  }

  // 17. Advance Status
  if (filters.advanceStatus) {
    andConditions.push({
      report: {
        advanceAllocation: {
          advanceRequest: {
            status: filters.advanceStatus,
          },
        },
      },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

/**
 * Fetch paginated detailed expense report data with aggregated summary totals
 */
export async function getDetailedExpenseReportData(
  filters: DetailedReportFilterParams,
  pagination = true
): Promise<{
  rows: DetailedExpenseReportRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  summaryTotals: DetailedReportSummaryTotals;
}> {
  const where = buildExpenseItemWhereClause(filters);

  const page = Math.max(1, filters.page || 1);
  const pageSize = pagination ? Math.max(1, Math.min(100, filters.pageSize || 25)) : 100000;
  const skip = (page - 1) * pageSize;

  // Sorting setup
  const sortBy = filters.sortBy || "expenseDate";
  const sortOrder = filters.sortOrder || "desc";

  let orderBy: Prisma.ExpenseItemOrderByWithRelationInput = { expenseDate: sortOrder };
  if (sortBy === "totalAmount") {
    orderBy = { totalAmount: sortOrder };
  } else if (sortBy === "vendorName") {
    orderBy = { vendorName: sortOrder };
  } else if (sortBy === "category") {
    orderBy = { category: { name: sortOrder } };
  } else if (sortBy === "reportNumber") {
    orderBy = { report: { reportNumber: sortOrder } };
  } else if (sortBy === "createdAt") {
    orderBy = { createdAt: sortOrder };
  }

  // Execute query and total count in parallel
  const [totalCount, rawItems, summaryAggregate] = await Promise.all([
    prisma.expenseItem.count({ where }),
    prisma.expenseItem.findMany({
      where,
      include: {
        category: true,
        subcategory: true,
        gstTreatment: true,
        gstRate: true,
        evidences: {
          select: { id: true, originalName: true, fileSize: true },
        },
        report: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
            reimbursedBy: { select: { id: true, name: true, email: true } },
            advanceAllocation: {
              include: {
                advanceRequest: {
                  select: {
                    id: true,
                    advanceNumber: true,
                    status: true,
                    requestedAmount: true,
                    approvedAmount: true,
                    disbursedAmount: true,
                    adjustedAmount: true,
                    returnedAmount: true,
                    reservedAmount: true,
                  },
                },
              },
            },
            approvalAssignments: {
              where: { status: { not: AssignmentStatus.CANCELLED } },
              include: { assignee: { select: { id: true, name: true, email: true } } },
            },
            _count: { select: { items: true } },
          },
        },
      },
      orderBy,
      skip: pagination ? skip : 0,
      take: pageSize,
    }),
    prisma.expenseItem.aggregate({
      where,
      _sum: {
        taxableValue: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        cessAmount: true,
        totalGstAmount: true,
        totalAmount: true,
      },
    }),
  ]);

  // Transform into flattened rows
  const rows: DetailedExpenseReportRow[] = rawItems.map((item, idx) => {
    const adminAssignment = item.report.approvalAssignments.find(
      (a) => a.stage === WorkflowStage.ADMIN_APPROVAL
    );
    const reimbursementAssignment = item.report.approvalAssignments.find(
      (a) => a.stage === WorkflowStage.REIMBURSEMENT
    );

    const taxableValue = Number(item.taxableValue) || 0;
    const cgstAmount = Number(item.cgstAmount) || 0;
    const sgstAmount = Number(item.sgstAmount) || 0;
    const igstAmount = Number(item.igstAmount) || 0;
    const cessAmount = Number(item.cessAmount) || 0;
    const totalGstAmount = Number(item.totalGstAmount) || 0;
    const itemAmount = Number(item.totalAmount) || 0;

    const advanceSummary = getNormalizedAdvanceSummary(item.report as any);

    return {
      reportId: item.report.id,
      reportNumber: item.report.reportNumber,
      tagTitle: item.report.title,
      tagDescription: item.report.description,
      tagStatus: item.report.status,
      tagTotal: Number(item.report.totalAmount) || 0,
      itemIndex: skip + idx + 1,
      itemCount: item.report._count.items,

      advanceRequestNumber: advanceSummary.advanceNumber,
      advanceStatus: advanceSummary.advanceStatus,
      advanceAdjustedAmount: advanceSummary.allocatedAmount,
      netPayableAmount: advanceSummary.expectedNetReimbursement,

      itemId: item.id,
      expenseDate: formatInTimeZone(new Date(item.expenseDate), TIMEZONE, "dd-MMM-yyyy"),
      rawExpenseDate: item.expenseDate,
      vendorName: item.vendorName,
      invoiceNumber: item.invoiceNumber,
      invoiceDate: item.invoiceDate
        ? formatInTimeZone(new Date(item.invoiceDate), TIMEZONE, "dd-MMM-yyyy")
        : null,
      itemDescription: item.description,
      categoryName: item.category.name,
      categoryCode: item.category.code,
      subcategoryName: item.subcategory.name,
      subcategoryCode: item.subcategory.code,
      documentType: item.documentType,
      itemAmount,
      currency: item.currency,
      evidenceCount: item.evidences.length,

      gstTreatmentName: item.gstTreatment?.name,
      vendorGstStatus: item.vendorGstStatus,
      vendorGstin: item.vendorGstin,
      companyGstin: item.companyGstin,
      placeOfSupply: item.placeOfSupply,
      hsnSacCode: item.hsnSacCode,
      taxMode: item.taxMode,
      taxableValue,
      gstRateLabel: item.gstRate?.label,
      cgstRate: item.cgstRate ? Number(item.cgstRate) : null,
      cgstAmount,
      sgstRate: item.sgstRate ? Number(item.sgstRate) : null,
      sgstAmount,
      igstRate: item.igstRate ? Number(item.igstRate) : null,
      igstAmount,
      cessAmount,
      totalGstAmount,
      reverseCharge: item.reverseCharge,
      itcEligibility: item.itcEligibility,
      gstRemarks: item.gstRemarks,

      submittedBy: item.report.user.name,
      submitterEmail: item.report.user.email,
      submitterRole: item.report.user.role,
      createdAt: formatInTimeZone(new Date(item.report.createdAt), TIMEZONE, "dd-MMM-yyyy HH:mm"),
      submittedAt: item.report.submittedAt
        ? formatInTimeZone(new Date(item.report.submittedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      primaryApprover: adminAssignment?.assignee.name || null,
      approvedBy: item.report.approvedBy?.name || null,
      approvedAt: item.report.approvedAt
        ? formatInTimeZone(new Date(item.report.approvedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      reimbursementOwner: reimbursementAssignment?.assignee.name || null,
      reimbursedBy: item.report.reimbursedBy?.name || null,
      reimbursedAt: item.report.reimbursedAt
        ? formatInTimeZone(new Date(item.report.reimbursedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      paymentMethod: item.report.paymentMethod,
      reimbursementRef: item.report.reimbursementRef,
      transactionId: item.report.transactionId,
      lastUpdatedAt: formatInTimeZone(new Date(item.updatedAt), TIMEZONE, "dd-MMM-yyyy HH:mm"),
    };
  });

  const uniqueReportsMap = new Map<string, { advanceAdjusted: number; netPayable: number }>();
  for (const item of rawItems) {
    if (!uniqueReportsMap.has(item.report.id)) {
      const summary = getNormalizedAdvanceSummary(item.report as any);
      uniqueReportsMap.set(item.report.id, {
        advanceAdjusted: summary.allocatedAmount,
        netPayable: summary.expectedNetReimbursement,
      });
    }
  }

  let totalAdvanceAdjusted = 0;
  let totalNetReimbursement = 0;
  Array.from(uniqueReportsMap.values()).forEach((rep) => {
    totalAdvanceAdjusted += rep.advanceAdjusted;
    totalNetReimbursement += rep.netPayable;
  });

  const summaryTotals: DetailedReportSummaryTotals = {
    itemCount: totalCount,
    totalTaxableValue: Number(summaryAggregate._sum.taxableValue) || 0,
    totalCgst: Number(summaryAggregate._sum.cgstAmount) || 0,
    totalSgst: Number(summaryAggregate._sum.sgstAmount) || 0,
    totalIgst: Number(summaryAggregate._sum.igstAmount) || 0,
    totalCess: Number(summaryAggregate._sum.cessAmount) || 0,
    totalGst: Number(summaryAggregate._sum.totalGstAmount) || 0,
    grandTotal: Number(summaryAggregate._sum.totalAmount) || 0,
    totalAdvanceAdjusted,
    totalNetReimbursement,
  };

  return {
    rows,
    totalCount,
    page,
    pageSize,
    summaryTotals,
  };
}
