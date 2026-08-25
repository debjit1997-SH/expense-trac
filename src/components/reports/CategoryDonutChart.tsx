"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { CategorySummaryItem } from "@/lib/reports/category-analytics-query";
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

interface CategoryDonutChartProps {
  categories: CategorySummaryItem[];
  totalExpense: number;
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId?: string) => void;
}

export function CategoryDonutChart({
  categories,
  totalExpense,
  selectedCategoryId,
  onSelectCategory,
}: CategoryDonutChartProps) {
  if (categories.length === 0 || totalExpense === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col items-center justify-center min-h-[340px] text-slate-400 text-xs italic">
        No category spend data available for the active filters.
      </div>
    );
  }

  // Combine small categories (< 2.5%) into "OTHER"
  const chartData: { name: string; value: number; id: string; percentage: number }[] = [];
  let otherAmount = 0;

  categories.forEach((cat) => {
    if (cat.percentageOfTotal < 2.5 && categories.length > 5) {
      otherAmount += cat.totalAmount;
    } else {
      chartData.push({
        id: cat.categoryId,
        name: cat.categoryName,
        value: cat.totalAmount,
        percentage: cat.percentageOfTotal,
      });
    }
  });

  if (otherAmount > 0) {
    chartData.push({
      id: "OTHER",
      name: "OTHER CATEGORIES",
      value: otherAmount,
      percentage: Number(((otherAmount / totalExpense) * 100).toFixed(2)),
    });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-md text-xs shadow-lg space-y-1">
          <p className="font-bold text-slate-100">{data.name}</p>
          <p className="font-mono text-emerald-400 font-bold">{formatCurrencyINR(data.value)}</p>
          <p className="text-slate-400 text-[11px]">{data.percentage}% of total spend</p>
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
            Expense Spend by Category
          </h3>
          <p className="text-[11px] text-slate-500">Click a category segment to focus drill-down</p>
        </div>
        {selectedCategoryId && (
          <button
            type="button"
            onClick={() => onSelectCategory && onSelectCategory(undefined)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear Selection ✕
          </button>
        )}
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              cursor="pointer"
              onClick={(entry: any) => {
                if (entry?.id !== "OTHER" && onSelectCategory) {
                  onSelectCategory(entry?.id === selectedCategoryId ? undefined : entry?.id);
                }
              }}
            >
              {chartData.map((entry, index) => {
                const isSelected = selectedCategoryId === entry.id;
                const isDimmed = selectedCategoryId && selectedCategoryId !== entry.id;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLOR_PALETTE[index % COLOR_PALETTE.length]}
                    opacity={isDimmed ? 0.35 : 1}
                    stroke={isSelected ? "#1E293B" : "#FFFFFF"}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
