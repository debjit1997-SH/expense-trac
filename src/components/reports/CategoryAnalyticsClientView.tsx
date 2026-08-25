"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CategoryAnalyticsFilterParams,
  CategoryAnalyticsResult,
  ORG_NAME,
} from "@/lib/reports/category-analytics-query";
import { ReportStatus } from "@prisma/client";
import { CategoryAnalyticsFilterBar } from "./CategoryAnalyticsFilterBar";
import { CategoryAnalyticsKpiCards } from "./CategoryAnalyticsKpiCards";
import { CategoryDonutChart } from "./CategoryDonutChart";
import { MonthlyCategoryTrendChart } from "./MonthlyCategoryTrendChart";
import { TopCategoriesChart } from "./TopCategoriesChart";
import { SubcategoryBreakdownChart } from "./SubcategoryBreakdownChart";
import { TopVendorsChart } from "./TopVendorsChart";
import { CategoryDrillDownTable } from "./CategoryDrillDownTable";
import { getCategoryAnalyticsAction } from "@/actions/category-analytics.actions";
import { Button } from "@/components/ui/Button";
import {
  PieChart as PieIcon,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface CategoryAnalyticsClientViewProps {
  categories: any[];
  users: any[];
  initialData: CategoryAnalyticsResult;
}

export function CategoryAnalyticsClientView({
  categories,
  users,
  initialData,
}: CategoryAnalyticsClientViewProps) {
  const [filters, setFilters] = useState<CategoryAnalyticsFilterParams>({
    filterMode: "DATE_RANGE",
    dateBasis: "EXPENSE_DATE",
    statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    compareWithPreviousPeriod: false,
  });

  const [analytics, setAnalytics] = useState<CategoryAnalyticsResult>(initialData);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (currentFilters: CategoryAnalyticsFilterParams) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getCategoryAnalyticsAction(currentFilters);
      setAnalytics(res);
    } catch (err: any) {
      setError(err.message || "Failed to load category analytics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics(filters);
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, fetchAnalytics]);

  const handleResetFilters = () => {
    const defFilters: CategoryAnalyticsFilterParams = {
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
      compareWithPreviousPeriod: false,
    };
    setSelectedCategoryId(undefined);
    setFilters(defFilters);
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const res = await fetch("/api/reports/category-analytics/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("Excel export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Category_Analytics_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download Excel analytics.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const res = await fetch("/api/reports/category-analytics/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) throw new Error("PDF export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Category_Analytics_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const selectedCategoryObj = selectedCategoryId
    ? analytics.categories.find((c) => c.categoryId === selectedCategoryId) || null
    : null;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PieIcon className="w-6 h-6 text-blue-600" />
            Category Expense Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {ORG_NAME} &bull; Visual expenditure distribution, monthly stacked trends, subcategory drill-down, and executive KPIs.
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
            Export Excel (5 Sheets)
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

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <CategoryAnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        categories={categories}
        users={users}
      />

      {/* KPI Cards Row */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-xs z-10 rounded-lg flex items-center justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-bold shadow">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Updating analytics...
            </div>
          </div>
        )}
        <CategoryAnalyticsKpiCards
          kpis={analytics.kpis}
          compareEnabled={Boolean(filters.compareWithPreviousPeriod)}
        />
      </div>

      {/* Charts Grid Row 1: Donut & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryDonutChart
          categories={analytics.categories}
          totalExpense={analytics.kpis.totalExpense}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
        <MonthlyCategoryTrendChart
          monthlyTrend={analytics.monthlyTrend}
          categories={analytics.categories}
        />
      </div>

      {/* Charts Grid Row 2: Top Categories & Subcategory Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCategoriesChart
          categories={analytics.categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
        <SubcategoryBreakdownChart
          selectedCategory={selectedCategoryObj}
          allSubcategories={analytics.subcategories}
        />
      </div>

      {/* Charts Grid Row 3: Top Vendors */}
      <TopVendorsChart topVendors={analytics.topVendors} />

      {/* Drill-down Table */}
      <CategoryDrillDownTable
        subcategories={analytics.subcategories}
        categories={analytics.categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />
    </div>
  );
}
