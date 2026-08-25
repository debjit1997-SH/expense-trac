"use client";

import React from "react";
import { TopVendorItem } from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";
import { Store } from "lucide-react";

interface TopVendorsChartProps {
  topVendors: TopVendorItem[];
}

export function TopVendorsChart({ topVendors }: TopVendorsChartProps) {
  if (topVendors.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col items-center justify-center min-h-[280px] text-slate-400 text-xs italic">
        No vendor spend data available.
      </div>
    );
  }

  const maxVendorSpend = topVendors[0]?.totalAmount || 1;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-blue-600" />
          Top Vendors &amp; Merchants
        </h3>
        <p className="text-[11px] text-slate-500">Highest expenditure vendors with percentage shares</p>
      </div>

      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {topVendors.slice(0, 10).map((v, idx) => {
          const barWidthPct = Math.min(100, Math.max(5, (v.totalAmount / maxVendorSpend) * 100));

          return (
            <div key={v.vendorName} className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 truncate">
                  <span className="text-slate-400 font-mono mr-1.5">{idx + 1}.</span>
                  {v.vendorName}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400 text-[11px]">{v.itemCount} items</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyINR(v.totalAmount)}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                    {v.percentageOfTotal}%
                  </span>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${barWidthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
