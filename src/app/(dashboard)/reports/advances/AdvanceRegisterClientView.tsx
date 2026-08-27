"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdvanceStatus, Role } from "@prisma/client";
import {
  AdvanceRegisterRow,
  AdvanceRegisterSummaryTotals,
  AdvanceRegisterFilterParams,
} from "@/lib/reports/advance-register-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrencyINR } from "@/lib/formatters";
import { AdvanceStatusBadge } from "@/components/advances/AdvanceStatusBadge";
import {
  Wallet,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  Download,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AdvanceRegisterClientViewProps {
  initialData: {
    rows: AdvanceRegisterRow[];
    totalCount: number;
    page: number;
    pageSize: number;
    summaryTotals: AdvanceRegisterSummaryTotals;
  };
  users: Array<{ id: string; name: string; email: string; role: Role }>;
  currentUserRole: Role;
}

export function AdvanceRegisterClientView({
  initialData,
  users,
  currentUserRole,
}: AdvanceRegisterClientViewProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [status, setStatus] = useState<AdvanceStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchFilteredData = async (pageToFetch = currentPage) => {
    setLoading(true);
    try {
      const filters: AdvanceRegisterFilterParams = {
        page: pageToFetch,
        pageSize,
        search: search || undefined,
        requesterId: requesterId || undefined,
        status: (status as AdvanceStatus) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      };

      const res = await fetch("/api/reports/advances/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) {
        // Fallback to reloading page if query route is not defined
        window.location.reload();
        return;
      }

      const json = await res.json();
      setData(json);
      setCurrentPage(pageToFetch);
    } catch (err) {
      console.error("Filter error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const filters: AdvanceRegisterFilterParams = {
        search: search || undefined,
        requesterId: requesterId || undefined,
        status: (status as AdvanceStatus) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      };

      const res = await fetch("/api/reports/advances/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("Excel export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Advance_Register_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(err.message || "Failed to download Excel export");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const filters: AdvanceRegisterFilterParams = {
        search: search || undefined,
        requesterId: requesterId || undefined,
        status: (status as AdvanceStatus) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      };

      const res = await fetch("/api/reports/advances/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("PDF export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Advance_Register_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(err.message || "Failed to download PDF export");
    } finally {
      setExportingPdf(false);
    }
  };

  const { summaryTotals, rows, totalCount } = data;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            Advance Financial Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready company advance liquidity register, expense adjustments, returned funds, and live balances.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
            {exportingExcel ? "Generating Excel..." : "Export Excel"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
            {exportingPdf ? "Generating PDF..." : "Export Landscape PDF"}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Disbursed</p>
          <p className="text-base font-extrabold text-purple-700 mt-1">
            {formatCurrencyINR(summaryTotals.totalDisbursed)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{summaryTotals.activeDisbursedCount} active advances</p>
        </Card>

        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expense Adjusted</p>
          <p className="text-base font-extrabold text-blue-700 mt-1">
            {formatCurrencyINR(summaryTotals.totalAdjusted)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">settled via expense reports</p>
        </Card>

        <Card className="p-3 border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Returned</p>
          <p className="text-base font-extrabold text-amber-700 mt-1">
            {formatCurrencyINR(summaryTotals.totalReturned)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">returned unspent funds</p>
        </Card>

        <Card className="p-3 border-slate-200 bg-emerald-50/60 border-emerald-200">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available Balance</p>
          <p className="text-base font-extrabold text-emerald-700 mt-1">
            {formatCurrencyINR(summaryTotals.totalAvailable)}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">usable for expense tags</p>
        </Card>

        <Card className="p-3 border-slate-200 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-base font-extrabold text-slate-900 mt-1">
            {formatCurrencyINR(summaryTotals.totalOutstanding)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">total liquidity with employees</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Advance #, purpose, payment ref..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Employee</label>
              <select
                value={requesterId}
                onChange={(e) => setRequesterId(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">All Employees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdvanceStatus | "")}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="DISBURSED">DISBURSED</option>
                <option value="PARTIALLY_SETTLED">PARTIALLY SETTLED</option>
                <option value="SETTLED">SETTLED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Date Range</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-1/2 text-[11px] px-1.5 py-1.5 border border-slate-300 rounded focus:outline-none"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-1/2 text-[11px] px-1.5 py-1.5 border border-slate-300 rounded focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setRequesterId("");
                setStatus("");
                setFromDate("");
                setToDate("");
                setMinAmount("");
                setMaxAmount("");
                window.location.reload();
              }}
              className="text-xs h-7 px-3 text-slate-600"
            >
              Reset Filters
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fetchFilteredData(1)}
              disabled={loading}
              className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              <Filter className="w-3 h-3 mr-1" /> Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advance Register Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            Advance Register Records ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Advance Records Found</h3>
              <p className="text-xs text-slate-500 mt-1">No advance requests match the specified criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3">Advance #</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Requested (₹)</th>
                    <th className="py-2.5 px-3 text-right">Disbursed (₹)</th>
                    <th className="py-2.5 px-3 text-right">Adjusted (₹)</th>
                    <th className="py-2.5 px-3 text-right">Returned (₹)</th>
                    <th className="py-2.5 px-3 text-right">Available (₹)</th>
                    <th className="py-2.5 px-3 text-right">Outstanding (₹)</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {row.advanceNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{row.requesterName}</div>
                        <div className="text-[10px] text-slate-400">{row.requesterEmail}</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate">
                        {row.purpose}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <AdvanceStatusBadge status={row.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {formatCurrencyINR(row.requestedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-purple-700 whitespace-nowrap">
                        {formatCurrencyINR(row.disbursedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                        {formatCurrencyINR(row.adjustedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {formatCurrencyINR(row.returnedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                        {formatCurrencyINR(row.availableBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrencyINR(row.outstandingBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <Link href={`/advances/${row.id}`}>
                          <Button size="sm" variant="outline" className="text-[11px] h-6 px-2">
                            View <ArrowRight className="w-2.5 h-2.5 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Page {currentPage} of {totalPages} ({totalCount} total advances)
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => fetchFilteredData(currentPage - 1)}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => fetchFilteredData(currentPage + 1)}
                  className="h-7 px-2"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
