"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { saveGstTreatmentAction, saveGstRateAction } from "@/actions/master.actions";
import { Percent, Plus, Edit2, CheckCircle2, AlertCircle, Calculator } from "lucide-react";

interface GstTreatmentItem {
  id: string;
  name: string;
  code: string;
  isTaxable: boolean;
  isActive: boolean;
  _count: { expenseItems: number };
}

interface GstRateItem {
  id: string;
  ratePercent: any;
  label: string;
  isActive: boolean;
  _count: { expenseItems: number };
}

export function GstClientView({
  initialTreatments,
  initialRates,
}: {
  initialTreatments: GstTreatmentItem[];
  initialRates: GstRateItem[];
}) {
  const router = useRouter();

  // Treatment Modal States
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<GstTreatmentItem | null>(null);
  const [treatmentName, setTreatmentName] = useState("");
  const [treatmentCode, setTreatmentCode] = useState("");
  const [treatmentIsTaxable, setTreatmentIsTaxable] = useState(true);

  // Rate Modal States
  const [showRateModal, setShowRateModal] = useState(false);
  const [editingRate, setEditingRate] = useState<GstRateItem | null>(null);
  const [ratePercent, setRatePercent] = useState<string>("");
  const [rateLabel, setRateLabel] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await saveGstTreatmentAction({
        id: editingTreatment?.id,
        name: treatmentName.trim(),
        code: treatmentCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        isTaxable: treatmentIsTaxable,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save treatment.");
      } else {
        setShowTreatmentModal(false);
        setEditingTreatment(null);
        setTreatmentName("");
        setTreatmentCode("");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await saveGstRateAction({
        id: editingRate?.id,
        ratePercent: parseFloat(ratePercent),
        label: rateLabel.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save rate.");
      } else {
        setShowRateModal(false);
        setEditingRate(null);
        setRatePercent("");
        setRateLabel("");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. GST Treatments */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              GST Treatments ({initialTreatments.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Defines taxable classification and GST invoice rules
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingTreatment(null);
              setTreatmentName("");
              setTreatmentCode("");
              setTreatmentIsTaxable(true);
              setShowTreatmentModal(true);
            }}
            className="text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add GST Treatment
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Treatment Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Taxability</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Usage</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {initialTreatments.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{t.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{t.code}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={t.isTaxable ? "info" : "secondary"}>
                        {t.isTaxable ? "TAXABLE" : "NON-TAXABLE / EXEMPT"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={t.isActive ? "success" : "secondary"}>
                        {t.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {t._count.expenseItems} expenses
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setEditingTreatment(t);
                          setTreatmentName(t.name);
                          setTreatmentCode(t.code);
                          setTreatmentIsTaxable(t.isTaxable);
                          setShowTreatmentModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                        title="Edit Treatment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 2. GST Rates */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/70 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-600" />
              GST Tax Rates ({initialRates.length})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Configured GST rate slabs applied to taxable expenses
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingRate(null);
              setRatePercent("");
              setRateLabel("");
              setShowRateModal(true);
            }}
            className="text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add GST Rate
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rate Label</th>
                  <th className="py-3 px-4">Rate Percentage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Usage</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {initialRates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{r.label}</td>
                    <td className="py-3.5 px-4 font-mono text-sm font-semibold text-blue-700">
                      {Number(r.ratePercent).toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={r.isActive ? "success" : "secondary"}>
                        {r.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {r._count.expenseItems} expenses
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setEditingRate(r);
                          setRatePercent(String(r.ratePercent));
                          setRateLabel(r.label);
                          setShowRateModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                        title="Edit Rate"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* GST Treatment Modal */}
      <Modal
        isOpen={showTreatmentModal}
        onClose={() => setShowTreatmentModal(false)}
        title={editingTreatment ? "Edit GST Treatment" : "Add GST Treatment"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveTreatment} className="space-y-4 pt-2">
          <Input
            label="Treatment Name"
            required
            placeholder="e.g. TAXABLE UNDER GST, COMPOSITION DEALER"
            value={treatmentName}
            onChange={(e) => {
              setTreatmentName(e.target.value);
              if (!editingTreatment) {
                setTreatmentCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "_"));
              }
            }}
          />

          <Input
            label="Treatment Code"
            required
            placeholder="e.g. TAXABLE_UNDER_GST"
            value={treatmentCode}
            onChange={(e) => setTreatmentCode(e.target.value.toUpperCase())}
          />

          <div className="pt-1">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={treatmentIsTaxable}
                onChange={(e) => setTreatmentIsTaxable(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span>Is Taxable (Enables GST tax breakdown fields)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTreatmentModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Save Treatment
            </Button>
          </div>
        </form>
      </Modal>

      {/* GST Rate Modal */}
      <Modal
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        title={editingRate ? "Edit GST Rate" : "Add GST Rate"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveRate} className="space-y-4 pt-2">
          <Input
            type="number"
            step="0.01"
            label="Rate Percentage (e.g. 18.00)"
            required
            placeholder="18"
            value={ratePercent}
            onChange={(e) => {
              setRatePercent(e.target.value);
              if (!editingRate) {
                setRateLabel(`${e.target.value}%`);
              }
            }}
          />

          <Input
            label="Display Label"
            required
            placeholder="18%"
            value={rateLabel}
            onChange={(e) => setRateLabel(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRateModal(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isProcessing}>
              Save Rate
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
