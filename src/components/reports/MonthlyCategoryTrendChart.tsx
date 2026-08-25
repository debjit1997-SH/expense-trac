"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { MonthlyTrendItem, CategorySummaryItem } from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";

const COLOR_PALETTE = [
  "#2563EB", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#64748B", // Slate
];

interface MonthlyCategoryTrendChartProps {
  monthlyTrend: MonthlyTrendItem[];
  categories: CategorySummaryItem[];
}

export function MonthlyCategoryTrendChart({
  monthlyTrend,
  categories,
}: MonthlyCategoryTrendChartProps) {
  if (monthlyTrend.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col items-center justify-center min-h-[340px] text-slate-400 text-xs italic">
        No monthly trend data available.
      </div>
    );
  }

  // Prepare data rows for Recharts
  const chartData = monthlyTrend.map((m) => {
    const row: any = {
      monthLabel: m.monthLabel,
      totalMonthly: m.totalAmount,
    };
    categories.forEach((cat) => {
      row[cat.categoryName] = m.categoryBreakdown[cat.categoryName] || 0;
    });
    return row;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalSpend = payload.reduce((acc: number, p: any) => acc + (Number(p.value) || 0), 0);

      return (
        <div className="bg-slate-900 text-white p-3 rounded-md text-xs shadow-lg space-y-1.5 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-slate-200">{label}</span>
            <span className="font-mono text-emerald-400 font-bold">{formatCurrencyINR(totalSpend)}</span>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pt-1">
            {payload
              .filter((p: any) => Number(p.value) > 0)
              .map((p: any) => (
                <div key={p.name} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-slate-300 truncate max-w-[120px]" style={{ color: p.color }}>
                    {p.name}:
                  </span>
                  <span className="font-mono text-slate-100">{formatCurrencyINR(p.value)}</span>
                </div>
              ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
          Monthly Category Expense Trend
        </h3>
        <p className="text-[11px] text-slate-500">Stacked monthly distribution across top categories</p>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={{ stroke: "#CBD5E1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            {categories.slice(0, 8).map((cat, idx) => (
              <Bar
                key={cat.categoryId}
                dataKey={cat.categoryName}
                stackId="a"
                fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                radius={idx === categories.slice(0, 8).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
