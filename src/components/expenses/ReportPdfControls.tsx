"use client";

import React, { useState } from "react";
import { ReportStatus, DocumentGenStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { generateExpenseReportPdfAction } from "@/actions/document.actions";
import { formatCurrencyINR } from "@/lib/formatters";
import { DateDisplay } from "@/components/common/DateDisplay";
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  History,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface ExpenseReportDocumentItem {
  id: string;
  versionNumber: number;
  workflowStatus: ReportStatus;
  filename: string;
  fileSize: number;
  isCurrent: boolean;
  generationStatus: DocumentGenStatus;
  generationError?: string | null;
  generatedAt: string | Date;
  supersededAt?: string | Date | null;
  generatedByUser?: {
    name: string;
    email: string;
  } | null;
}

interface ReportPdfControlsProps {
  reportId: string;
  reportStatus: ReportStatus;
  documents: ExpenseReportDocumentItem[];
  canGenerate: boolean;
}

export function ReportPdfControls({
  reportId,
  reportStatus,
  documents,
  canGenerate,
}: ReportPdfControlsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Find latest current document or specific status documents
  const currentDoc = documents.find((d) => d.isCurrent) || documents[0];
  const submittedDoc = documents.find((d) => d.workflowStatus === ReportStatus.SUBMITTED);
  const approvedDoc = documents.find((d) => d.workflowStatus === ReportStatus.APPROVED);
  const reimbursedDoc = documents.find((d) => d.workflowStatus === ReportStatus.REIMBURSED);

  const handleGeneratePdf = async () => {
    try {
      setIsGenerating(true);
      setErrorMessage(null);
      const res = await generateExpenseReportPdfAction({ reportId });
      if (!res.success) {
        setErrorMessage(res.error || "Failed to generate PDF.");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (reportStatus === ReportStatus.DRAFT && documents.length === 0) {
    return null; // Official PDFs are only generated for submitted, approved, reimbursed reports
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Official Expense Report PDF
            </h3>
            <p className="text-xs text-slate-500">
              Audit-ready versioned document with financial calculations and embedded evidence
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {currentDoc && (
            <a
              href={`/api/expenses/${reportId}/pdf?documentId=${currentDoc.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center"
            >
              <Button variant="outline" size="sm" className="text-xs font-semibold">
                <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                VIEW CURRENT PDF
              </Button>
            </a>
          )}

          {canGenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeneratePdf}
              isLoading={isGenerating}
              className="text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {documents.length === 0 ? "GENERATE PDF" : "RE-GENERATE CURRENT PDF"}
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Direct Status Downloads */}
      <div className="flex flex-wrap items-center gap-2.5">
        {submittedDoc && (
          <a
            href={`/api/expenses/${reportId}/pdf?documentId=${submittedDoc.id}&download=true`}
            download={submittedDoc.filename}
          >
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-slate-600" />
              DOWNLOAD SUBMITTED PDF
            </Button>
          </a>
        )}

        {approvedDoc && (
          <a
            href={`/api/expenses/${reportId}/pdf?documentId=${approvedDoc.id}&download=true`}
            download={approvedDoc.filename}
          >
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              DOWNLOAD APPROVED PDF
            </Button>
          </a>
        )}

        {reimbursedDoc && (
          <a
            href={`/api/expenses/${reportId}/pdf?documentId=${reimbursedDoc.id}&download=true`}
            download={reimbursedDoc.filename}
          >
            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-purple-600" />
              DOWNLOAD REIMBURSED PDF
            </Button>
          </a>
        )}
      </div>

      {/* Version History Table */}
      {documents.length > 0 ? (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Document Versions &amp; Audit Trail ({documents.length}):</span>
          </div>

          <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-xs overflow-hidden">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  doc.isCurrent ? "bg-blue-50/40" : "bg-white hover:bg-slate-50/60"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      v{doc.versionNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded border ${
                        doc.workflowStatus === ReportStatus.REIMBURSED
                          ? "bg-purple-100 text-purple-800 border-purple-200"
                          : doc.workflowStatus === ReportStatus.APPROVED
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      }`}
                    >
                      {doc.workflowStatus}
                    </span>
                    {doc.isCurrent ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-600 text-white rounded">
                        CURRENT ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded">
                        SUPERSEDED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {doc.filename} ({(doc.fileSize / 1024).toFixed(1)} KB)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Generated: <DateDisplay date={doc.generatedAt} />
                    {doc.generatedByUser && <> by {doc.generatedByUser.name}</>}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/expenses/${reportId}/pdf?documentId=${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                  </a>
                  <a
                    href={`/api/expenses/${reportId}/pdf?documentId=${doc.id}&download=true`}
                    download={doc.filename}
                  >
                    <Button variant="secondary" size="sm" className="text-xs h-7 px-2.5">
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <span>No official PDF generated yet for this report.</span>
          {canGenerate && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePdf}
              isLoading={isGenerating}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-700"
            >
              Generate PDF Now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
