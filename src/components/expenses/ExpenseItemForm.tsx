"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ReceiptUploadDropzone, UploadedEvidenceInfo } from "./ReceiptUploadDropzone";
import { OcrExtractionResult } from "@/lib/ocr/types";
import { ExpenseItemInput } from "@/lib/validations/expense.schema";
import { Sparkles, Check, Calculator, RefreshCw } from "lucide-react";

export interface MasterCategory {
  id: string;
  code: string;
  name: string;
  subcategories: { id: string; code: string; name: string }[];
}

export interface MasterGstTreatment {
  id: string;
  code: string;
  name: string;
  isTaxable: boolean;
}

export interface MasterGstRate {
  id: string;
  ratePercent: any;
  label: string;
}

interface ExpenseItemFormProps {
  reportId: string;
  categories: MasterCategory[];
  gstTreatments: MasterGstTreatment[];
  gstRates: MasterGstRate[];
  initialItem?: Partial<ExpenseItemInput> | null;
  onSave: (item: ExpenseItemInput, options?: { allowDuplicate?: boolean }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ExpenseItemForm({
  reportId,
  categories,
  gstTreatments,
  gstRates,
  initialItem = null,
  onSave,
  onCancel,
  isLoading = false,
}: ExpenseItemFormProps) {
  // Submission lock to prevent double clicks
  const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);

  // Form States
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [currency] = useState("INR");

  // GST States
  const [gstTreatmentId, setGstTreatmentId] = useState("");
  const [gstRateId, setGstRateId] = useState("");
  const [documentType, setDocumentType] = useState("TAX_INVOICE");
  const [vendorGstStatus, setVendorGstStatus] = useState<any>("REGISTERED_REGULAR");
  const [vendorGstin, setVendorGstin] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("West Bengal (19)");
  const [hsnSacCode, setHsnSacCode] = useState("");
  const [taxableValue, setTaxableValue] = useState<string>("");
  const [taxMode, setTaxMode] = useState<"INTRA_STATE" | "INTER_STATE">("INTRA_STATE");
  const [cgstRate, setCgstRate] = useState<string>("9.00");
  const [cgstAmount, setCgstAmount] = useState<string>("0.00");
  const [sgstRate, setSgstRate] = useState<string>("9.00");
  const [sgstAmount, setSgstAmount] = useState<string>("0.00");
  const [igstRate, setIgstRate] = useState<string>("0.00");
  const [igstAmount, setIgstAmount] = useState<string>("0.00");
  const [cessAmount, setCessAmount] = useState<string>("0.00");
  const [totalGstAmount, setTotalGstAmount] = useState<string>("0.00");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [itcEligibility, setItcEligibility] = useState<any>("PENDING_REVIEW");
  const [gstRemarks, setGstRemarks] = useState("");

  // Evidence state
  const [evidence, setEvidence] = useState<UploadedEvidenceInfo | null>(null);

  // Auto-detection tracking for visual pills
  const [detectedFields, setDetectedFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset form to pristine defaults
  const resetToDefaults = useCallback(() => {
    const defaultCat = categories[0]?.id || "";
    const defaultSub = categories[0]?.subcategories[0]?.id || "";
    const defaultTreatment = gstTreatments[0]?.id || "";
    const defaultRate =
      gstRates.find((r) => Number(r.ratePercent) === 18)?.id || gstRates[0]?.id || "";

    setExpenseDate(new Date().toISOString().split("T")[0]);
    setVendorName("");
    setInvoiceNumber("");
    setInvoiceDate("");
    setDescription("");
    setCategoryId(defaultCat);
    setSubcategoryId(defaultSub);
    setTotalAmount("");

    setGstTreatmentId(defaultTreatment);
    setGstRateId(defaultRate);
    setDocumentType("TAX_INVOICE");
    setVendorGstStatus("REGISTERED_REGULAR");
    setVendorGstin("");
    setCompanyGstin("");
    setPlaceOfSupply("West Bengal (19)");
    setHsnSacCode("");
    setTaxableValue("");
    setTaxMode("INTRA_STATE");
    setCgstRate("9.00");
    setCgstAmount("0.00");
    setSgstRate("9.00");
    setSgstAmount("0.00");
    setIgstRate("0.00");
    setIgstAmount("0.00");
    setCessAmount("0.00");
    setTotalGstAmount("0.00");
    setReverseCharge(false);
    setItcEligibility("PENDING_REVIEW");
    setGstRemarks("");

    setEvidence(null);
    setDetectedFields(new Set());
    setValidationErrors({});
    setIsSubmittingInternal(false);
  }, [categories, gstTreatments, gstRates]);

  // Load initialItem or reset when initialItem changes
  useEffect(() => {
    if (initialItem && initialItem.id) {
      // EDIT MODE
      setExpenseDate(
        initialItem.expenseDate
          ? new Date(initialItem.expenseDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setVendorName(initialItem.vendorName || "");
      setInvoiceNumber(initialItem.invoiceNumber || "");
      setInvoiceDate(
        initialItem.invoiceDate
          ? new Date(initialItem.invoiceDate).toISOString().split("T")[0]
          : ""
      );
      setDescription(initialItem.description || "");
      setCategoryId(initialItem.categoryId || (categories[0]?.id || ""));
      setSubcategoryId(initialItem.subcategoryId || "");
      setTotalAmount(initialItem.totalAmount ? String(initialItem.totalAmount) : "");

      setGstTreatmentId(initialItem.gstTreatmentId || (gstTreatments[0]?.id || ""));
      setGstRateId(
        initialItem.gstRateId ||
          (gstRates.find((r) => Number(r.ratePercent) === 18)?.id || gstRates[0]?.id || "")
      );
      setDocumentType(initialItem.documentType || "TAX_INVOICE");
      setVendorGstStatus(initialItem.vendorGstStatus || "REGISTERED_REGULAR");
      setVendorGstin(initialItem.vendorGstin || "");
      setCompanyGstin(initialItem.companyGstin || "");
      setPlaceOfSupply(initialItem.placeOfSupply || "West Bengal (19)");
      setHsnSacCode(initialItem.hsnSacCode || "");
      setTaxableValue(initialItem.taxableValue ? String(initialItem.taxableValue) : "");
      setTaxMode(initialItem.taxMode || "INTRA_STATE");
      setCgstRate(initialItem.cgstRate ? String(initialItem.cgstRate) : "9.00");
      setCgstAmount(initialItem.cgstAmount ? String(initialItem.cgstAmount) : "0.00");
      setSgstRate(initialItem.sgstRate ? String(initialItem.sgstRate) : "9.00");
      setSgstAmount(initialItem.sgstAmount ? String(initialItem.sgstAmount) : "0.00");
      setIgstRate(initialItem.igstRate ? String(initialItem.igstRate) : "0.00");
      setIgstAmount(initialItem.igstAmount ? String(initialItem.igstAmount) : "0.00");
      setCessAmount(initialItem.cessAmount ? String(initialItem.cessAmount) : "0.00");
      setTotalGstAmount(initialItem.totalGstAmount ? String(initialItem.totalGstAmount) : "0.00");
      setReverseCharge(Boolean(initialItem.reverseCharge));
      setItcEligibility(initialItem.itcEligibility || "PENDING_REVIEW");
      setGstRemarks(initialItem.gstRemarks || "");

      setEvidence((initialItem as any).evidence || null);
      setDetectedFields(new Set());
      setValidationErrors({});
    } else {
      // CREATE MODE: Reset completely
      resetToDefaults();
    }
  }, [initialItem, resetToDefaults, categories, gstTreatments, gstRates]);

  // Current active subcategories list
  const currentCategory = categories.find((c) => c.id === categoryId);
  const availableSubcategories = currentCategory?.subcategories || [];

  // Update default subcategory when category changes
  useEffect(() => {
    if (availableSubcategories.length > 0) {
      if (!subcategoryId || !availableSubcategories.find((s) => s.id === subcategoryId)) {
        setSubcategoryId(availableSubcategories[0].id);
      }
    }
  }, [categoryId, availableSubcategories, subcategoryId]);

  // Selected treatment object
  const selectedTreatment = gstTreatments.find((t) => t.id === gstTreatmentId);
  const isTaxableTreatment = selectedTreatment?.isTaxable ?? true;

  // Selected rate numeric value
  const selectedRateObj = gstRates.find((r) => r.id === gstRateId);
  const selectedRatePercent = selectedRateObj ? Number(selectedRateObj.ratePercent) : 0;

  // Auto calculate GST breakdowns
  const calculateGst = useCallback(() => {
    const taxable = parseFloat(taxableValue) || 0;
    if (taxable <= 0 || !isTaxableTreatment) {
      setCgstAmount("0.00");
      setSgstAmount("0.00");
      setIgstAmount("0.00");
      setTotalGstAmount("0.00");
      return;
    }

    const cess = parseFloat(cessAmount) || 0;

    if (taxMode === "INTRA_STATE") {
      const halfRate = selectedRatePercent / 2;
      const cgstVal = (taxable * halfRate) / 100;
      const sgstVal = (taxable * halfRate) / 100;
      const totalGst = cgstVal + sgstVal + cess;

      setCgstRate(halfRate.toFixed(2));
      setCgstAmount(cgstVal.toFixed(2));
      setSgstRate(halfRate.toFixed(2));
      setSgstAmount(sgstVal.toFixed(2));
      setIgstRate("0.00");
      setIgstAmount("0.00");
      setTotalGstAmount(totalGst.toFixed(2));

      if (!totalAmount || parseFloat(totalAmount) === 0) {
        setTotalAmount((taxable + totalGst).toFixed(2));
      }
    } else {
      const igstVal = (taxable * selectedRatePercent) / 100;
      const totalGst = igstVal + cess;

      setCgstRate("0.00");
      setCgstAmount("0.00");
      setSgstRate("0.00");
      setSgstAmount("0.00");
      setIgstRate(selectedRatePercent.toFixed(2));
      setIgstAmount(igstVal.toFixed(2));
      setTotalGstAmount(totalGst.toFixed(2));

      if (!totalAmount || parseFloat(totalAmount) === 0) {
        setTotalAmount((taxable + totalGst).toFixed(2));
      }
    }
  }, [taxableValue, isTaxableTreatment, cessAmount, taxMode, selectedRatePercent, totalAmount]);

  useEffect(() => {
    calculateGst();
  }, [calculateGst]);

  // Handle OCR Extraction suggestions
  const handleOcrData = (ocr: OcrExtractionResult) => {
    const newDetected = new Set<string>();

    if (ocr.vendorName) {
      setVendorName(ocr.vendorName);
      newDetected.add("vendorName");
    }
    if (ocr.invoiceNumber) {
      setInvoiceNumber(ocr.invoiceNumber);
      newDetected.add("invoiceNumber");
    }
    if (ocr.invoiceDate) {
      setInvoiceDate(ocr.invoiceDate);
      setExpenseDate(ocr.invoiceDate);
      newDetected.add("invoiceDate");
    }
    if (ocr.totalAmount) {
      setTotalAmount(ocr.totalAmount.toFixed(2));
      newDetected.add("totalAmount");
    }
    if (ocr.vendorGstin) {
      setVendorGstin(ocr.vendorGstin);
      setVendorGstStatus("REGISTERED_REGULAR");
      newDetected.add("vendorGstin");
    }
    if (ocr.taxableValue) {
      setTaxableValue(ocr.taxableValue.toFixed(2));
      newDetected.add("taxableValue");
    }
    if (ocr.gstRate) {
      const matchedRate = gstRates.find((r) => Number(r.ratePercent) === ocr.gstRate);
      if (matchedRate) {
        setGstRateId(matchedRate.id);
        newDetected.add("gstRate");
      }
    }
    if (ocr.igstAmount && ocr.igstAmount > 0) {
      setTaxMode("INTER_STATE");
      setIgstAmount(ocr.igstAmount.toFixed(2));
      newDetected.add("igstAmount");
    } else if (ocr.cgstAmount || ocr.sgstAmount) {
      setTaxMode("INTRA_STATE");
      if (ocr.cgstAmount) setCgstAmount(ocr.cgstAmount.toFixed(2));
      if (ocr.sgstAmount) setSgstAmount(ocr.sgstAmount.toFixed(2));
      newDetected.add("cgstAmount");
    }

    setDetectedFields(newDetected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingInternal || isLoading) return;

    setValidationErrors({});

    const errors: Record<string, string> = {};

    if (!vendorName.trim()) errors.vendorName = "Vendor / Merchant Name is required";
    if (!expenseDate) errors.expenseDate = "Expense Date is required";
    if (!totalAmount || parseFloat(totalAmount) <= 0)
      errors.totalAmount = "Valid total amount is required";

    const currentSub = availableSubcategories.find((s) => s.id === subcategoryId);
    if (
      (currentCategory?.code === "MISCELLANEOUS" || currentSub?.code === "OTHER") &&
      (!description || description.trim().length < 5)
    ) {
      errors.description =
        "Detailed business description (at least 5 characters) is mandatory for OTHER expenses";
    } else if (!description.trim()) {
      errors.description = "Expense description is required";
    }

    // GSTIN format validation if provided
    if (vendorGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(vendorGstin)) {
      errors.vendorGstin = "Invalid GSTIN format (e.g. 27AAAAA0000A1Z5)";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const payload: ExpenseItemInput = {
      id: initialItem?.id,
      reportId,
      expenseDate,
      vendorName: vendorName.trim(),
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate || null,
      description: description.trim(),
      categoryId,
      subcategoryId,
      categoryCode: currentCategory?.code,
      subcategoryCode: currentSub?.code,
      totalAmount: parseFloat(totalAmount),
      currency,

      gstTreatmentId: gstTreatmentId || null,
      gstRateId: isTaxableTreatment ? gstRateId || null : null,
      documentType: isTaxableTreatment ? documentType : null,
      vendorGstStatus: isTaxableTreatment ? vendorGstStatus : null,
      vendorGstin: isTaxableTreatment && vendorGstin ? vendorGstin.toUpperCase().trim() : null,
      companyGstin: companyGstin ? companyGstin.toUpperCase().trim() : null,
      placeOfSupply: isTaxableTreatment ? placeOfSupply : null,
      hsnSacCode: isTaxableTreatment && hsnSacCode ? hsnSacCode.trim() : null,
      taxableValue: isTaxableTreatment && taxableValue ? parseFloat(taxableValue) : null,
      taxMode: isTaxableTreatment ? taxMode : null,
      cgstRate: isTaxableTreatment && taxMode === "INTRA_STATE" ? parseFloat(cgstRate) : null,
      cgstAmount: isTaxableTreatment && taxMode === "INTRA_STATE" ? parseFloat(cgstAmount) : null,
      sgstRate: isTaxableTreatment && taxMode === "INTRA_STATE" ? parseFloat(sgstRate) : null,
      sgstAmount: isTaxableTreatment && taxMode === "INTRA_STATE" ? parseFloat(sgstAmount) : null,
      igstRate: isTaxableTreatment && taxMode === "INTER_STATE" ? parseFloat(igstRate) : null,
      igstAmount: isTaxableTreatment && taxMode === "INTER_STATE" ? parseFloat(igstAmount) : null,
      cessAmount: isTaxableTreatment && cessAmount ? parseFloat(cessAmount) : null,
      totalGstAmount: isTaxableTreatment && totalGstAmount ? parseFloat(totalGstAmount) : null,
      reverseCharge,
      itcEligibility: isTaxableTreatment ? itcEligibility : "NOT_APPLICABLE",
      gstRemarks: gstRemarks.trim() || null,

      evidence: evidence
        ? {
            originalName: evidence.originalName,
            mimeType: evidence.mimeType,
            fileSize: evidence.fileSize,
            storagePath: evidence.storagePath,
            ocrConfidence: evidence.ocrConfidence,
            ocrRawResponse: evidence.ocrRawResponse,
          }
        : null,
    };

    try {
      setIsSubmittingInternal(true);
      await onSave(payload);
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Receipt Upload & OCR Analysis */}
      <Card className="border-blue-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              1. Receipt or Supporting Document
            </CardTitle>
            <span className="text-xs text-slate-500 font-medium">
              OCR suggestion enabled
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ReceiptUploadDropzone
            onUploaded={(ev) => setEvidence(ev)}
            onOcrExtracted={handleOcrData}
            onCleared={() => setEvidence(null)}
            currentEvidence={evidence}
          />
        </CardContent>
      </Card>

      {/* 2. Basic Expense Details */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/60 flex items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800">
            2. Basic Expense Information
          </CardTitle>
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
            title="Reset form fields"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Fields
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Vendor / Merchant Name"
              required
              placeholder="e.g. Indigo Airlines, Uber, Taj Hotels, Amazon"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              error={validationErrors.vendorName}
              isSuggested={detectedFields.has("vendorName")}
            />
            <Input
              type="date"
              label="Expense Date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              error={validationErrors.expenseDate}
              isSuggested={detectedFields.has("invoiceDate")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Invoice / Bill Number"
              placeholder="e.g. INV-98234"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              isSuggested={detectedFields.has("invoiceNumber")}
            />
            <Input
              type="date"
              label="Invoice Date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              isSuggested={detectedFields.has("invoiceDate")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Category"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name.toUpperCase(),
              }))}
            />
            <Select
              label="Subcategory"
              required
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              options={availableSubcategories.map((s) => ({
                value: s.id,
                label: s.name.toUpperCase(),
              }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              step="0.01"
              label="Total Expense Amount (₹ INR)"
              required
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              error={validationErrors.totalAmount}
              isSuggested={detectedFields.has("totalAmount")}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide">
                Currency
              </label>
              <div className="h-10 px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm text-slate-700 font-medium flex items-center">
                INR (₹) - Indian Rupee
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 tracking-wide">
              Expense Description / Business Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              className={`w-full rounded-md border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.description ? "border-red-500" : "border-slate-300"
              }`}
              rows={2}
              placeholder="Describe the business purpose of this expense..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {validationErrors.description && (
              <p className="text-xs text-red-600 font-medium">
                {validationErrors.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. GST Details & Breakdown */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 bg-slate-50/60 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            3. GST Information &amp; Tax Breakdown
          </CardTitle>
          <span className="text-xs text-slate-500">
            {isTaxableTreatment ? "Taxable Master Applied" : "Non-Taxable / Exempt Master"}
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="GST Treatment"
              value={gstTreatmentId}
              onChange={(e) => setGstTreatmentId(e.target.value)}
              options={gstTreatments.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
            {isTaxableTreatment ? (
              <Select
                label="GST Rate"
                value={gstRateId}
                onChange={(e) => setGstRateId(e.target.value)}
                isSuggested={detectedFields.has("gstRate")}
                options={gstRates.map((r) => ({
                  value: r.id,
                  label: `${r.label} (${r.ratePercent}%)`,
                }))}
              />
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 tracking-wide">
                  GST Rate
                </label>
                <div className="h-10 px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-500 flex items-center">
                  Not applicable for this treatment
                </div>
              </div>
            )}
          </div>

          {isTaxableTreatment && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Vendor GST Registration"
                  value={vendorGstStatus}
                  onChange={(e) => setVendorGstStatus(e.target.value as any)}
                  options={[
                    { value: "REGISTERED_REGULAR", label: "Registered Regular" },
                    { value: "REGISTERED_COMPOSITION", label: "Composition Dealer" },
                    { value: "UNREGISTERED", label: "Unregistered Vendor" },
                    { value: "OVERSEAS", label: "Overseas / Import" },
                  ]}
                />
                <Input
                  label="Vendor GSTIN"
                  placeholder="27AAAAA0000A1Z5"
                  value={vendorGstin}
                  onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                  error={validationErrors.vendorGstin}
                  isSuggested={detectedFields.has("vendorGstin")}
                />
                <Input
                  label="Place of Supply (State / Code)"
                  placeholder="e.g. West Bengal (19)"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="HSN / SAC Code"
                  placeholder="e.g. 998314"
                  value={hsnSacCode}
                  onChange={(e) => setHsnSacCode(e.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  label="Taxable Value (₹)"
                  placeholder="0.00"
                  value={taxableValue}
                  onChange={(e) => setTaxableValue(e.target.value)}
                  isSuggested={detectedFields.has("taxableValue")}
                />
                <Select
                  label="Tax Mode"
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as any)}
                  options={[
                    { value: "INTRA_STATE", label: "Intra-State (CGST + SGST)" },
                    { value: "INTER_STATE", label: "Inter-State (IGST)" },
                  ]}
                />
              </div>

              {/* Dynamic Tax Breakdown Calculations */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Calculated Tax Split
                </div>
                {taxMode === "INTRA_STATE" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">CGST Rate:</span>
                      <span className="font-semibold text-slate-800">{cgstRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">CGST Amount:</span>
                      <span className="font-semibold text-slate-800">₹{cgstAmount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">SGST / UTGST Rate:</span>
                      <span className="font-semibold text-slate-800">{sgstRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">SGST / UTGST Amount:</span>
                      <span className="font-semibold text-slate-800">₹{sgstAmount}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">IGST Rate:</span>
                      <span className="font-semibold text-slate-800">{igstRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">IGST Amount:</span>
                      <span className="font-semibold text-slate-800">₹{igstAmount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cess Amount:</span>
                      <span className="font-semibold text-slate-800">₹{cessAmount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total GST:</span>
                      <span className="font-bold text-blue-700">₹{totalGstAmount}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <Select
                  label="ITC Eligibility"
                  value={itcEligibility}
                  onChange={(e) => setItcEligibility(e.target.value as any)}
                  options={[
                    { value: "PENDING_REVIEW", label: "PENDING REVIEW (Default)" },
                    { value: "ELIGIBLE", label: "ELIGIBLE" },
                    { value: "INELIGIBLE", label: "INELIGIBLE" },
                    { value: "NOT_APPLICABLE", label: "NOT APPLICABLE" },
                  ]}
                />
                <div className="flex items-center space-x-3 pt-6">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reverseCharge}
                      onChange={(e) => setReverseCharge(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Reverse Charge Applicable (RCM)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              GST Remarks (Optional)
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Standard ITC claimed, business travel expense"
              value={gstRemarks}
              onChange={(e) => setGstRemarks(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Submission Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading || isSubmittingInternal}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading || isSubmittingInternal}
          disabled={isLoading || isSubmittingInternal}
        >
          <Check className="w-4 h-4 mr-1.5" />
          Save Expense Item
        </Button>
      </div>
    </form>
  );
}
