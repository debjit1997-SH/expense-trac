"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ALL_REPORT_COLUMNS, DEFAULT_COLUMN_IDS } from "@/lib/reports/excel-export";
import {
  Columns,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";

interface CustomizeColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnOrder: string[];
  visibleColumns: string[];
  onChange: (newOrder: string[], newVisible: string[]) => void;
}

const COLUMN_GROUPS = [
  {
    title: "1. Report Identification",
    ids: ["reportNumber", "tagTitle", "tagDescription", "tagStatus", "tagTotal", "itemIndex", "itemCount"],
  },
  {
    title: "2. Expense Item Details",
    ids: [
      "expenseDate",
      "vendorName",
      "invoiceNumber",
      "invoiceDate",
      "itemDescription",
      "categoryName",
      "subcategoryName",
      "documentType",
      "itemAmount",
      "currency",
      "evidenceCount",
    ],
  },
  {
    title: "3. GST & Taxation",
    ids: [
      "gstTreatmentName",
      "vendorGstStatus",
      "vendorGstin",
      "companyGstin",
      "placeOfSupply",
      "hsnSacCode",
      "taxMode",
      "taxableValue",
      "gstRateLabel",
      "cgstRate",
      "cgstAmount",
      "sgstRate",
      "sgstAmount",
      "igstRate",
      "igstAmount",
      "cessAmount",
      "totalGstAmount",
      "reverseCharge",
      "itcEligibility",
      "gstRemarks",
    ],
  },
  {
    title: "4. Workflow & Audit Trail",
    ids: [
      "submittedBy",
      "submitterEmail",
      "submitterRole",
      "createdAt",
      "submittedAt",
      "primaryApprover",
      "approvedBy",
      "approvedAt",
      "reimbursementOwner",
      "reimbursedBy",
      "reimbursedAt",
      "paymentMethod",
      "reimbursementRef",
      "transactionId",
      "lastUpdatedAt",
    ],
  },
];

export function CustomizeColumnsModal({
  isOpen,
  onClose,
  columnOrder,
  visibleColumns,
  onChange,
}: CustomizeColumnsModalProps) {
  const [currentOrder, setCurrentOrder] = useState<string[]>(columnOrder);
  const [currentVisible, setCurrentVisible] = useState<string[]>(visibleColumns);

  const toggleColumn = (id: string) => {
    if (currentVisible.includes(id)) {
      if (currentVisible.length === 1) {
        alert("At least one column must remain visible.");
        return;
      }
      setCurrentVisible(currentVisible.filter((c) => c !== id));
    } else {
      setCurrentVisible([...currentVisible, id]);
    }
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setCurrentOrder(newOrder);
  };

  // Presets
  const applyPreset = (preset: "default" | "all" | "gst" | "workflow") => {
    if (preset === "default") {
      setCurrentOrder(DEFAULT_COLUMN_IDS);
      setCurrentVisible(DEFAULT_COLUMN_IDS);
    } else if (preset === "all") {
      const allIds = Object.keys(ALL_REPORT_COLUMNS);
      setCurrentOrder(allIds);
      setCurrentVisible(allIds);
    } else if (preset === "gst") {
      const gstIds = [
        "reportNumber",
        "tagTitle",
        "expenseDate",
        "vendorName",
        "invoiceNumber",
        "gstTreatmentName",
        "vendorGstin",
        "placeOfSupply",
        "taxableValue",
        "gstRateLabel",
        "cgstAmount",
        "sgstAmount",
        "igstAmount",
        "totalGstAmount",
        "itemAmount",
        "itcEligibility",
      ];
      setCurrentOrder(gstIds);
      setCurrentVisible(gstIds);
    } else if (preset === "workflow") {
      const wfIds = [
        "reportNumber",
        "tagTitle",
        "tagStatus",
        "itemAmount",
        "submittedBy",
        "submittedAt",
        "primaryApprover",
        "approvedBy",
        "approvedAt",
        "reimbursementOwner",
        "reimbursedBy",
        "reimbursedAt",
        "reimbursementRef",
      ];
      setCurrentOrder(wfIds);
      setCurrentVisible(wfIds);
    }
  };

  const handleApply = () => {
    onChange(currentOrder, currentVisible);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Report Columns & Layout"
      description="Choose visible columns, reorder their position, or choose a preset configuration."
      maxWidth="2xl"
    >
      <div className="space-y-4 pt-2">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs">
          <span className="font-bold text-blue-900 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset("default")}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700"
          >
            Standard Default (14 cols)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("gst")}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700"
          >
            GST &amp; Tax Focus (16 cols)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("workflow")}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700"
          >
            Workflow &amp; Audit (13 cols)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("all")}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 font-semibold text-slate-700"
          >
            All Columns (42 cols)
          </button>
        </div>

        {/* Grouped Column Checkboxes */}
        <div className="max-h-80 overflow-y-auto pr-2 space-y-4 border border-slate-200 rounded-lg p-3 bg-white">
          {COLUMN_GROUPS.map((grp) => (
            <div key={grp.title} className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1 uppercase tracking-wide">
                {grp.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {grp.ids.map((id) => {
                  const col = ALL_REPORT_COLUMNS[id];
                  if (!col) return null;
                  const isVisible = currentVisible.includes(id);

                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                        isVisible
                          ? "bg-blue-50/80 border border-blue-200 text-blue-900 font-semibold"
                          : "hover:bg-slate-50 border border-transparent text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumn(id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{col.header}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            {currentVisible.length} of {Object.keys(ALL_REPORT_COLUMNS).length} columns visible
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply Column Layout
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
