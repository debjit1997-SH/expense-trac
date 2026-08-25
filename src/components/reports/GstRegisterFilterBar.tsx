"use client";

import React, { useState } from "react";
import { GstRegisterFilterParams } from "@/lib/reports/gst-register-query";
import { GstExceptionCode } from "@/lib/reports/gst-exceptions";
import { ReportStatus, TaxMode, ItcEligibility } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import {
  Search,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  AlertTriangle,
  FileCheck,
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

const EXCEPTION_OPTIONS: { code: GstExceptionCode; label: string }[] = [
  { code: "INVALID_GSTIN", label: "Invalid GSTIN Format" },
  { code: "MISSING_GSTIN", label: "Missing Vendor GSTIN" },
  { code: "MISSING_INVOICE_NUMBER", label: "Missing Invoice Number" },
  { code: "MISSING_INVOICE_DATE", label: "Missing Invoice Date" },
  { code: "MISSING_TAXABLE_VALUE", label: "Missing Taxable Value" },
  { code: "MISSING_GST_RATE", label: "Missing GST Rate" },
  { code: "MISSING_HSN_SAC", label: "Missing HSN/SAC" },
  { code: "MISSING_PLACE_OF_SUPPLY", label: "Missing Place of Supply" },
  { code: "TAX_COMPONENT_CONFLICT", label: "Tax Component Conflict (CGST+IGST)" },
  { code: "INTRA_STATE_WITH_IGST", label: "Intra-State with IGST" },
  { code: "INTER_STATE_WITH_CGST_SGST", label: "Inter-State with CGST/SGST" },
  { code: "GST_CALC_INCONSISTENCY", label: "GST Amount Calculation Error" },
  { code: "GROSS_TOTAL_INCONSISTENCY", label: "Taxable + GST != Gross Total" },
  { code: "TAX_ON_NON_GST", label: "GST on Non-GST/Exempt Supply" },
  { code: "PENDING_ITC_REVIEW", label: "Pending ITC Review" },
  { code: "DUPLICATE_INVOICE", label: "Duplicate Vendor Invoice" },
  { code: "RCM_INCOMPLETE", label: "Incomplete Reverse Charge" },
  { code: "MISSING_EVIDENCE", label: "Missing Receipt Attachment" },
];

interface GstRegisterFilterBarProps {
  filters: GstRegisterFilterParams;
  onChange: (newFilters: GstRegisterFilterParams) => void;
  onReset: () => void;
  categories: any[];
  gstTreatments: any[];
  gstRates: any[];
  users: any[];
}

export function GstRegisterFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  gstTreatments,
  gstRates,
  users,
}: GstRegisterFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filterMode = filters.filterMode || "DATE_RANGE";
  const dateBasis = filters.dateBasis || "EXPENSE_DATE";
  const selectedMonths = filters.selectedMonths || [];
  const currentYear = filters.year || new Date().getFullYear();

  const activeStatuses = filters.statuses || [];

  const handleStatusToggle = (status: ReportStatus) => {
    const isPresent = activeStatuses.includes(status);
    const nextStatuses = isPresent
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status];
    onChange({ ...filters, statuses: nextStatuses, page: 1 });
  };

  const handleMonthToggle = (monthNum: number) => {
    const nextMonths = selectedMonths.includes(monthNum)
      ? selectedMonths.filter((m) => m !== monthNum)
      : [...selectedMonths, monthNum].sort((a, b) => a - b);

    onChange({ ...filters, selectedMonths: nextMonths, page: 1 });
  };

  const selectedCategory = categories.find((c) => c.id === filters.categoryId);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      {/* Top Search & Primary Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Global Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor, GSTIN, invoice #, report, HSN/SAC..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={filters.globalSearch || ""}
            onChange={(e) => onChange({ ...filters, globalSearch: e.target.value, page: 1 })}
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => onChange({ ...filters, filterMode: "DATE_RANGE", page: 1 })}
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
              onClick={() => onChange({ ...filters, filterMode: "MULTIPLE_MONTHS", page: 1 })}
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
            title="Reset filters"
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
                onChange({ ...filters, dateBasis: e.target.value as any, page: 1 })
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

        {/* Status Multi-Selector Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-700 mr-1">Status Filter:</span>
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
                className={`px-2.5 py-0.5 text-xs font-semibold rounded border transition-all ${
                  isChecked
                    ? `${item.color} font-bold ring-1 ring-offset-1`
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-700"
                }`}
              >
                {item.label} {isChecked && "✓"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Filter Collapsible Area */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Vendor */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Vendor / Merchant</label>
            <input
              type="text"
              placeholder="e.g. Uber, Adobe, Indigo"
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.vendorName || ""}
              onChange={(e) => onChange({ ...filters, vendorName: e.target.value || undefined, page: 1 })}
            />
          </div>

          {/* Vendor GSTIN */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Vendor GSTIN</label>
            <input
              type="text"
              placeholder="e.g. 07AAAAA1234A1Z5"
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white font-mono uppercase"
              value={filters.vendorGstin || ""}
              onChange={(e) => onChange({ ...filters, vendorGstin: e.target.value.toUpperCase() || undefined, page: 1 })}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Category</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.categoryId || ""}
              onChange={(e) =>
                onChange({ ...filters, categoryId: e.target.value || undefined, subcategoryId: undefined, page: 1 })
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
              onChange={(e) => onChange({ ...filters, subcategoryId: e.target.value || undefined, page: 1 })}
            >
              <option value="">All Subcategories</option>
              {selectedCategory?.subcategories?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
              onChange={(e) => onChange({ ...filters, gstTreatmentId: e.target.value || undefined, page: 1 })}
            >
              <option value="">All GST Treatments</option>
              {gstTreatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
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
              onChange={(e) => onChange({ ...filters, gstRateId: e.target.value || undefined, page: 1 })}
            >
              <option value="">All GST Rates</option>
              {gstRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tax Mode */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Tax Mode</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.taxMode || ""}
              onChange={(e) => onChange({ ...filters, taxMode: (e.target.value as any) || undefined, page: 1 })}
            >
              <option value="">All Modes</option>
              <option value={TaxMode.INTRA_STATE}>INTRA_STATE (CGST+SGST)</option>
              <option value={TaxMode.INTER_STATE}>INTER_STATE (IGST)</option>
            </select>
          </div>

          {/* Place of Supply */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Place of Supply (POS)</label>
            <input
              type="text"
              placeholder="e.g. 19-West Bengal, 07-Delhi"
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.placeOfSupply || ""}
              onChange={(e) => onChange({ ...filters, placeOfSupply: e.target.value || undefined, page: 1 })}
            />
          </div>

          {/* ITC Eligibility */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">ITC Eligibility</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.itcEligibility || ""}
              onChange={(e) => onChange({ ...filters, itcEligibility: (e.target.value as any) || undefined, page: 1 })}
            >
              <option value="">All ITC Classifications</option>
              <option value={ItcEligibility.ELIGIBLE}>ELIGIBLE</option>
              <option value={ItcEligibility.INELIGIBLE}>INELIGIBLE</option>
              <option value={ItcEligibility.PENDING_REVIEW}>PENDING_REVIEW</option>
              <option value={ItcEligibility.NOT_APPLICABLE}>NOT_APPLICABLE</option>
            </select>
          </div>

          {/* Reverse Charge */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Reverse Charge (RCM)</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.reverseCharge === undefined ? "" : String(filters.reverseCharge)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  reverseCharge: e.target.value === "" ? undefined : e.target.value === "true",
                  page: 1,
                })
              }
            >
              <option value="">All (RCM & Non-RCM)</option>
              <option value="true">YES (Reverse Charge)</option>
              <option value="false">NO (Forward Charge)</option>
            </select>
          </div>

          {/* Evidence Available */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Receipt Attached</label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white"
              value={filters.hasEvidence === undefined ? "" : String(filters.hasEvidence)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  hasEvidence: e.target.value === "" ? undefined : e.target.value === "true",
                  page: 1,
                })
              }
            >
              <option value="">All Records</option>
              <option value="true">Evidence Attached</option>
              <option value="false">Missing Receipt</option>
            </select>
          </div>

          {/* Exceptions Filter */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Exception Type
            </label>
            <select
              className="w-full rounded-md border border-slate-300 p-1.5 text-xs bg-white font-medium"
              value={filters.exceptionCode || (filters.hasException === true ? "ANY" : "")}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onChange({ ...filters, hasException: undefined, exceptionCode: undefined, page: 1 });
                } else if (val === "ANY") {
                  onChange({ ...filters, hasException: true, exceptionCode: undefined, page: 1 });
                } else {
                  onChange({ ...filters, hasException: true, exceptionCode: val as any, page: 1 });
                }
              }}
            >
              <option value="">All Records (With & Without Issues)</option>
              <option value="ANY">⚠️ Any Audit Exception</option>
              {EXCEPTION_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
