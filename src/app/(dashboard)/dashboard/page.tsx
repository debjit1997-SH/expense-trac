import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import { Role, ReportStatus, AccountStatus } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  FileText,
  Send,
  CheckCircle2,
  Banknote,
  Users,
  AlertCircle,
  PlusCircle,
  Undo2,
  ArrowRight,
  TrendingUp,
  Clock,
  Wallet,
  HandCoins,
  FileCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isUser = user.role === Role.USER;
  const isAdmin = user.role === Role.ADMIN;
  const isSuperAdmin = user.role === Role.SUPERADMIN;

  // 1. Fetch relevant counts based on role
  let userDraftsCount = 0;
  let userSubmittedCount = 0;
  let userApprovedCount = 0;
  let userReimbursedCount = 0;

  let pendingAccessRequestsCount = 0;
  let submittedReportsToReviewCount = 0;
  let allApprovedReportsCount = 0;
  let allReimbursedReportsCount = 0;

  let userActiveAdvancesCount = 0;
  let pendingAdvanceApprovalsCount = 0;
  let pendingAdvanceDisbursementsCount = 0;

  if (isUser) {
    [userDraftsCount, userSubmittedCount, userApprovedCount, userReimbursedCount, userActiveAdvancesCount] =
      await Promise.all([
        prisma.expenseReport.count({ where: { userId: user.id, status: ReportStatus.DRAFT } }),
        prisma.expenseReport.count({ where: { userId: user.id, status: ReportStatus.SUBMITTED } }),
        prisma.expenseReport.count({ where: { userId: user.id, status: ReportStatus.APPROVED } }),
        prisma.expenseReport.count({ where: { userId: user.id, status: ReportStatus.REIMBURSED } }),
        prisma.advanceRequest.count({
          where: { userId: user.id, status: { in: ["DISBURSED", "PARTIALLY_SETTLED"] } },
        }),
      ]);
  } else if (isAdmin) {
    [
      pendingAccessRequestsCount,
      submittedReportsToReviewCount,
      allApprovedReportsCount,
      userDraftsCount,
      pendingAdvanceApprovalsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { status: AccountStatus.PENDING } }),
      prisma.expenseReport.count({ where: { status: ReportStatus.SUBMITTED } }),
      prisma.expenseReport.count({ where: { status: ReportStatus.APPROVED } }),
      prisma.expenseReport.count({ where: { userId: user.id, status: ReportStatus.DRAFT } }),
      prisma.advanceApprovalAssignment.count({
        where: { assigneeUserId: user.id, status: "PENDING" },
      }),
    ]);
  } else if (isSuperAdmin) {
    [
      pendingAccessRequestsCount,
      submittedReportsToReviewCount,
      allApprovedReportsCount,
      allReimbursedReportsCount,
      pendingAdvanceApprovalsCount,
      pendingAdvanceDisbursementsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { status: AccountStatus.PENDING } }),
      prisma.expenseReport.count({ where: { status: ReportStatus.SUBMITTED } }),
      prisma.expenseReport.count({ where: { status: ReportStatus.APPROVED } }),
      prisma.expenseReport.count({ where: { status: ReportStatus.REIMBURSED } }),
      prisma.advanceApprovalAssignment.count({ where: { status: "PENDING" } }),
      prisma.advanceRequest.count({ where: { status: "APPROVED" } }),
    ]);
  }

  // 2. Fetch Recent Reports
  const recentReports = await prisma.expenseReport.findMany({
    where: isUser
      ? { userId: user.id }
      : {
          OR: [
            { userId: user.id },
            { status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED, ReportStatus.REIMBURSED] } },
          ],
        },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-md">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">
            Welcome back, {user.name}
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            Role: <span className="font-semibold text-blue-300">{user.role}</span> &bull; Status:{" "}
            <span className="text-emerald-400 font-semibold">{user.status}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/advances/create">
            <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold">
              <HandCoins className="w-4 h-4 mr-1.5" />
              Request Advance
            </Button>
          </Link>
          <Link href="/expenses/create">
            <Button variant="primary" className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create Expense
            </Button>
          </Link>
          <Link href="/expenses">
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs font-semibold">
              View Expenses
            </Button>
          </Link>
        </div>
      </div>

      {/* Role-Specific Metric Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          Overview &amp; Workflow Status
        </h3>

        {/* USER CARDS */}
        {isUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/expenses?status=DRAFT" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY DRAFT REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{userDraftsCount}</p>
                    <span className="text-[11px] text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Edit &amp; Submit <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                    <FileText className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=SUBMITTED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY SUBMITTED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-blue-700 mt-1">{userSubmittedCount}</p>
                    <span className="text-[11px] text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Awaiting Review <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Send className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=APPROVED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY APPROVED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">{userApprovedCount}</p>
                    <span className="text-[11px] text-emerald-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Ready for Payout <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=REIMBURSED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY REIMBURSED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-purple-700 mt-1">{userReimbursedCount}</p>
                    <span className="text-[11px] text-purple-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Completed <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                    <Banknote className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/advances" className="block group">
              <Card className="hover:border-emerald-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY ADVANCES
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">{userActiveAdvancesCount}</p>
                    <span className="text-[11px] text-emerald-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Active Advances <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <Wallet className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* ADMIN CARDS */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link href="/user-management?tab=requests" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      ACCESS REQUESTS
                    </p>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingAccessRequestsCount}</p>
                    <span className="text-[11px] text-amber-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Review <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Users className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=SUBMITTED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      EXPENSE TO REVIEW
                    </p>
                    <p className="text-2xl font-extrabold text-blue-700 mt-1">{submittedReportsToReviewCount}</p>
                    <span className="text-[11px] text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Approve <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Send className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/advances/approvals" className="block group">
              <Card className="hover:border-amber-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      ADVANCE APPROVALS
                    </p>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingAdvanceApprovalsCount}</p>
                    <span className="text-[11px] text-amber-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Review <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <FileCheck className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=APPROVED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      APPROVED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">{allApprovedReportsCount}</p>
                    <span className="text-[11px] text-emerald-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Status <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=DRAFT" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      MY DRAFT REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{userDraftsCount}</p>
                    <span className="text-[11px] text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Drafts <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                    <FileText className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}

        {/* SUPERADMIN CARDS */}
        {isSuperAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link href="/user-management?tab=requests" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      ACCESS REQUESTS
                    </p>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingAccessRequestsCount}</p>
                    <span className="text-[11px] text-amber-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Manage <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Users className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/reimbursement-inbox" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      REIMBURSEMENT PAYOUTS
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">{allApprovedReportsCount}</p>
                    <span className="text-[11px] text-emerald-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Payout Inbox <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <Banknote className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/advances/disbursements" className="block group">
              <Card className="hover:border-purple-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      ADVANCE DISBURSEMENTS
                    </p>
                    <p className="text-2xl font-extrabold text-purple-700 mt-1">{pendingAdvanceDisbursementsCount}</p>
                    <span className="text-[11px] text-purple-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Disburse Funds <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                    <Wallet className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=SUBMITTED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      SUBMITTED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-blue-700 mt-1">{submittedReportsToReviewCount}</p>
                    <span className="text-[11px] text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      Review <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Send className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/expenses?status=REIMBURSED" className="block group">
              <Card className="hover:border-blue-300 hover:shadow-md transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      REIMBURSED REPORTS
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{allReimbursedReportsCount}</p>
                    <span className="text-[11px] text-purple-600 font-medium group-hover:underline inline-flex items-center gap-0.5 mt-1">
                      History <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>

      {/* Recent Activity Table */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/60 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800">
            Recent Expense Reports
          </CardTitle>
          <Link href="/expenses" className="text-xs font-semibold text-blue-600 hover:underline">
            View All Reports &rarr;
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentReports.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No recent expense activity found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Tag Title</th>
                    {!isUser && <th className="py-3 px-4">Created By</th>}
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {report.reportNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 uppercase">
                        {report.title}
                      </td>
                      {!isUser && (
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {report.user.name}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {report._count.items}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrencyINR(report.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <DateDisplay date={report.updatedAt} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link href={`/expenses/${report.id}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                            Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
