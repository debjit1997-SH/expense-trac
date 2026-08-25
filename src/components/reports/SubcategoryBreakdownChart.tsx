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
  Cell,
} from "recharts";
import { CategorySummaryItem, SubcategorySummaryItem } from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";
import { Layers } from "lucide-react";

interface SubcategoryBreakdownChartProps {
  selectedCategory?: CategorySummaryItem | null;
  allSubcategories: SubcategorySummaryItem[];
}

export function SubcategoryBreakdownChart({
  selectedCategory,
  allSubcategories,
}: SubcategoryBreakdownChartProps) {
  const displayItems = selectedCategory
    ? selectedCategory.subcategories
    : allSubcategories.slice(0, 10);

  const title = selectedCategory
    ? `Subcategory Breakdown: ${selectedCategory.categoryName}`
    : "Top Subcategories Across All Categories";

  if (displayItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col items-center justify-center min-h-[280px] text-slate-400 text-xs italic">
        <Layers className="w-6 h-6 text-slate-300 mb-2" />
        No subcategories found for selected category.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-md text-xs shadow-lg space-y-1">
          <p className="font-bold text-slate-100">{data.subcategoryName}</p>
          <p className="font-mono text-emerald-400 font-bold">{formatCurrencyINR(data.totalAmount)}</p>
          <p className="text-slate-400 text-[11px]">
            {data.itemCount} items (
            {selectedCategory ? `${data.percentageOfCategory}% of category` : `${data.percentageOfTotal}% of total`})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          {title}
        </h3>
        <p className="text-[11px] text-slate-500">
          {selectedCategory
            ? `Total Category Spend: ${formatCurrencyINR(selectedCategory.totalAmount)}`
            : "Subcategories ranked by total spend"}
        </p>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={displayItems}
            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="subcategoryName"
              tick={{ fontSize: 10, fill: "#334155", fontWeight: 600 }}
              width={100}
              axisLine={{ stroke: "#CBD5E1" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalAmount" fill="#10B981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
