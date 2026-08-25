"use client";

import React from "react";
import { GstRegisterRow } from "@/lib/reports/gst-register-query";
import { GstExceptionItem } from "@/lib/reports/gst-exceptions";
import { Button } from "@/components/ui/Button";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

interface GstExceptionsModalProps {
  row: GstRegisterRow | null;
  onClose: () => void;
}

export function GstExceptionsModal({ row, onClose }: GstExceptionsModalProps) {
  if (!row) return null;

  const renderSeverityBadge = (sev: GstExceptionItem["severity"]) => {
    if (sev === "HIGH") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-600" />
          HIGH RISK
        </span>
      );
    }
    if (sev === "MEDIUM") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          MEDIUM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
        <Info className="w-3 h-3 text-blue-600" />
        INFO / LOW
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Data-Quality &amp; GST Audit Exceptions</h3>
              <p className="text-[11px] text-slate-400">
                {row.reportNumber} &bull; {row.vendorName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Summary Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Expense Date</span>
              <span className="font-semibold text-slate-800">{row.expenseDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Invoice #</span>
              <span className="font-semibold text-slate-800">{row.invoiceNumber || "-"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Vendor GSTIN</span>
              <span className="font-mono font-semibold text-slate-800">{row.vendorGstin || "None"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Gross / Taxable</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrencyINR(row.grossAmount)} / {formatCurrencyINR(row.taxableValue)}
              </span>
            </div>
          </div>

          {/* Exceptions List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Flagged Issues ({row.exceptions.length})
            </h4>

            {row.exceptions.length === 0 ? (
              <div className="p-4 rounded-lg bg-emerald-50 text-emerald-800 text-xs text-center font-medium">
                ✓ No audit exceptions or data quality issues detected for this item.
              </div>
            ) : (
              row.exceptions.map((exc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-red-200 bg-red-50/40 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      {exc.title}
                    </span>
                    {renderSeverityBadge(exc.severity)}
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed">{exc.message}</p>
                  <div className="text-[10px] text-slate-400 font-mono">Code: {exc.code}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex items-center justify-between text-xs">
          <Link
            href={`/expenses/${row.reportId}`}
            className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline"
            target="_blank"
          >
            <span>Open Expense Report #{row.reportNumber}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
