import prisma from "@/lib/db";
import { AdvanceStatus, Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { calculateAdvanceBalances } from "../advance-rules";

export const TIMEZONE = "Asia/Kolkata";

export interface AdvanceRegisterFilterParams {
  requesterId?: string;
  status?: AdvanceStatus;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AdvanceRegisterRow {
  id: string;
  advanceNumber: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterRole: string;
  purpose: string;
  requestedAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number;
  adjustedAmount: number;
  returnedAmount: number;
  reservedAmount: number;
  availableBalance: number;
  outstandingBalance: number;
  status: AdvanceStatus;
  requiredByDate?: string | null;
  expectedSettlementDate?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  disbursedBy?: string | null;
  disbursedAt?: string | null;
  paymentMode?: string | null;
  paymentReference?: string | null;
  finalSettledAt?: string | null;
  createdAt: string;
  linkedReportsCount: number;
  transactionsCount: number;
}

export interface AdvanceRegisterSummaryTotals {
  totalAdvancesCount: number;
  totalRequested: number;
  totalApproved: number;
  totalDisbursed: number;
  totalAdjusted: number;
  totalReturned: number;
  totalReserved: number;
  totalOutstanding: number;
  totalAvailable: number;
  pendingApprovalCount: number;
  pendingDisbursementCount: number;
  activeDisbursedCount: number;
  settledCount: number;
}

export async function getAdvanceRegisterData(
  filters: AdvanceRegisterFilterParams,
  pagination = true
): Promise<{
  rows: AdvanceRegisterRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  summaryTotals: AdvanceRegisterSummaryTotals;
}> {
  const where: Prisma.AdvanceRequestWhereInput = {};
  const andConditions: Prisma.AdvanceRequestWhereInput[] = [];

  if (filters.requesterId) {
    andConditions.push({ userId: filters.requesterId });
  }

  if (filters.status) {
    andConditions.push({ status: filters.status });
  }

  if (filters.fromDate || filters.toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.fromDate) dateFilter.gte = new Date(`${filters.fromDate}T00:00:00.000+05:30`);
    if (filters.toDate) dateFilter.lte = new Date(`${filters.toDate}T23:59:59.999+05:30`);
    andConditions.push({ createdAt: dateFilter });
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    const amountFilter: Prisma.DecimalFilter = {};
    if (filters.minAmount !== undefined) amountFilter.gte = new Prisma.Decimal(filters.minAmount);
    if (filters.maxAmount !== undefined) amountFilter.lte = new Prisma.Decimal(filters.maxAmount);
    andConditions.push({ requestedAmount: amountFilter });
  }

  if (filters.search && filters.search.trim() !== "") {
    const s = filters.search.trim();
    andConditions.push({
      OR: [
        { advanceNumber: { contains: s, mode: "insensitive" } },
        { purpose: { contains: s, mode: "insensitive" } },
        { user: { name: { contains: s, mode: "insensitive" } } },
        { user: { email: { contains: s, mode: "insensitive" } } },
        { paymentReference: { contains: s, mode: "insensitive" } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const page = Math.max(1, filters.page || 1);
  const pageSize = pagination ? Math.max(1, Math.min(100, filters.pageSize || 25)) : 100000;
  const skip = (page - 1) * pageSize;

  const [totalCount, rawAdvances, allAdvancesForTotals] = await Promise.all([
    prisma.advanceRequest.count({ where }),
    prisma.advanceRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        disbursedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { allocations: true, transactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination ? skip : 0,
      take: pageSize,
    }),
    prisma.advanceRequest.findMany({
      where,
      select: {
        requestedAmount: true,
        approvedAmount: true,
        disbursedAmount: true,
        adjustedAmount: true,
        returnedAmount: true,
        reservedAmount: true,
        status: true,
      },
    }),
  ]);

  const rows: AdvanceRegisterRow[] = rawAdvances.map((adv) => {
    const balances = calculateAdvanceBalances({
      currentStatus: adv.status,
      disbursedAmount: adv.disbursedAmount,
      adjustedAmount: adv.adjustedAmount,
      returnedAmount: adv.returnedAmount,
      reservedAmount: adv.reservedAmount,
    });

    return {
      id: adv.id,
      advanceNumber: adv.advanceNumber,
      requesterId: adv.user.id,
      requesterName: adv.user.name,
      requesterEmail: adv.user.email,
      requesterRole: adv.user.role,
      purpose: adv.purpose,
      requestedAmount: Number(adv.requestedAmount),
      approvedAmount: adv.approvedAmount ? Number(adv.approvedAmount) : null,
      disbursedAmount: Number(adv.disbursedAmount),
      adjustedAmount: Number(adv.adjustedAmount),
      returnedAmount: Number(adv.returnedAmount),
      reservedAmount: Number(adv.reservedAmount),
      availableBalance: Number(balances.availableBalance),
      outstandingBalance: Number(balances.outstandingBalance),
      status: adv.status,
      requiredByDate: adv.requiredByDate
        ? formatInTimeZone(new Date(adv.requiredByDate), TIMEZONE, "dd-MMM-yyyy")
        : null,
      expectedSettlementDate: adv.expectedSettlementDate
        ? formatInTimeZone(new Date(adv.expectedSettlementDate), TIMEZONE, "dd-MMM-yyyy")
        : null,
      submittedAt: adv.submittedAt
        ? formatInTimeZone(new Date(adv.submittedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      approvedBy: adv.approvedBy?.name || null,
      approvedAt: adv.approvedAt
        ? formatInTimeZone(new Date(adv.approvedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      disbursedBy: adv.disbursedBy?.name || null,
      disbursedAt: adv.disbursedAt
        ? formatInTimeZone(new Date(adv.disbursedAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      paymentMode: adv.paymentMode,
      paymentReference: adv.paymentReference,
      finalSettledAt: adv.finalSettledAt
        ? formatInTimeZone(new Date(adv.finalSettledAt), TIMEZONE, "dd-MMM-yyyy HH:mm")
        : null,
      createdAt: formatInTimeZone(new Date(adv.createdAt), TIMEZONE, "dd-MMM-yyyy HH:mm"),
      linkedReportsCount: adv._count.allocations,
      transactionsCount: adv._count.transactions,
    };
  });

  // Calculate overall summary totals
  let totalRequested = 0;
  let totalApproved = 0;
  let totalDisbursed = 0;
  let totalAdjusted = 0;
  let totalReturned = 0;
  let totalReserved = 0;
  let totalOutstanding = 0;
  let totalAvailable = 0;
  let pendingApprovalCount = 0;
  let pendingDisbursementCount = 0;
  let activeDisbursedCount = 0;
  let settledCount = 0;

  for (const item of allAdvancesForTotals) {
    totalRequested += Number(item.requestedAmount) || 0;
    totalApproved += Number(item.approvedAmount) || 0;
    totalDisbursed += Number(item.disbursedAmount) || 0;
    totalAdjusted += Number(item.adjustedAmount) || 0;
    totalReturned += Number(item.returnedAmount) || 0;
    totalReserved += Number(item.reservedAmount) || 0;

    const b = calculateAdvanceBalances({
      currentStatus: item.status,
      disbursedAmount: item.disbursedAmount,
      adjustedAmount: item.adjustedAmount,
      returnedAmount: item.returnedAmount,
      reservedAmount: item.reservedAmount,
    });
    totalOutstanding += Number(b.outstandingBalance);
    totalAvailable += Number(b.availableBalance);

    if (item.status === AdvanceStatus.SUBMITTED) pendingApprovalCount++;
    if (item.status === AdvanceStatus.APPROVED) pendingDisbursementCount++;
    if (item.status === AdvanceStatus.DISBURSED || item.status === AdvanceStatus.PARTIALLY_SETTLED) activeDisbursedCount++;
    if (item.status === AdvanceStatus.SETTLED) settledCount++;
  }

  const summaryTotals: AdvanceRegisterSummaryTotals = {
    totalAdvancesCount: totalCount,
    totalRequested,
    totalApproved,
    totalDisbursed,
    totalAdjusted,
    totalReturned,
    totalReserved,
    totalOutstanding,
    totalAvailable,
    pendingApprovalCount,
    pendingDisbursementCount,
    activeDisbursedCount,
    settledCount,
  };

  return {
    rows,
    totalCount,
    page,
    pageSize,
    summaryTotals,
  };
}
