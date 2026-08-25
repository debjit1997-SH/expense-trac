"use client";

import React, { useState } from "react";
import { CategoryAnalyticsFilterParams } from "@/lib/reports/category-analytics-query";
import { ReportStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Filter,
  Calendar,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  History,
} from "lucide-react";

const MONTH_NAMES = [
  { num: 1, name: "January", short: "Jan" },
  { num: 2, name: "February", short: "Feb" },
  { num: 3, name: "March", short: "Mar" },
  { num: 4, name: "April", short: "Apr" },
  { num: 5, name: "May", short: "May" },
  { num: 6, name: "June", short: "Jun" },
  { num: 7, name: "July", short: "Jul" },
  { num: 8, name: "August", short: "Aug" },
  { num: 9, name: "September", short: "Sep" },
  { num: 10, name: "October", short: "Oct" },
  { num: 11, name: "November", short: "Nov" },
  { num: 12, name: "December", short: "Dec" },
];

interface MasterOption {
  id: string;
  name: string;
  code?: string;
  subcategories?: { id: string; name: string }[];
}

interface CategoryAnalyticsFilterBarProps {
  filters: CategoryAnalyticsFilterParams;
  onChange: (newFilters: CategoryAnalyticsFilterParams) => void;
  onReset: () => void;
  categories: MasterOption[];
  users: { id: string; name: string; role: string }[];
}

export function CategoryAnalyticsFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  users,
}: CategoryAnalyticsFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filterMode = filters.filterMode || "DATE_RANGE";
  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const selectedMonths = filters.selectedMonths || [];
  const currentYear = filters.year || new Date().getFullYear();

  const activeStatuses =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses
      : [ReportStatus.APPROVED, ReportStatus.REIMBURSED];

  const handleStatusToggle = (status: ReportStatus) => {
    const isPresent = activeStatuses.includes(status);
    let nextStatuses: ReportStatus[];
    if (isPresent) {
      if (activeStatuses.length === 1) {
        alert("At least one status must be selected.");
        return;
      }
      nextStatuses = activeStatuses.filter((s) => s !== status);
    } else {
      nextStatuses = [...activeStatuses, status];
    }
    onChange({ ...filters, statuses: nextStatuses });
  };

  const handleMonthToggle = (monthNum: number) => {
    const nextMonths = selectedMonths.includes(monthNum)
      ? selectedMonths.filter((m) => m !== monthNum)
      : [...selectedMonths, monthNum].sort((a, b) => a - b);

    onChange({ ...filters, selectedMonths: nextMonths });
  };

  const selectedCategory = categories.find((c) => c.id === filters.categoryId);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      {/* Top Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Multi-Selector Buttons (Default: APPROVED & REIMBURSED) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 mr-1">Statuses:</span>
          {[
            { status: ReportStatus.APPROVED, label: "APPROVED", color: "border-blue-300 text-blue-800 bg-blue-50" },
            { status: ReportStatus.REIMBURSED, label: "REIMBURSED", color: "border-emerald-300 text-emerald-800 bg-emerald-50" },
            { status: ReportStatus.SUBMITTED, label: "SUBMITTED", color: "border-amber-300 text-amber-800 bg-amber-50" },
            { status: ReportStatus.DRAFT, label: "DRAFT", color: "border-slate-300 text-slate-700 bg-slate-100" },
          ].map((item) => {
            const isChecked = activeStatuses.includes(item.status);
            return (
              <button
                key={item.status}
                type="button"
                onClick={() => handleStatusToggle(item.status)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md border transition-all ${
                  isChecked
                    ? `${item.color} shadow-xs font-extrabold ring-1 ring-offset-1`
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-700"
                }`}
              >
                {item.label} {isChecked && "✓"}
              </button>
            );
          })}
        </div>

        {/* Action Controls & Compare Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compare Previous Period Toggle */}
          <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Compare Previous Period</span>
            <input
              type="checkbox"
              checked={Boolean(filters.compareWithPreviousPeriod)}
              onChange={(e) =>
                onChange({ ...filters, compareWithPreviousPeriod: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 ml-1"
            />
          </label>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => onChange({ ...filters, filterMode: "DATE_RANGE" })}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                filterMode === "DATE_RANGE"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              DATE RANGE
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...filters, filterMode: "MULTIPLE_MONTHS" })}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                filterMode === "MULTIPLE_MONTHS"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              MULTIPLE MONTHS
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            {showAdvanced ? "Fewer Filters" : "More Filters"}
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs font-semibold text-slate-600 hover:text-red-600"
            title="Reset to default"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Date Basis & Range Section */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Date Basis:</span>
            <select
              className="rounded-md border border-slate-300 p-1.5 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
              value={dateBasis}
              onChange={(e) =>
                onChange({ ...filters, dateBasis: e.target.value as any })
              }
            >
              <option value="EXPENSE_DATE">Expense Date</option>
              <option value="SUBMITTED_DATE">Submitted Date</option>
              <option value="APPROVED_DATE">Approved Date</option>
              <option value="REIMBURSED_DATE">Reimbursed Date</option>
            </select>
          </div>

          {filterMode === "DATE_RANGE" ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">From:</span>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 p-1 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  value={filters.fromDate || ""}
                  onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">To:</span>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 p-1 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  value={filters.toDate || ""}
                  onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Year:</span>
                <select
                  className="rounded-md border border-slate-300 p-1.5 text-xs bg-white font-medium"
                  value={currentYear}
                  onChange={(e) => onChange({ ...filters, year: Number(e.target.value) })}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Pills */}
              <div className="flex flex-wrap items-center gap-1">
                {MONTH_NAMES.map((m) => {
                  const isSelected = selectedMonths.includes(m.num);
                  return (
                    <button
                      key={m.num}
                      type="button"
                      onClick={() => handleMonthToggle(m.num)}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {m.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filter Collapsible Area */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Category Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Category</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.categoryId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  categoryId: e.target.value || undefined,
                  subcategoryId: undefined,
                })
              }
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Subcategory</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.subcategoryId || ""}
              disabled={!filters.categoryId}
              onChange={(e) =>
                onChange({
                  ...filters,
                  subcategoryId: e.target.value || undefined,
                })
              }
            >
              <option value="">All Subcategories</option>
              {selectedCategory?.subcategories?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Vendor / Merchant</label>
            <input
              type="text"
              placeholder="e.g. Uber, Taj, Indigo"
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.vendorName || ""}
              onChange={(e) =>
                onChange({ ...filters, vendorName: e.target.value || undefined })
              }
            />
          </div>

          {/* Submitter Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Submitted By</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.submittedById || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  submittedById: e.target.value || undefined,
                })
              }
            >
              <option value="">All Employees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
