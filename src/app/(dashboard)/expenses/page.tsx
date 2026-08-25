import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-utils";
import { getExpensesListAction } from "@/actions/expense.actions";
import { ReportStatus, Role } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { PlusCircle, Search, Filter, Layers, FileText } from "lucide-react";

interface ExpensesPageProps {
  searchParams: {
    search?: string;
    status?: ReportStatus;
    from?: string;
    to?: string;
  };
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isUser = user.role === Role.USER;

  const reports = await getExpensesListAction({
    search: searchParams.search,
    status: searchParams.status,
    fromDate: searchParams.from,
    toDate: searchParams.to,
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Expense Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isUser
              ? "View and manage all your draft and submitted expense reimbursement tags"
              : "Review, track, and process employee expense reimbursement tags"}
          </p>
        </div>

        <Link href="/expenses/create">
          <Button variant="primary" className="text-xs font-semibold">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Create Expense Tag
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <form method="GET" className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                name="search"
                defaultValue={searchParams.search || ""}
                placeholder="Search by Report Number, Tag Title, or Employee..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full md:w-48">
              <select
                name="status"
                defaultValue={searchParams.status || ""}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REIMBURSED">REIMBURSED</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button type="submit" variant="secondary" size="sm" className="text-xs">
                <Filter className="w-3.5 h-3.5 mr-1" />
                Apply Filter
              </Button>
              {(searchParams.search || searchParams.status) && (
                <Link href="/expenses">
                  <Button type="button" variant="ghost" size="sm" className="text-xs">
                    Clear
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Matching Reports ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No expense reports found</p>
              <p className="text-xs text-slate-500">
                {searchParams.search || searchParams.status
                  ? "Try clearing filters to view other reports."
                  : "Click 'Create Expense Tag' above to start your first reimbursement bundle."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Tag Title</th>
                    {!isUser && <th className="py-3 px-4">Created By</th>}
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Total Amount (₹)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {report.reportNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 uppercase tracking-wide">
                          {report.title}
                        </div>
                        {report.description && (
                          <div className="text-xs text-slate-500 line-clamp-1 max-w-xs">
                            {report.description}
                          </div>
                        )}
                      </td>
                      {!isUser && (
                        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                          <span className="font-semibold">{report.user.name}</span>
                          <span className="text-[11px] text-slate-400 block">{report.user.email}</span>
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                        {report._count.items}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrencyINR(report.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <DateDisplay date={report.createdAt} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <Link href={`/expenses/${report.id}`}>
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                              View Details
                            </Button>
                          </Link>
                          {report.status === "DRAFT" && report.userId === user.id && (
                            <Link href={`/expenses/${report.id}/edit`}>
                              <Button size="sm" variant="secondary" className="text-xs h-7 px-2.5">
                                Edit
                              </Button>
                            </Link>
                          )}
                        </div>
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
