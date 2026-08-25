"use client";

import React, { useState } from "react";
import {
  SubcategorySummaryItem,
  CategorySummaryItem,
} from "@/lib/reports/category-analytics-query";
import { formatCurrencyINR } from "@/lib/formatters";
import { Search, ExternalLink, Filter, Layers } from "lucide-react";
import Link from "next/link";

interface CategoryDrillDownTableProps {
  subcategories: SubcategorySummaryItem[];
  categories: CategorySummaryItem[];
  selectedCategoryId?: string;
  onSelectCategory?: (categoryId?: string) => void;
}

export function CategoryDrillDownTable({
  subcategories,
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryDrillDownTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = subcategories.filter((s) => {
    if (selectedCategoryId && s.categoryId !== selectedCategoryId) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.categoryName.toLowerCase().includes(term) ||
      s.subcategoryName.toLowerCase().includes(term) ||
      s.subcategoryCode.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Category &amp; Subcategory Detailed Spend Breakdown
          </h3>
          <p className="text-[11px] text-slate-500">
            Click any row or link to open the filtered Detailed Expense Report
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Category Filter Selector */}
          <select
            className="rounded-md border border-slate-300 p-1 text-xs bg-white font-medium"
            value={selectedCategoryId || ""}
            onChange={(e) => onSelectCategory && onSelectCategory(e.target.value || undefined)}
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search subcategory..."
              className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[420px]">
        <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
          <thead className="bg-slate-900 text-white sticky top-0 z-10">
            <tr>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Category</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px]">Subcategory</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-center">Items</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Taxable Value</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Total GST</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Total Spend</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Avg Amount</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">Highest Spend</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-right">% Share</th>
              <th className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-center">Drill-Down</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                  No subcategory breakdown rows matched.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={`${item.categoryId}-${item.subcategoryId}`}
                    className={`hover:bg-blue-50/60 transition-colors ${
                      isEven ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                      {item.categoryName}
                    </td>
                    <td className="p-2.5 text-slate-700 whitespace-nowrap">
                      {item.subcategoryName}
                    </td>
                    <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                      {item.itemCount}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrencyINR(item.taxableValue)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-blue-700 font-semibold whitespace-nowrap">
                      {formatCurrencyINR(item.totalGst)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                      {formatCurrencyINR(item.totalAmount)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrencyINR(item.avgAmount)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrencyINR(item.maxAmount)}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {item.percentageOfTotal}%
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <Link
                        href={`/reports/expenses?categoryId=${item.categoryId}&subcategoryId=${item.subcategoryId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200"
                        target="_blank"
                      >
                        <span>View Items</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
