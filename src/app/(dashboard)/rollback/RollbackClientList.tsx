"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { rollbackExpenseReportAction } from "@/actions/workflow.actions";
import { Undo2, Layers, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ReportItem {
  id: string;
  reportNumber: string;
  title: string;
  description?: string | null;
  totalAmount: any;
  status: any;
  submittedAt: Date | string | null;
  _count: { items: number; evidences: number };
}

export function RollbackClientList({ initialReports }: { initialReports: ReportItem[] }) {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirmRollback = async (reason?: string) => {
    if (!selectedReport) return;
    try {
      setIsRollingBack(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await rollbackExpenseReportAction({
        reportId: selectedReport.id,
        reason,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to rollback report.");
      } else {
        setSuccessMessage(
          `Report "${selectedReport.reportNumber} - ${selectedReport.title}" has been rolled back to DRAFT successfully.`
        );
        setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
        setSelectedReport(null);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Link href="/expenses">
            <Button size="sm" variant="outline" className="text-xs h-7 px-2">
              View in Drafts &rarr;
            </Button>
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            Your Submitted Reports Eligible for Rollback ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No submitted reports found</p>
              <p className="text-xs text-slate-500">
                You do not currently have any reports in SUBMITTED status awaiting review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Tag Title</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Submitted On</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {report.reportNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 uppercase tracking-wide">
                        {report.title}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                        {report._count.items}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrencyINR(report.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <DateDisplay date={report.submittedAt} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReport(report)}
                          className="text-xs h-7 px-3 border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold"
                        >
                          <Undo2 className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          Rollback to Draft
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        onConfirm={handleConfirmRollback}
        title="Confirm Expense Rollback"
        message={`Are you sure you want to rollback "${selectedReport?.reportNumber} - ${selectedReport?.title}"? It will be moved from SUBMITTED back to DRAFT so you can make modifications.`}
        confirmLabel="Confirm Rollback"
        variant="warning"
        askReason={true}
        reasonPlaceholder="Optional reason for rolling back this report..."
        isLoading={isRollingBack}
      />
    </div>
  );
}
