"use client";

import React, { useState } from "react";
import { GstRegisterRow, GstSummaryKpis } from "@/lib/reports/gst-register-query";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  Maximize2,
  Minimize2,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
  FileText,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { GstExceptionsModal } from "./GstExceptionsModal";

interface ColumnDef {
  id: string;
  label: string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  isDefault?: boolean;
}

export const ALL_GST_COLUMNS: ColumnDef[] = [
  { id: "reportNumber", label: "Report #", minWidth: 140, isDefault: true },
  { id: "tagTitle", label: "Expense Tag", minWidth: 160, isDefault: false },
  { id: "status", label: "Status", minWidth: 110, align: "center", isDefault: true },
  { id: "expenseDate", label: "Expense Date", minWidth: 115, isDefault: true },
  { id: "invoiceDate", label: "Invoice Date", minWidth: 115, isDefault: false },
  { id: "invoiceNumber", label: "Invoice #", minWidth: 120, isDefault: true },
  { id: "vendorName", label: "Vendor / Merchant", minWidth: 180, isDefault: true },
  { id: "vendorGstStatus", label: "Vendor Reg Status", minWidth: 140, isDefault: false },
  { id: "vendorGstin", label: "Vendor GSTIN", minWidth: 155, isDefault: true },
  { id: "companyGstin", label: "Recipient GSTIN", minWidth: 155, isDefault: false },
  { id: "documentType", label: "Document Type", minWidth: 130, isDefault: false },
  { id: "gstTreatmentName", label: "GST Treatment", minWidth: 150, isDefault: true },
  { id: "categoryName", label: "Category", minWidth: 150, isDefault: true },
  { id: "subcategoryName", label: "Subcategory", minWidth: 150, isDefault: false },
  { id: "placeOfSupply", label: "Place of Supply", minWidth: 130, isDefault: true },
  { id: "hsnSacCode", label: "HSN / SAC", minWidth: 110, isDefault: false },
  { id: "taxMode", label: "Tax Mode", minWidth: 120, align: "center", isDefault: true },
  { id: "taxableValue", label: "Taxable Value", minWidth: 130, align: "right", isDefault: true },
  { id: "gstRateLabel", label: "GST Rate", minWidth: 100, align: "center", isDefault: true },
  { id: "cgstAmount", label: "CGST Amount", minWidth: 115, align: "right", isDefault: true },
  { id: "sgstAmount", label: "SGST Amount", minWidth: 115, align: "right", isDefault: true },
  { id: "igstAmount", label: "IGST Amount", minWidth: 115, align: "right", isDefault: true },
  { id: "cessAmount", label: "Cess Amount", minWidth: 110, align: "right", isDefault: false },
  { id: "totalGstAmount", label: "Total GST Tax", minWidth: 130, align: "right", isDefault: true },
  { id: "grossAmount", label: "Gross Spend", minWidth: 130, align: "right", isDefault: true },
  { id: "reverseCharge", label: "RCM", minWidth: 80, align: "center", isDefault: true },
  { id: "itcEligibility", label: "ITC Eligibility", minWidth: 130, align: "center", isDefault: true },
  { id: "submittedBy", label: "Submitted By", minWidth: 140, isDefault: false },
  { id: "evidenceCount", label: "Receipts", minWidth: 90, align: "center", isDefault: true },
  { id: "exceptionCount", label: "Audit Flags", minWidth: 120, align: "center", isDefault: true },
];

interface GstTransactionGridProps {
  rows: GstRegisterRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort: (field: string) => void;
  kpis: GstSummaryKpis;
  isLoading?: boolean;
}

