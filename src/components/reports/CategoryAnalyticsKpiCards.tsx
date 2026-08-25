"use client";

import React from "react";
import { KpiSummary } from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Layers,
  Store,
  Percent,
} from "lucide-react";

interface CategoryAnalyticsKpiCardsProps {
  kpis: KpiSummary;
  compareEnabled?: boolean;
}

export function CategoryAnalyticsKpiCards({
  kpis,
  compareEnabled,
}: CategoryAnalyticsKpiCardsProps) {
  const renderDeltaBadge = (delta: number | null | undefined) => {
    if (delta === null || delta === undefined) return null;
    const isPositive = delta > 0;
    const isZero = delta === 0;

    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          isZero
            ? "bg-slate-100 text-slate-700"
            : isPositive
            ? "bg-red-50 text-red-700 border border-red-200" // For expenses, an increase is often red or highlighted
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-2.5 h-2.5" />
        ) : isZero ? null : (
          <TrendingDown className="w-2.5 h-2.5" />
        )}
        {isPositive ? `+${delta}%` : `${delta}%`} vs prev
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
      {/* 1. Total Expense */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Expense
          </span>
          <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-slate-900 font-mono">
            {formatCurrencyINR(kpis.totalExpense)}
          </div>
          {compareEnabled && (
            <div className="mt-1 flex items-center gap-1.5">
              {renderDeltaBadge(kpis.previousPeriod?.expenseDeltaPct)}
            </div>
          )}
        </div>
      </div>

      {/* 2. Total Reimbursed */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Reimbursed
          </span>
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-blue-900 font-mono">
            {formatCurrencyINR(kpis.totalReimbursed)}
          </div>
          {compareEnabled && (
            <div className="mt-1 flex items-center gap-1.5">
              {renderDeltaBadge(kpis.previousPeriod?.reimbursedDeltaPct)}
            </div>
          )}
        </div>
      </div>

      {/* 3. Approved Awaiting Reimbursement */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Awaiting Disbursement
          </span>
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-amber-900 font-mono">
            {formatCurrencyINR(kpis.approvedAwaitingReimbursement)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Approved status</span>
        </div>
      </div>

      {/* 4. Total GST Tax */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total GST Taxes
          </span>
          <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-700">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-indigo-900 font-mono">
            {formatCurrencyINR(kpis.totalGst)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Taxable: {formatCurrencyINR(kpis.totalTaxableValue)}
          </span>
        </div>
      </div>

      {/* 5. Expense Items Count */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Expense Items Count
          </span>
          <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-slate-900 font-mono">
            {kpis.itemCount} <span className="text-xs font-normal text-slate-500">Items</span>
          </div>
        </div>
      </div>

      {/* 6. Average Expense Amount */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Avg Expense / Item
          </span>
          <div className="p-1.5 rounded-md bg-teal-50 text-teal-700">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-black text-teal-900 font-mono">
            {formatCurrencyINR(kpis.averageExpenseAmount)}
          </div>
        </div>
      </div>

      {/* 7. Highest Expense Category */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Top Category
          </span>
          <div className="p-1.5 rounded-md bg-purple-50 text-purple-700">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-bold text-purple-900 truncate">
            {kpis.highestExpenseCategory?.name || "-"}
          </div>
          {kpis.highestExpenseCategory && (
            <span className="text-[11px] font-mono text-purple-700 block mt-0.5">
              {formatCurrencyINR(kpis.highestExpenseCategory.amount)}
            </span>
          )}
        </div>
      </div>

      {/* 8. Highest Expense Vendor */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Top Vendor / Merchant
          </span>
          <div className="p-1.5 rounded-md bg-cyan-50 text-cyan-700">
            <Store className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-sm font-bold text-cyan-900 truncate">
            {kpis.highestExpenseVendor?.name || "-"}
          </div>
          {kpis.highestExpenseVendor && (
            <span className="text-[11px] font-mono text-cyan-700 block mt-0.5">
              {formatCurrencyINR(kpis.highestExpenseVendor.amount)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
