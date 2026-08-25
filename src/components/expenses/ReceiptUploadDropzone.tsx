"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { OcrExtractionResult } from "@/lib/ocr/types";

export interface UploadedEvidenceInfo {
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  ocrConfidence?: number | null;
  ocrRawResponse?: string | null;
}

interface ReceiptUploadDropzoneProps {
  onUploaded: (evidence: UploadedEvidenceInfo) => void;
  onOcrExtracted?: (ocr: OcrExtractionResult) => void;
  onCleared?: () => void;
  currentEvidence?: UploadedEvidenceInfo | null;
}

export function ReceiptUploadDropzone({
  onUploaded,
  onOcrExtracted,
  onCleared,
  currentEvidence,
}: ReceiptUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setOcrStatus(null);

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds 10MB limit.");
      return;
    }

    try {
      setIsUploading(true);
      setOcrStatus("Uploading document & analyzing with OCR...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }

      const evidence: UploadedEvidenceInfo = {
        originalName: data.evidence.originalName,
        mimeType: data.evidence.mimeType,
        fileSize: data.evidence.fileSize,
        storagePath: data.evidence.storagePath,
        ocrConfidence: data.ocr?.confidence || null,
        ocrRawResponse: data.ocr?.rawResponse || null,
      };

      onUploaded(evidence);

      if (data.ocr && onOcrExtracted) {
        setOcrStatus("✨ OCR successfully extracted invoice details!");
        onOcrExtracted(data.ocr);
      } else {
        setOcrStatus("File uploaded successfully.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload receipt.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  if (currentEvidence) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-md text-emerald-700">
              <File className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 line-clamp-1">
                {currentEvidence.originalName}
              </p>
              <p className="text-xs text-slate-500">
                {(currentEvidence.fileSize / 1024).toFixed(1)} KB &bull; {currentEvidence.mimeType}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={`/api/storage/view?path=${encodeURIComponent(currentEvidence.storagePath)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
            >
              View Receipt
            </a>
            {onCleared && (
              <button
                type="button"
                onClick={onCleared}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-white"
                title="Remove evidence"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {ocrStatus && (
          <p className="text-xs text-emerald-700 font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {ocrStatus}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50/50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
        />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-medium text-slate-700">{ocrStatus}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-white rounded-full shadow-sm border border-slate-100 mb-2">
              <UploadCloud className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Click or drag &amp; drop receipt file
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports JPG, PNG, WEBP, PDF up to 10MB &bull; Automatic OCR Extraction
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
          <AlertCircle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
