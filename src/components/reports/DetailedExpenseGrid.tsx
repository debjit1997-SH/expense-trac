"use client";

import React, { useState } from "react";
import {
  DetailedExpenseReportRow,
  DetailedReportSummaryTotals,
  DetailedReportFilterParams,
} from "@/lib/reports/report-query";
import { ALL_REPORT_COLUMNS, DEFAULT_COLUMN_IDS } from "@/lib/reports/excel-export";
import { formatCurrencyINR } from "@/lib/formatters";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Columns,
  Bookmark,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  ExternalLink,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface DetailedExpenseGridProps {
  rows: DetailedExpenseReportRow[];
  totalCount: number;
  summaryTotals: DetailedReportSummaryTotals;
  filters: DetailedReportFilterParams;
  columnOrder: string[];
  visibleColumns: string[];
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onSortChange: (field: string, order: "asc" | "desc") => void;
  onOpenCustomizeColumns: () => void;
  onOpenSavedViews: () => void;
}

export function DetailedExpenseGrid({
  rows,
  totalCount,
  summaryTotals,
  filters,
  columnOrder,
  visibleColumns,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onOpenCustomizeColumns,
  onOpenSavedViews,
}: DetailedExpenseGridProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 25;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Determine active columns in specified order
  const activeColumns = columnOrder
    .filter((id) => visibleColumns.includes(id))
    .map((id) => ALL_REPORT_COLUMNS[id])
    .filter(Boolean);

  const handleSortClick = (columnId: string) => {
    const currentSort = filters.sortBy;
    const currentOrder = filters.sortOrder || "desc";

    if (currentSort === columnId) {
      onSortChange(columnId, currentOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(columnId, "desc");
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const res = await fetch("/api/reports/expenses/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          visibleColumnIds: visibleColumns,
        }),
      });

      if (!res.ok) throw new Error("Excel export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Detailed_Expense_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download Excel file.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async (isSummaryOnly = false) => {
    try {
      setIsExportingPdf(true);
      const res = await fetch("/api/reports/expenses/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          visibleColumnIds: visibleColumns,
          isSummaryOnly,
        }),
      });

      if (!res.ok) throw new Error("PDF export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Detailed_Expense_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      className={`space-y-4 bg-white border border-slate-200 rounded-lg shadow-sm ${
        isFullScreen ? "fixed inset-0 z-50 p-6 overflow-y-auto" : "p-4"
      }`}
    >
      {/* Grid Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase">
              Records: <strong className="text-blue-700 font-mono">{totalCount}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Views Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSavedViews}
            className="text-xs font-semibold"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Saved Views
          </Button>

          {/* Customize Columns Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCustomizeColumns}
            className="text-xs font-semibold"
          >
            <Columns className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            Customize Columns ({visibleColumns.length})
          </Button>

          {/* Excel Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            isLoading={isExportingExcel}
            className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export Excel (.xlsx)
          </Button>

          {/* PDF Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportPdf(false)}
            isLoading={isExportingPdf}
            className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Export PDF (Landscape)
          </Button>

          {/* Full Screen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            title={isFullScreen ? "Exit Full Screen" : "Full Screen Mode"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Table Grid */}
      <div className="relative border border-slate-200 rounded-lg overflow-x-auto max-h-[580px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-lg">
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading report records...
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
          {/* Table Header */}
          <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-xs">
            <tr>
              {activeColumns.map((col) => {
                const isSorted = filters.sortBy === col.id;
                const sortOrder = filters.sortOrder || "desc";

                return (
                  <th
                    key={col.id}
                    onClick={() => handleSortClick(col.id)}
                    className="p-2.5 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap cursor-pointer hover:bg-slate-800 transition-colors select-none"
                    style={{ minWidth: col.width ? `${col.width * 8}px` : "120px" }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.header}</span>
                      <span className="text-slate-400">
                        {isSorted ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="w-3 h-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={activeColumns.length} className="py-16 text-center text-slate-500 text-xs">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No expense item records matched your filter criteria.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={`${row.reportId}-${row.itemId}`}
                    className={`transition-colors hover:bg-blue-50/50 ${
                      isEven ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    {activeColumns.map((col) => {
                      const rawVal = col.accessor(row);

                      return (
                        <td
                          key={col.id}
                          className={`p-2.5 text-slate-700 whitespace-nowrap ${
                            col.align === "right"
                              ? "text-right font-mono"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left"
                          }`}
                        >
                          {col.id === "reportNumber" ? (
                            <Link
                              href={`/expenses/${row.reportId}`}
                              className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              target="_blank"
                            >
                              <span>{row.reportNumber}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </Link>
                          ) : col.id === "tagStatus" ? (
                            <StatusBadge status={row.tagStatus} />
                          ) : col.id === "itemAmount" ? (
                            <strong className="text-slate-900 font-black">
                              {formatCurrencyINR(row.itemAmount)}
                            </strong>
                          ) : col.id === "tagTotal" ? (
                            <span className="font-semibold text-slate-800">
                              {formatCurrencyINR(row.tagTotal)}
                            </span>
                          ) : col.id === "taxableValue" ? (
                            <span>{formatCurrencyINR(row.taxableValue)}</span>
                          ) : col.id === "totalGstAmount" ? (
                            <span className="text-blue-700 font-semibold">
                              {formatCurrencyINR(row.totalGstAmount)}
                            </span>
                          ) : col.id === "evidenceCount" && row.evidenceCount > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              <Receipt className="w-3 h-3" />
                              {row.evidenceCount}
                            </span>
                          ) : (
                            String(rawVal !== null && rawVal !== undefined ? rawVal : "-")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky Summary Totals Bar */}
      <div className="p-3 bg-slate-900 text-white rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs font-semibold shadow-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="uppercase text-[11px] tracking-wider text-slate-400 font-bold">
            Aggregated Totals ({summaryTotals.itemCount} Items):
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] font-sans">TAXABLE VALUE</span>
            <span className="text-slate-200">{formatCurrencyINR(summaryTotals.totalTaxableValue)}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-sans">CGST</span>
            <span className="text-slate-200">{formatCurrencyINR(summaryTotals.totalCgst)}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-sans">SGST / UTGST</span>
            <span className="text-slate-200">{formatCurrencyINR(summaryTotals.totalSgst)}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-sans">IGST</span>
            <span className="text-slate-200">{formatCurrencyINR(summaryTotals.totalIgst)}</span>
          </div>

          <div>
            <span className="text-blue-300 block text-[10px] font-sans">TOTAL GST TAX</span>
            <span className="text-blue-300 font-bold">{formatCurrencyINR(summaryTotals.totalGst)}</span>
          </div>

          <div className="pl-4 border-l border-slate-700">
            <span className="text-emerald-400 block text-[10px] font-sans">GRAND TOTAL AMOUNT</span>
            <span className="text-emerald-400 text-sm font-black">{formatCurrencyINR(summaryTotals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            className="rounded-md border border-slate-300 p-1 text-xs bg-white font-medium"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-slate-400 pl-2">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            className="h-7 px-2"
            title="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-7 px-2"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="px-3 font-semibold text-slate-800">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-7 px-2"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="h-7 px-2"
            title="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
