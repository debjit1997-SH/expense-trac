"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  GstRegisterFilterParams,
  GstRegisterRow,
  GstSummaryKpis,
  GstAnalyticsData,
  ORG_NAME,
  GST_DISCLAIMER,
} from "@/lib/reports/gst-register-query";
import { GstRegisterFilterBar } from "./GstRegisterFilterBar";
import { GstSummaryCards } from "./GstSummaryCards";
import { GstTransactionGrid } from "./GstTransactionGrid";
import { GstAnalyticsCharts } from "./GstAnalyticsCharts";
import { getGstRegisterAction, getGstAnalyticsAction } from "@/actions/gst-register.actions";
import { Button } from "@/components/ui/Button";
import {
  Receipt,
  PieChart,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";

interface GstRegisterClientViewProps {
  categories: any[];
  gstTreatments: any[];
  gstRates: any[];
  users: any[];
  initialData: {
    rows: GstRegisterRow[];
    totalCount: number;
    kpis: GstSummaryKpis;
  };
  initialAnalytics: GstAnalyticsData;
}

export function GstRegisterClientView({
  categories,
  gstTreatments,
  gstRates,
  users,
  initialData,
  initialAnalytics,
}: GstRegisterClientViewProps) {
  const [activeTab, setActiveTab] = useState<"REGISTER" | "ANALYTICS">("REGISTER");

  const [filters, setFilters] = useState<GstRegisterFilterParams>({
    filterMode: "DATE_RANGE",
    dateBasis: "EXPENSE_DATE",
    page: 1,
    pageSize: 25,
    sortBy: "expenseDate",
    sortOrder: "desc",
  });

  const [rows, setRows] = useState<GstRegisterRow[]>(initialData.rows);
  const [totalCount, setTotalCount] = useState<number>(initialData.totalCount);
  const [kpis, setKpis] = useState<GstSummaryKpis>(initialData.kpis);
  const [analytics, setAnalytics] = useState<GstAnalyticsData>(initialAnalytics);

  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (currentFilters: GstRegisterFilterParams) => {
    try {
      setIsLoading(true);
      setError(null);
      const [regRes, anaRes] = await Promise.all([
        getGstRegisterAction(currentFilters, true),
        getGstAnalyticsAction(currentFilters),
      ]);
      setRows(regRes.rows);
      setTotalCount(regRes.totalCount);
      setKpis(regRes.kpis);
      setAnalytics(anaRes);
    } catch (err: any) {
      setError(err.message || "Failed to load GST Register data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(filters);
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, fetchData]);

  const handleResetFilters = () => {
    const defFilters: GstRegisterFilterParams = {
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      page: 1,
      pageSize: 25,
      sortBy: "expenseDate",
      sortOrder: "desc",
    };
    setFilters(defFilters);
  };

  const handleFilterExceptions = () => {
    setFilters((prev) => ({
      ...prev,
      hasException: prev.hasException === true ? undefined : true,
      page: 1,
    }));
  };

  const handleSort = (field: string) => {
    setFilters((prev) => {
      const isSame = prev.sortBy === field;
      const nextOrder = isSame && prev.sortOrder === "asc" ? "desc" : "asc";
      return { ...prev, sortBy: field, sortOrder: nextOrder, page: 1 };
    });
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const res = await fetch("/api/reports/gst/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("Excel export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST_Expense_Register_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download GST Excel report.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const res = await fetch("/api/reports/gst/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("PDF export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GST_Expense_Register_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download GST PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Disclaimer Banner */}
      <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-xs text-amber-900 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold tracking-wide">{GST_DISCLAIMER}</span>
        </div>
        <span className="text-[11px] text-amber-700 hidden sm:inline">
          For internal audit &amp; reconciliation purposes only
        </span>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            GST Expense Register &amp; Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {ORG_NAME} &bull; Itemized GST inward supplies, tax component breakdown, ITC classifications, and automated compliance exceptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            isLoading={isExportingExcel}
            className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export Excel (8 Sheets)
          </Button>

          {/* PDF Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            isLoading={isExportingPdf}
            className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Export PDF (Landscape)
          </Button>
        </div>
      </div>

      {/* Primary View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("REGISTER")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            activeTab === "REGISTER"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Itemized GST Transaction Grid
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            activeTab === "ANALYTICS"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          GST Analytics &amp; Visual Dashboards
        </button>
      </div>

      {/* Filter Bar */}
      <GstRegisterFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        categories={categories}
        gstTreatments={gstTreatments}
        gstRates={gstRates}
        users={users}
      />

      {/* Summary KPI Cards (14 Cards) */}
      <GstSummaryCards kpis={kpis} onFilterExceptions={handleFilterExceptions} />

      {/* Active Tab Views */}
      {activeTab === "REGISTER" ? (
        <GstTransactionGrid
          rows={rows}
          totalCount={totalCount}
          page={filters.page || 1}
          pageSize={filters.pageSize || 25}
          onPageChange={(p) => setFilters({ ...filters, page: p })}
          onPageSizeChange={(s) => setFilters({ ...filters, pageSize: s, page: 1 })}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onSort={handleSort}
          kpis={kpis}
          isLoading={isLoading}
        />
      ) : (
        <GstAnalyticsCharts analytics={analytics} />
      )}
    </div>
  );
}
