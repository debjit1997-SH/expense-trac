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
import { CategorySummaryItem } from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";

interface TopCategoriesChartProps {
  categories: CategorySummaryItem[];
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId?: string) => void;
}

export function TopCategoriesChart({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: TopCategoriesChartProps) {
  const top10 = categories.slice(0, 10);

  if (top10.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-md text-xs shadow-lg space-y-1">
          <p className="font-bold text-slate-100">{data.categoryName}</p>
          <p className="font-mono text-emerald-400 font-bold">{formatCurrencyINR(data.totalAmount)}</p>
          <p className="text-slate-400 text-[11px]">{data.itemCount} items ({data.percentageOfTotal}% of total)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Top Categories (Ranked by Total Spend)
          </h3>
          <p className="text-[11px] text-slate-500">Horizontal ranking of highest expense categories</p>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={top10}
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
              dataKey="categoryName"
              tick={{ fontSize: 10, fill: "#334155", fontWeight: 600 }}
              width={100}
              axisLine={{ stroke: "#CBD5E1" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="totalAmount"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry: any) => {
                if (onSelectCategory) {
                  onSelectCategory(entry?.categoryId === selectedCategoryId ? undefined : entry?.categoryId);
                }
              }}
            >
              {top10.map((entry) => {
                const isSelected = selectedCategoryId === entry.categoryId;
                const isDimmed = selectedCategoryId && selectedCategoryId !== entry.categoryId;
                return (
                  <Cell
                    key={entry.categoryId}
                    fill={isSelected ? "#1E3A8A" : "#3B82F6"}
                    opacity={isDimmed ? 0.35 : 1}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
