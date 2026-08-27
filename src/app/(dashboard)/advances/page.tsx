import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-utils";
import { getAdvancesListAction } from "@/actions/advance.actions";
import { AdvanceStatus, Role } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdvanceStatusBadge } from "@/components/advances/AdvanceStatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { HandCoins, PlusCircle, Search, Filter, Wallet, ArrowRight, ShieldCheck, Clock, CheckCircle2, XCircle } from "lucide-react";

interface AdvancesPageProps {
  searchParams: {
    search?: string;
    status?: AdvanceStatus;
    from?: string;
    to?: string;
  };
}

export default async function AdvancesPage({ searchParams }: AdvancesPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isUser = user.role === Role.USER;

  const advances = await getAdvancesListAction({
    search: searchParams.search,
    status: searchParams.status,
    fromDate: searchParams.from,
    toDate: searchParams.to,
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            Company Advances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isUser
              ? "Request and track your upfront company advances and expense settlements"
              : "Review, approve, and track employee advance disbursements and settlements"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/advances/create">
            <Button variant="primary" className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700">
              <HandCoins className="w-4 h-4 mr-1.5" />
              Request Advance
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={searchParams.search}
                  placeholder="Advance #, purpose, employee..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={searchParams.status || ""}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED (Awaiting Disbursement)</option>
                <option value="DISBURSED">DISBURSED (Active)</option>
                <option value="PARTIALLY_SETTLED">PARTIALLY SETTLED</option>
                <option value="SETTLED">FULLY SETTLED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                From Date
              </label>
              <input
                type="date"
                name="from"
                defaultValue={searchParams.from}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  name="to"
                  defaultValue={searchParams.to}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-8 px-3 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1" /> Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Advances Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            Advances List
            <span className="text-xs font-normal text-slate-500 lowercase">({advances.length} records)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {advances.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Advance Requests Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchParams.search || searchParams.status
                  ? "No advances matched the selected filters. Try clearing search filters."
                  : "Click 'Request Advance' above to submit your first upfront expense advance request."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Advance #</th>
                    <th className="py-3 px-4">Purpose</th>
                    {!isUser && <th className="py-3 px-4">Employee</th>}
                    <th className="py-3 px-4">Requested (₹)</th>
                    <th className="py-3 px-4">Disbursed (₹)</th>
                    <th className="py-3 px-4">Adjusted (₹)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {advances.map((adv: any) => (
                    <tr key={adv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {adv.advanceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1 max-w-xs">
                          {adv.purpose}
                        </div>
                        {adv.expectedSettlementDate && (
                          <div className="text-[11px] text-slate-400">
                            Exp. Settlement: <DateDisplay date={adv.expectedSettlementDate} />
                          </div>
                        )}
                      </td>
                      {!isUser && (
                        <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                          <span className="font-semibold">{adv.user.name}</span>
                          <span className="text-[11px] text-slate-400 block">{adv.user.email}</span>
                        </td>
                      )}
                      <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                        {formatCurrencyINR(adv.requestedAmount)}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-700 whitespace-nowrap">
                        {adv.disbursedAmount > 0 ? formatCurrencyINR(adv.disbursedAmount) : "-"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                        {adv.adjustedAmount > 0 ? formatCurrencyINR(adv.adjustedAmount) : "-"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <AdvanceStatusBadge status={adv.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <DateDisplay date={adv.createdAt} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link href={`/advances/${adv.id}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                            View Details <ArrowRight className="w-3 h-3 ml-1" />
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