export function GstTransactionGrid({
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortOrder,
  onSort,
  kpis,
  isLoading,
}: GstTransactionGridProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedRowForExceptions, setSelectedRowForExceptions] = useState<GstRegisterRow | null>(null);

  const [visibleColIds, setVisibleColIds] = useState<string[]>(() =>
    ALL_GST_COLUMNS.filter((c) => c.isDefault !== false).map((c) => c.id)
  );
  const [showColModal, setShowColModal] = useState(false);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const toggleColumn = (colId: string) => {
    if (visibleColIds.includes(colId)) {
      if (visibleColIds.length === 1) return;
      setVisibleColIds(visibleColIds.filter((id) => id !== colId));
    } else {
      setVisibleColIds([...visibleColIds, colId]);
    }
  };

  const visibleColumns = ALL_GST_COLUMNS.filter((col) => visibleColIds.includes(col.id));

  const renderCellContent = (row: GstRegisterRow, colId: string) => {
    switch (colId) {
      case "reportNumber":
        return (
          <Link
            href={`/expenses/${row.reportId}`}
            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            target="_blank"
          >
            <span>{row.reportNumber}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </Link>
        );
      case "status":
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              row.status === "REIMBURSED"
                ? "bg-emerald-100 text-emerald-800"
                : row.status === "APPROVED"
                ? "bg-blue-100 text-blue-800"
                : row.status === "SUBMITTED"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {row.status}
          </span>
        );
      case "vendorGstin":
        return <span className="font-mono text-slate-700">{row.vendorGstin || "-"}</span>;
      case "taxableValue":
        return <span className="font-mono font-semibold text-slate-800">{formatCurrencyINR(row.taxableValue)}</span>;
      case "cgstAmount":
        return <span className="font-mono text-slate-700">{formatCurrencyINR(row.cgstAmount)}</span>;
      case "sgstAmount":
        return <span className="font-mono text-slate-700">{formatCurrencyINR(row.sgstAmount)}</span>;
      case "igstAmount":
        return <span className="font-mono text-purple-700 font-semibold">{formatCurrencyINR(row.igstAmount)}</span>;
      case "cessAmount":
        return <span className="font-mono text-amber-700">{formatCurrencyINR(row.cessAmount)}</span>;
      case "totalGstAmount":
        return <span className="font-mono font-bold text-emerald-700">{formatCurrencyINR(row.totalGstAmount)}</span>;
      case "grossAmount":
        return <span className="font-mono font-black text-slate-900">{formatCurrencyINR(row.grossAmount)}</span>;
      case "reverseCharge":
        return row.reverseCharge ? (
          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">YES</span>
        ) : (
          <span className="text-slate-400 text-[10px]">NO</span>
        );
      case "itcEligibility":
        return (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              row.itcEligibility === "ELIGIBLE"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : row.itcEligibility === "INELIGIBLE"
                ? "bg-red-50 text-red-700 border border-red-200"
                : row.itcEligibility === "PENDING_REVIEW"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.itcEligibility}
          </span>
        );
      case "evidenceCount":
        return (
          <span
            className={`font-mono text-xs font-semibold ${
              row.evidenceCount > 0 ? "text-blue-600" : "text-amber-600"
            }`}
          >
            {row.evidenceCount} 📎
          </span>
        );
      case "exceptionCount":
        return row.exceptionCount > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedRowForExceptions(row)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-bold transition-colors cursor-pointer"
            title="Click to view exception audit details"
          >
            <AlertTriangle className="w-3 h-3 text-red-600" />
            {row.exceptionCount} Flag{row.exceptionCount > 1 ? "s" : ""}
          </button>
        ) : (
          <span className="text-emerald-700 text-[11px] font-semibold">✓ Clean</span>
        );
      default:
        return (row as any)[colId] || "-";
    }
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col ${
        isFullScreen ? "fixed inset-0 z-50 rounded-none" : "space-y-3 p-4"
      }`}
    >
      {/* Grid Top Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${isFullScreen ? "p-4 border-b" : ""}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            GST Transaction Register Grid ({totalCount.toLocaleString()} Rows)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Customize Columns Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColModal(true)}
            className="text-xs font-semibold"
          >
            <Sliders className="w-3.5 h-3.5 mr-1.5" />
            Customize Columns ({visibleColumns.length})
          </Button>

          {/* Full Screen Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="text-xs font-semibold"
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 mr-1.5" /> Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Fullscreen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="border border-slate-200 rounded-lg overflow-auto flex-1 max-h-[580px] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs z-20 flex items-center justify-center">
            <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-bold shadow flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Loading GST transactions...
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white sticky top-0 z-10 select-none">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  style={{ minWidth: col.minWidth }}
                  className={`p-2.5 font-bold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-slate-800 transition-colors ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  }`}
                  onClick={() => onSort(col.id)}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.align === "right" ? "justify-end w-full" : col.align === "center" ? "justify-center w-full" : ""
                    }`}
                  >
                    <span>{col.label}</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="py-16 text-center text-slate-400 italic">
                  No GST transactions matched the active filter criteria.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isEven = idx % 2 === 0;
                const hasFlags = row.exceptionCount > 0;
                return (
                  <tr
                    key={row.itemId}
                    className={`hover:bg-blue-50/70 transition-colors ${
                      hasFlags ? "bg-red-50/20" : isEven ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className={`p-2.5 whitespace-nowrap ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {renderCellContent(row, col.id)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Sticky Totals Footer */}
          <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 border-t-2 border-slate-300">
            <tr>
              {visibleColumns.map((col, idx) => {
                if (idx === 0) {
                  return (
                    <td key={col.id} className="p-2.5 text-slate-900 font-black">
                      REGISTER TOTALS
                    </td>
                  );
                }
                if (col.id === "taxableValue") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-blue-950 font-black">
                      {formatCurrencyINR(kpis.taxableValue)}
                    </td>
                  );
                }
                if (col.id === "cgstAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-slate-900">
                      {formatCurrencyINR(kpis.cgst)}
                    </td>
                  );
                }
                if (col.id === "sgstAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-slate-900">
                      {formatCurrencyINR(kpis.sgst)}
                    </td>
                  );
                }
                if (col.id === "igstAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-purple-950 font-bold">
                      {formatCurrencyINR(kpis.igst)}
                    </td>
                  );
                }
                if (col.id === "cessAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-amber-950 font-bold">
                      {formatCurrencyINR(kpis.cess)}
                    </td>
                  );
                }
                if (col.id === "totalGstAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-emerald-950 font-black">
                      {formatCurrencyINR(kpis.totalGst)}
                    </td>
                  );
                }
                if (col.id === "grossAmount") {
                  return (
                    <td key={col.id} className="p-2.5 text-right font-mono text-slate-950 font-black">
                      {formatCurrencyINR(kpis.grossExpense)}
                    </td>
                  );
                }
                if (col.id === "exceptionCount") {
                  return (
                    <td key={col.id} className="p-2.5 text-center font-mono text-red-900 font-black">
                      {kpis.exceptionCount} Flags
                    </td>
                  );
                }
                return <td key={col.id} className="p-2.5" />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            className="rounded border border-slate-300 p-1 text-xs bg-white font-medium"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-slate-400">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-2 font-semibold">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Column Customizer Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Customize Visible Columns</h3>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {ALL_GST_COLUMNS.map((col) => {
                const isChecked = visibleColIds.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button size="sm" onClick={() => setShowColModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Details Drawer/Modal */}
      {selectedRowForExceptions && (
        <GstExceptionsModal
          row={selectedRowForExceptions}
          onClose={() => setSelectedRowForExceptions(null)}
        />
      )}
    </div>
  );
}
