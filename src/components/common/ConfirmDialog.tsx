"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning" | "success";
  askReason?: boolean;
  reasonPlaceholder?: string;
  requireReason?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  askReason = false,
  reasonPlaceholder = "Add an optional reason / remark...",
  requireReason = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;
    await onConfirm(reason.trim() || undefined);
    setReason("");
  };

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-6 w-6 text-amber-600" />;
      case "success":
        return <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
      default:
        return <Info className="h-6 w-6 text-blue-600" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-slate-100 shrink-0">{getIcon()}</div>
          <div>
            <h4 className="text-base font-bold text-slate-900">{title}</h4>
            <p className="text-sm text-slate-600 mt-1">{message}</p>
          </div>
        </div>

        {askReason && (
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-slate-700">
              Reason / Remark {requireReason && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="w-full rounded-md border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "warning" ? "primary" : variant}
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={requireReason && !reason.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
