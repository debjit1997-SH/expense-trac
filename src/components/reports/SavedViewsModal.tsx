"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  saveViewPreferenceAction,
  deleteViewPreferenceAction,
  setDefaultViewPreferenceAction,
} from "@/actions/report.actions";
import { Bookmark, Star, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { DateDisplay } from "@/components/common/DateDisplay";

export interface SavedViewItem {
  id: string;
  name: string;
  isDefault: boolean;
  columnConfig: any;
  filterConfig?: any;
  sortConfig?: any;
  createdAt: string;
}

interface SavedViewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedViews: SavedViewItem[];
  currentColumnConfig: any;
  currentFilterConfig?: any;
  currentSortConfig?: any;
  onLoadView: (view: SavedViewItem) => void;
  onViewsUpdated: () => void;
}

export function SavedViewsModal({
  isOpen,
  onClose,
  savedViews,
  currentColumnConfig,
  currentFilterConfig,
  currentSortConfig,
  onLoadView,
  onViewsUpdated,
}: SavedViewsModalProps) {
  const [viewName, setViewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) {
      setError("Please enter a name for your saved view.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const res = await saveViewPreferenceAction({
        name: viewName.trim(),
        columnConfig: currentColumnConfig,
        filterConfig: currentFilterConfig,
        sortConfig: currentSortConfig,
        isDefault,
      });

      if (!res.success) {
        setError(res.error || "Failed to save view.");
      } else {
        setViewName("");
        setIsDefault(false);
        onViewsUpdated();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save view.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this saved view?")) return;
    await deleteViewPreferenceAction(id);
    onViewsUpdated();
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultViewPreferenceAction(id);
    onViewsUpdated();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Report Views & Layouts"
      description="Save your custom column order, visible columns, and filters for instant 1-click loading."
      maxWidth="lg"
    >
      <div className="space-y-5 pt-2">
        {/* Create New Saved View Form */}
        <form onSubmit={handleSave} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            Save Current Grid Layout &amp; Filters
          </h4>

          {error && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Input
              placeholder="e.g. Month-End GST Tax Audit View"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="text-xs flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              className="text-xs bg-blue-600 hover:bg-blue-700 shrink-0"
            >
              Save View
            </Button>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Set as my default landing view for Detailed Expense Report</span>
          </label>
        </form>

        {/* Existing Saved Views List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-600 uppercase">
            Your Saved Views ({savedViews.length})
          </h4>

          {savedViews.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-md">
              No saved views created yet.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 truncate">{view.name}</span>
                      {view.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Created: <DateDisplay date={view.createdAt} />
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onLoadView(view);
                        onClose();
                      }}
                      className="text-xs h-7 px-2.5 bg-blue-600 hover:bg-blue-700"
                    >
                      Load View
                    </Button>

                    {!view.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(view.id)}
                        className="text-xs h-7 px-2"
                        title="Make Default"
                      >
                        <Star className="w-3 h-3 text-slate-500" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(view.id)}
                      className="text-xs h-7 px-2 text-red-600 hover:bg-red-50 border-red-200"
                      title="Delete View"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
