"use client";

import React from "react";
import { GstSummaryKpis } from "@/lib/reports/gst-register-query";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  Banknote,
  Receipt,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownUp,
  Ban,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";

interface GstSummaryCardsProps {
  kpis: GstSummaryKpis;
  onFilterExceptions?: () => void;
}

export function GstSummaryCards({ kpis, onFilterExceptions }: GstSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
      {/* 1. Gross Expense */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Expense</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-slate-900 font-mono">
            {formatCurrencyINR(kpis.grossExpense)}
          </div>
        </div>
      </div>

      {/* 2. Taxable Value */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taxable Value</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-blue-900 font-mono">
            {formatCurrencyINR(kpis.taxableValue)}
          </div>
        </div>
      </div>

      {/* 3. CGST */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CGST</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-slate-800 font-mono">
            {formatCurrencyINR(kpis.cgst)}
          </div>
        </div>
      </div>

      {/* 4. SGST / UTGST */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SGST / UTGST</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-slate-800 font-mono">
            {formatCurrencyINR(kpis.sgst)}
          </div>
        </div>
      </div>

      {/* 5. IGST */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IGST</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-purple-900 font-mono">
            {formatCurrencyINR(kpis.igst)}
          </div>
        </div>
      </div>

      {/* 6. Cess */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cess</span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-amber-900 font-mono">
            {formatCurrencyINR(kpis.cess)}
          </div>
        </div>
      </div>

      {/* 7. Total GST */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
          <Percent className="w-3 h-3 text-emerald-600" />
          Total GST Tax
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-emerald-950 font-mono">
            {formatCurrencyINR(kpis.totalGst)}
          </div>
        </div>
      </div>

      {/* 8. Eligible ITC */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Eligible ITC
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-emerald-900 font-mono">
            {formatCurrencyINR(kpis.eligibleItc)}
          </div>
        </div>
      </div>

      {/* 9. Ineligible ITC */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <XCircle className="w-3 h-3 text-red-500" />
          Ineligible ITC
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-red-900 font-mono">
            {formatCurrencyINR(kpis.ineligibleItc)}
          </div>
        </div>
      </div>

      {/* 10. Pending ITC Review */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-500" />
          Pending Review
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-amber-900 font-mono">
            {formatCurrencyINR(kpis.pendingItcReview)}
          </div>
        </div>
      </div>

      {/* 11. Reverse Charge (RCM) */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <ArrowDownUp className="w-3 h-3 text-indigo-500" />
          RCM Amount
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-indigo-900 font-mono">
            {formatCurrencyINR(kpis.rcmAmount)}
          </div>
        </div>
      </div>

      {/* 12. Non-GST / Exempt */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Ban className="w-3 h-3 text-slate-400" />
          Non-GST / Exempt
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-slate-700 font-mono">
            {formatCurrencyINR(kpis.nonGstAmount)}
          </div>
        </div>
      </div>

      {/* 13. GST Record Count */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Receipt className="w-3 h-3 text-blue-500" />
          GST Records
        </span>
        <div className="mt-1.5">
          <div className="text-sm font-black text-slate-900 font-mono">
            {kpis.recordCount} <span className="text-[10px] font-normal text-slate-400">Items</span>
          </div>
        </div>
      </div>

      {/* 14. Data Exceptions Count */}
      <div
        className={`rounded-lg p-3 shadow-xs flex flex-col justify-between cursor-pointer border transition-colors ${
          kpis.exceptionCount > 0
            ? "bg-red-50/80 border-red-200 hover:bg-red-100/80"
            : "bg-emerald-50/50 border-emerald-200"
        }`}
        onClick={onFilterExceptions}
        title={kpis.exceptionCount > 0 ? "Click to filter audit exceptions" : "All records clean"}
      >
        <span
          className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
            kpis.exceptionCount > 0 ? "text-red-800" : "text-emerald-800"
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          Data Exceptions
        </span>
        <div className="mt-1.5">
          <div
            className={`text-sm font-black font-mono ${
              kpis.exceptionCount > 0 ? "text-red-900" : "text-emerald-900"
            }`}
          >
            {kpis.exceptionCount} <span className="text-[10px] font-normal">Issues</span>
          </div>
        </div>
      </div>
    </div>
  );
}
