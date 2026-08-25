"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DetailedExpenseReportRow,
  DetailedReportSummaryTotals,
  DetailedReportFilterParams,
} from "@/lib/reports/report-query";
import { DEFAULT_COLUMN_IDS, ALL_REPORT_COLUMNS } from "@/lib/reports/excel-export";
import { ReportFilterBar } from "./ReportFilterBar";
import { DetailedExpenseGrid } from "./DetailedExpenseGrid";
import { CustomizeColumnsModal } from "./CustomizeColumnsModal";
import { SavedViewsModal, SavedViewItem } from "./SavedViewsModal";
import { getDetailedExpenseReportAction, getSavedViewPreferencesAction } from "@/actions/report.actions";
import { BarChart3, AlertCircle } from "lucide-react";

interface DetailedExpenseReportClientViewProps {
  categories: any[];
  gstTreatments: any[];
  gstRates: any[];
  users: any[];
  initialSavedViews: SavedViewItem[];
  defaultView?: SavedViewItem | null;
}

export function DetailedExpenseReportClientView({
  categories,
  gstTreatments,
  gstRates,
  users,
  initialSavedViews,
  defaultView,
}: DetailedExpenseReportClientViewProps) {
  // Initialize columns and filters from default view or fallback
  const initialColumns = defaultView?.columnConfig?.order || Object.keys(ALL_REPORT_COLUMNS);
  const initialVisible = defaultView?.columnConfig?.visible || DEFAULT_COLUMN_IDS;
  const initialFilters: DetailedReportFilterParams = defaultView?.filterConfig || {
    filterMode: "DATE_RANGE",
    dateBasis: "EXPENSE_DATE",
    page: 1,
    pageSize: 25,
  };

  const [filters, setFilters] = useState<DetailedReportFilterParams>(initialFilters);
  const [columnOrder, setColumnOrder] = useState<string[]>(initialColumns);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(initialVisible);

  const [savedViews, setSavedViews] = useState<SavedViewItem[]>(initialSavedViews);
  const [rows, setRows] = useState<DetailedExpenseReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summaryTotals, setSummaryTotals] = useState<DetailedReportSummaryTotals>({
    itemCount: 0,
    totalTaxableValue: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalCess: 0,
    totalGst: 0,
    grandTotal: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isSavedViewsModalOpen, setIsSavedViewsModalOpen] = useState(false);

  // Fetch report data
  const fetchData = useCallback(async (currentFilters: DetailedReportFilterParams) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getDetailedExpenseReportAction(currentFilters);
      setRows(res.rows);
      setTotalCount(res.totalCount);
      setSummaryTotals(res.summaryTotals);
    } catch (err: any) {
      setError(err.message || "Failed to load report records.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on filter changes (with debounce for search)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData(filters);
    }, 250);

    return () => clearTimeout(handler);
  }, [filters, fetchData]);

  // Refresh saved views list
  const refreshSavedViews = async () => {
    const updated = await getSavedViewPreferencesAction();
    setSavedViews(updated);
  };

  // Load a saved view
  const handleLoadView = (view: SavedViewItem) => {
    if (view.columnConfig) {
      if (view.columnConfig.order) setColumnOrder(view.columnConfig.order);
      if (view.columnConfig.visible) setVisibleColumns(view.columnConfig.visible);
    }
    if (view.filterConfig) {
      setFilters((prev) => ({
        ...prev,
        ...view.filterConfig,
        page: 1,
      }));
    }
    if (view.sortConfig) {
      setFilters((prev) => ({
        ...prev,
        sortBy: view.sortConfig.sortBy,
        sortOrder: view.sortConfig.sortOrder,
      }));
    }
  };

  const handleResetFilters = () => {
    setFilters({
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      page: 1,
      pageSize: 25,
      sortBy: "expenseDate",
      sortOrder: "desc",
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Detailed Expense &amp; GST Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Flattened item-level searchable analytical report with GST breakdown, workflow trail, customizable columns, and real Excel / PDF exports.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        categories={categories}
        gstTreatments={gstTreatments}
        gstRates={gstRates}
        users={users}
      />

      {/* Interactive Data Grid */}
      <DetailedExpenseGrid
        rows={rows}
        totalCount={totalCount}
        summaryTotals={summaryTotals}
        filters={filters}
        columnOrder={columnOrder}
        visibleColumns={visibleColumns}
        isLoading={isLoading}
        onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
        onPageSizeChange={(newPageSize) =>
          setFilters({ ...filters, pageSize: newPageSize, page: 1 })
        }
        onSortChange={(field, order) =>
          setFilters({ ...filters, sortBy: field, sortOrder: order, page: 1 })
        }
        onOpenCustomizeColumns={() => setIsCustomizeModalOpen(true)}
        onOpenSavedViews={() => setIsSavedViewsModalOpen(true)}
      />

      {/* Customize Columns Modal */}
      <CustomizeColumnsModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        columnOrder={columnOrder}
        visibleColumns={visibleColumns}
        onChange={(newOrder, newVisible) => {
          setColumnOrder(newOrder);
          setVisibleColumns(newVisible);
        }}
      />

      {/* Saved Views Modal */}
      <SavedViewsModal
        isOpen={isSavedViewsModalOpen}
        onClose={() => setIsSavedViewsModalOpen(false)}
        savedViews={savedViews}
        currentColumnConfig={{ order: columnOrder, visible: visibleColumns }}
        currentFilterConfig={filters}
        currentSortConfig={{ sortBy: filters.sortBy, sortOrder: filters.sortOrder }}
        onLoadView={handleLoadView}
        onViewsUpdated={refreshSavedViews}
      />
    </div>
  );
}
