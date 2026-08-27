"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { createAdvanceRequestAction, submitAdvanceRequestAction } from "@/actions/advance.actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HandCoins, UploadCloud, FileText, CheckCircle2, AlertCircle, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

interface CreateAdvanceClientViewProps {
  currentUserId: string;
  currentUserRole: Role;
  eligibleApprovers: Array<{ id: string; name: string; email: string; role: Role; isFallback?: boolean }>;
  isFallback: boolean;
}

export function CreateAdvanceClientView({
  currentUserId,
  currentUserRole,
  eligibleApprovers,
  isFallback,
}: CreateAdvanceClientViewProps) {
  const router = useRouter();

  const [purpose, setPurpose] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [requiredByDate, setRequiredByDate] = useState("");
  const [expectedSettlementDate, setExpectedSettlementDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const [primaryApproverId, setPrimaryApproverId] = useState(eligibleApprovers[0]?.id || "");
  const [selectedCcIds, setSelectedCcIds] = useState<string[]>([]);

  // Evidence state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState<{
    originalName: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selected);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "File upload failed.");
      }

      setUploadedEvidence({
        originalName: data.originalName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        storagePath: data.storagePath,
      });
    } catch (err: any) {
      setError(err.message || "Failed to upload document.");
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = async () => {
    setError(null);
    if (!purpose.trim()) {
      setError("Please provide a business purpose for the advance.");
      return;
    }
    const amt = parseFloat(requestedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Requested amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const res = await createAdvanceRequestAction({
        purpose: purpose.trim(),
        requestedAmount: amt,
        requiredByDate: requiredByDate || null,
        expectedSettlementDate: expectedSettlementDate || null,
        remarks: remarks || null,
        evidence: uploadedEvidence,
      });

      if (!res.success || !res.advance) {
        throw new Error(res.error || "Failed to save draft.");
      }

      router.push(`/advances/${res.advance.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!purpose.trim()) {
      setError("Please provide a business purpose for the advance.");
      return;
    }
    const amt = parseFloat(requestedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Requested amount must be a positive number.");
      return;
    }
    if (!primaryApproverId) {
      setError("Please select a Primary Approver.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Draft
      const createRes = await createAdvanceRequestAction({
        purpose: purpose.trim(),
        requestedAmount: amt,
        requiredByDate: requiredByDate || null,
        expectedSettlementDate: expectedSettlementDate || null,
        remarks: remarks || null,
        evidence: uploadedEvidence,
      });

      if (!createRes.success || !createRes.advance) {
        throw new Error(createRes.error || "Failed to create advance request.");
      }

      // 2. Submit for Approval
      const submitRes = await submitAdvanceRequestAction({
        advanceId: createRes.advance.id,
        primaryApproverId,
        ccUserIds: selectedCcIds,
        remarks: remarks || undefined,
      });

      if (!submitRes.success) {
        throw new Error(submitRes.error || "Failed to submit advance request.");
      }

      router.push(`/advances/${createRes.advance.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/advances">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-600" />
            Request Employee Advance
          </h1>
          <p className="text-xs text-slate-500">
            Submit a request for upfront company funds for official travel or business expenses.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Request Form */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3 px-5">
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Advance Request Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Purpose of Advance <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Travel & accommodation advance for Mumbai client visits"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Requested Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Required By Date
              </label>
              <input
                type="date"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expected Settlement Date
              </label>
              <input
                type="date"
                value={expectedSettlementDate}
                onChange={(e) => setExpectedSettlementDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Remarks / Justification
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional details, estimated breakdown, or itinerary..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Quotation / Proof Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quotation / Proforma / Requirement Proof (Optional)
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-emerald-400 transition-colors">
              <input
                type="file"
                id="advance-evidence"
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
              />
              <label htmlFor="advance-evidence" className="cursor-pointer block">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                <span className="text-xs font-semibold text-emerald-700">Click to upload quotation or estimation document</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">PDF, PNG, JPG up to 10MB</span>
              </label>
            </div>

            {uploading && <p className="text-xs text-blue-600 mt-1">Uploading document securely...</p>}

            {uploadedEvidence && (
              <div className="mt-2 flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{uploadedEvidence.originalName}</span>
                  <span className="text-[11px] text-emerald-600">({(uploadedEvidence.fileSize / 1024).toFixed(1)} KB)</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Routing Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3 px-5">
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Approver Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Primary Approver <span className="text-red-500">*</span>
            </label>
            <select
              value={primaryApproverId}
              onChange={(e) => setPrimaryApproverId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
            >
              {eligibleApprovers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email}) — {a.role} {a.isFallback ? "[Superadmin Fallback]" : ""}
                </option>
              ))}
            </select>
            {isFallback && (
              <p className="text-[11px] text-amber-600 mt-1">
                Note: No other active Admin is available. Routing fallback to Superadmin.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              CC Notification Recipients (Optional)
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50">
              {eligibleApprovers
                .filter((a) => a.id !== primaryApproverId && a.id !== currentUserId)
                .map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCcIds.includes(a.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCcIds([...selectedCcIds, a.id]);
                        } else {
                          setSelectedCcIds(selectedCcIds.filter((id) => id !== a.id));
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{a.name} ({a.email})</span>
                  </label>
                ))}
              {eligibleApprovers.filter((a) => a.id !== primaryApproverId && a.id !== currentUserId).length === 0 && (
                <p className="text-[11px] text-slate-400">No additional approvers available for CC.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={loading || uploading}
          className="text-xs font-semibold"
        >
          Save as Draft
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={loading || uploading}
          className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {loading ? "Submitting..." : "Submit for Approval"}
        </Button>
      </div>
    </div>
  );
}
