"use client";

import React, { useState } from "react";
import {
  DetailedReportFilterParams,
  DateBasisType,
  FilterModeType,
} from "@/lib/reports/report-query";
import { ReportStatus, ItcEligibility } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Search,
  Filter,
  Calendar,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Tag,
  Percent,
  User,
  Layers,
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

interface ReportFilterBarProps {
  filters: DetailedReportFilterParams;
  onChange: (newFilters: DetailedReportFilterParams) => void;
  onReset: () => void;
  categories: MasterOption[];
  gstTreatments: MasterOption[];
  gstRates: { id: string; label: string }[];
  users: { id: string; name: string; role: string }[];
}

export function ReportFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  gstTreatments,
  gstRates,
  users,
}: ReportFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [monthSearch, setMonthSearch] = useState("");

  const filterMode = filters.filterMode || "DATE_RANGE";
  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const selectedMonths = filters.selectedMonths || [];
  const currentYear = filters.year || new Date().getFullYear();

  const handleModeToggle = (mode: FilterModeType) => {
    onChange({
      ...filters,
      filterMode: mode,
      page: 1,
    });
  };

  const handleDateBasisChange = (basis: DateBasisType) => {
    onChange({ ...filters, dateBasis: basis, page: 1 });
  };

  const handleMonthToggle = (monthNum: number) => {
    const nextMonths = selectedMonths.includes(monthNum)
      ? selectedMonths.filter((m) => m !== monthNum)
      : [...selectedMonths, monthNum].sort((a, b) => a - b);

    onChange({
      ...filters,
      selectedMonths: nextMonths,
      page: 1,
    });
  };

  const handleRemoveMonth = (monthNum: number) => {
    onChange({
      ...filters,
      selectedMonths: selectedMonths.filter((m) => m !== monthNum),
      page: 1,
    });
  };

  const filteredMonthOptions = MONTH_NAMES.filter((m) =>
    m.name.toLowerCase().includes(monthSearch.toLowerCase())
  );

  const selectedCategory = categories.find((c) => c.id === filters.categoryId);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      {/* Top Bar: Global Search & Primary Mode Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Global Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-400"
            placeholder="Search report #, tag, vendor, invoice, description, submitter..."
            value={filters.globalSearch || ""}
            onChange={(e) => onChange({ ...filters, globalSearch: e.target.value, page: 1 })}
          />
        </div>

        {/* Filter Mode Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => handleModeToggle("DATE_RANGE")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                filterMode === "DATE_RANGE"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              DATE RANGE
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle("MULTIPLE_MONTHS")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
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
            <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            {showAdvanced ? "Hide Filters" : "More Filters"}
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
            title="Reset all filters to default"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Date Basis & Range Controls */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Date Basis:</span>
            <select
              className="rounded-md border border-slate-300 p-1.5 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
              value={dateBasis}
              onChange={(e) => handleDateBasisChange(e.target.value as DateBasisType)}
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
                  onChange={(e) => onChange({ ...filters, fromDate: e.target.value, page: 1 })}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">To:</span>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 p-1 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  value={filters.toDate || ""}
                  onChange={(e) => onChange({ ...filters, toDate: e.target.value, page: 1 })}
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
                  onChange={(e) => onChange({ ...filters, year: Number(e.target.value), page: 1 })}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Multi-select buttons / searchable selector */}
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

        {/* Selected Month Chips for MULTIPLE_MONTHS mode */}
        {filterMode === "MULTIPLE_MONTHS" && selectedMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500">Selected Months:</span>
            {selectedMonths.map((mNum) => {
              const mObj = MONTH_NAMES.find((m) => m.num === mNum);
              return (
                <span
                  key={mNum}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
                >
                  {mObj?.name} {currentYear}
                  <button
                    type="button"
                    onClick={() => handleRemoveMonth(mNum)}
                    className="hover:text-blue-950"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Filter Collapsible Drawer */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Report Status</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.status || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  status: (e.target.value as ReportStatus) || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REIMBURSED">REIMBURSED</option>
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Expense Category</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.categoryId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  categoryId: e.target.value || undefined,
                  subcategoryId: undefined, // reset subcategory on category change
                  page: 1,
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

          {/* Subcategory */}
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
                  page: 1,
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

          {/* Submitter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Submitted By</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.submittedById || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  submittedById: e.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Primary Approver */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Primary Approver</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.primaryApproverId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  primaryApproverId: e.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All Approvers</option>
              {users
                .filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Reimbursement Owner */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Reimbursement Owner</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.reimbursementOwnerId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  reimbursementOwnerId: e.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All Reimbursement Owners</option>
              {users
                .filter((u) => u.role === "SUPERADMIN")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>

          {/* GST Treatment */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">GST Treatment</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.gstTreatmentId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  gstTreatmentId: e.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All GST Treatments</option>
              {gstTreatments.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* GST Rate */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">GST Rate</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.gstRateId || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  gstRateId: e.target.value || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All GST Rates</option>
              {gstRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* ITC Eligibility */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">ITC Eligibility</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.itcEligibility || ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  itcEligibility: (e.target.value as ItcEligibility) || undefined,
                  page: 1,
                })
              }
            >
              <option value="">All ITC Statuses</option>
              <option value="ELIGIBLE">ELIGIBLE</option>
              <option value="INELIGIBLE">INELIGIBLE</option>
              <option value="PENDING_REVIEW">PENDING REVIEW</option>
              <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
            </select>
          </div>

          {/* Amount Range */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Amount (Min - Max INR)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min"
                className="w-1/2 rounded-md border border-slate-300 p-1 text-xs bg-white"
                value={filters.minAmount !== undefined ? filters.minAmount : ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    minAmount: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  })
                }
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max"
                className="w-1/2 rounded-md border border-slate-300 p-1 text-xs bg-white"
                value={filters.maxAmount !== undefined ? filters.maxAmount : ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxAmount: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  })
                }
              />
            </div>
          </div>

          {/* Evidence Attached */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Evidence Attached</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.hasEvidence === undefined ? "" : String(filters.hasEvidence)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  hasEvidence:
                    e.target.value === "true"
                      ? true
                      : e.target.value === "false"
                      ? false
                      : undefined,
                  page: 1,
                })
              }
            >
              <option value="">All</option>
              <option value="true">Has Attached Receipts</option>
              <option value="false">No Receipts Attached</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
