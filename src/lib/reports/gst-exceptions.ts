import { TaxMode, ItcEligibility, VendorGstStatus } from "@prisma/client";

export type GstExceptionSeverity = "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type GstExceptionCode =
  | "INVALID_GSTIN"
  | "MISSING_GSTIN"
  | "MISSING_INVOICE_NUMBER"
  | "MISSING_INVOICE_DATE"
  | "MISSING_TAXABLE_VALUE"
  | "MISSING_GST_RATE"
  | "MISSING_HSN_SAC"
  | "MISSING_PLACE_OF_SUPPLY"
  | "TAX_COMPONENT_CONFLICT"
  | "INTRA_STATE_WITH_IGST"
  | "INTER_STATE_WITH_CGST_SGST"
  | "GST_CALC_INCONSISTENCY"
  | "GROSS_TOTAL_INCONSISTENCY"
  | "TAX_ON_NON_GST"
  | "PENDING_ITC_REVIEW"
  | "DUPLICATE_INVOICE"
  | "RCM_INCOMPLETE"
  | "MISSING_EVIDENCE";

export interface GstExceptionItem {
  code: GstExceptionCode;
  severity: GstExceptionSeverity;
  title: string;
  message: string;
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface RawGstItemForValidation {
  id: string;
  reportId: string;
  reportNumber: string;
  vendorName: string;
  vendorGstin?: string | null;
  vendorGstStatus?: VendorGstStatus | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  documentType?: string | null;
  gstTreatmentCode?: string | null;
  gstTreatmentName?: string | null;
  isTaxableTreatment?: boolean;
  hsnSacCode?: string | null;
  placeOfSupply?: string | null;
  taxMode?: TaxMode | null;
  taxableValue: number;
  gstRatePercent?: number | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalGstAmount: number;
  totalAmount: number;
  reverseCharge: boolean;
  itcEligibility: ItcEligibility;
  evidenceCount: number;
}

/**
 * Non-destructive server-side data-quality exception detection engine
 */
export function evaluateGstItemExceptions(
  item: RawGstItemForValidation,
  duplicateInvoiceKeys: Set<string>
): GstExceptionItem[] {
  const exceptions: GstExceptionItem[] = [];

  const isTaxable = item.isTaxableTreatment !== false && item.totalGstAmount > 0;
  const isRegisteredVendor =
    item.vendorGstStatus === VendorGstStatus.REGISTERED_REGULAR ||
    item.vendorGstStatus === VendorGstStatus.REGISTERED_COMPOSITION;

  // 1. Invalid GSTIN Format
  if (item.vendorGstin?.trim()) {
    const cleanGstin = item.vendorGstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(cleanGstin)) {
      exceptions.push({
        code: "INVALID_GSTIN",
        severity: "HIGH",
        title: "Invalid GSTIN Format",
        message: `Vendor GSTIN "${cleanGstin}" does not match standard 15-character GSTIN structure.`,
      });
    }
  }

  // 2. Missing GSTIN for Taxable Registered-Vendor Invoice
  if (isRegisteredVendor && !item.vendorGstin?.trim() && item.totalAmount > 0) {
    exceptions.push({
      code: "MISSING_GSTIN",
      severity: "HIGH",
      title: "Missing Vendor GSTIN",
      message: "Vendor is marked as Registered Regular/Composition but no GSTIN is provided.",
    });
  }

  // 3. Missing Invoice Number
  if (!item.invoiceNumber?.trim() && item.totalAmount > 0) {
    exceptions.push({
      code: "MISSING_INVOICE_NUMBER",
      severity: "MEDIUM",
      title: "Missing Invoice Number",
      message: "Expense item does not have an invoice / reference number entered.",
    });
  }

  // 4. Missing Invoice Date
  if (!item.invoiceDate) {
    exceptions.push({
      code: "MISSING_INVOICE_DATE",
      severity: "MEDIUM",
      title: "Missing Invoice Date",
      message: "Invoice date is blank or missing.",
    });
  }

  // 5. Missing Taxable Value on Taxable item
  if (item.totalGstAmount > 0 && (!item.taxableValue || item.taxableValue <= 0)) {
    exceptions.push({
      code: "MISSING_TAXABLE_VALUE",
      severity: "HIGH",
      title: "Missing Taxable Value",
      message: "GST taxes are entered but Taxable Value is zero or blank.",
    });
  }

  // 6. Missing GST Rate
  if (item.totalGstAmount > 0 && (item.gstRatePercent === undefined || item.gstRatePercent === null)) {
    exceptions.push({
      code: "MISSING_GST_RATE",
      severity: "MEDIUM",
      title: "Missing GST Rate",
      message: "GST amount is recorded without an associated GST Rate master percentage.",
    });
  }

  // 7. Missing HSN/SAC
  if (isTaxable && !item.hsnSacCode?.trim()) {
    exceptions.push({
      code: "MISSING_HSN_SAC",
      severity: "LOW",
      title: "Missing HSN/SAC Code",
      message: "Taxable transaction is missing HSN/SAC classification code.",
    });
  }

  // 8. Missing Place of Supply
  if (isTaxable && !item.placeOfSupply?.trim()) {
    exceptions.push({
      code: "MISSING_PLACE_OF_SUPPLY",
      severity: "MEDIUM",
      title: "Missing Place of Supply",
      message: "Place of Supply state code is not specified for GST tax determination.",
    });
  }

  // 9. Tax Component Conflict (CGST/SGST used simultaneously with IGST)
  const hasCgstSgst = item.cgstAmount > 0 || item.sgstAmount > 0;
  const hasIgst = item.igstAmount > 0;
  if (hasCgstSgst && hasIgst) {
    exceptions.push({
      code: "TAX_COMPONENT_CONFLICT",
      severity: "HIGH",
      title: "Tax Component Conflict",
      message: `Both Intra-state (CGST: ₹${item.cgstAmount}, SGST: ₹${item.sgstAmount}) and Inter-state (IGST: ₹${item.igstAmount}) are applied to the same item.`,
    });
  }

  // 10. Intra-state with IGST
  if (item.taxMode === TaxMode.INTRA_STATE && item.igstAmount > 0) {
    exceptions.push({
      code: "INTRA_STATE_WITH_IGST",
      severity: "HIGH",
      title: "Intra-State with IGST",
      message: `Transaction mode is INTRA_STATE but IGST (₹${item.igstAmount}) was charged instead of CGST/SGST.`,
    });
  }

  // 11. Inter-state with CGST/SGST
  if (item.taxMode === TaxMode.INTER_STATE && hasCgstSgst) {
    exceptions.push({
      code: "INTER_STATE_WITH_CGST_SGST",
      severity: "HIGH",
      title: "Inter-State with CGST/SGST",
      message: `Transaction mode is INTER_STATE but CGST (₹${item.cgstAmount}) / SGST (₹${item.sgstAmount}) was charged instead of IGST.`,
    });
  }

  // 12. GST Calculation Inconsistency (Taxable Value * Rate != Total GST beyond ₹1.00 rounding)
  if (
    item.taxableValue > 0 &&
    item.gstRatePercent !== undefined &&
    item.gstRatePercent !== null &&
    item.gstRatePercent > 0
  ) {
    const expectedGst = (item.taxableValue * item.gstRatePercent) / 100;
    const diff = Math.abs(expectedGst - item.totalGstAmount);
    if (diff > 1.0) {
      exceptions.push({
        code: "GST_CALC_INCONSISTENCY",
        severity: "MEDIUM",
        title: "GST Amount Calculation Inconsistency",
        message: `Entered GST (₹${item.totalGstAmount}) differs from Expected GST (₹${expectedGst.toFixed(2)}) based on ${item.gstRatePercent}% on ₹${item.taxableValue}.`,
      });
    }
  }

  // 13. Gross Total Inconsistency (Taxable Value + GST + Cess != Total Amount beyond ₹1.00 rounding)
  if (item.taxableValue > 0 || item.totalGstAmount > 0) {
    const sumComponents = item.taxableValue + item.totalGstAmount + item.cessAmount;
    const grossDiff = Math.abs(sumComponents - item.totalAmount);
    if (grossDiff > 1.0) {
      exceptions.push({
        code: "GROSS_TOTAL_INCONSISTENCY",
        severity: "MEDIUM",
        title: "Taxable Value + GST != Gross Amount",
        message: `Sum of Taxable (₹${item.taxableValue}) + GST (₹${item.totalGstAmount}) + Cess (₹${item.cessAmount}) = ₹${sumComponents.toFixed(2)}, which does not equal Gross Amount ₹${item.totalAmount}.`,
      });
    }
  }

  // 14. GST entered for Non-GST / Outside Scope / Exempt
  if (item.isTaxableTreatment === false && item.totalGstAmount > 0) {
    exceptions.push({
      code: "TAX_ON_NON_GST",
      severity: "HIGH",
      title: "GST Entered for Non-GST/Exempt Treatment",
      message: `GST treatment is "${item.gstTreatmentName || "Non-Taxable"}", but GST taxes of ₹${item.totalGstAmount} were entered.`,
    });
  }

  // 15. Pending ITC Review
  if (item.itcEligibility === ItcEligibility.PENDING_REVIEW && item.totalGstAmount > 0) {
    exceptions.push({
      code: "PENDING_ITC_REVIEW",
      severity: "INFO",
      title: "Pending ITC Review",
      message: "Input Tax Credit eligibility has not been verified and is marked PENDING_REVIEW.",
    });
  }

  // 16. Duplicate Vendor GSTIN and Invoice Number
  if (item.vendorGstin?.trim() && item.invoiceNumber?.trim()) {
    const dupKey = `${item.vendorGstin.trim().toUpperCase()}__${item.invoiceNumber.trim().toUpperCase()}`;
    if (duplicateInvoiceKeys.has(dupKey)) {
      exceptions.push({
        code: "DUPLICATE_INVOICE",
        severity: "HIGH",
        title: "Potential Duplicate Vendor Invoice",
        message: `Vendor GSTIN "${item.vendorGstin}" with Invoice "${item.invoiceNumber}" appears in multiple expense reports.`,
      });
    }
  }

  // 17. Reverse Charge without required information
  if (item.reverseCharge) {
    if (!item.placeOfSupply?.trim() || !item.taxableValue) {
      exceptions.push({
        code: "RCM_INCOMPLETE",
        severity: "HIGH",
        title: "Incomplete Reverse Charge Information",
        message: "Reverse Charge is YES, but Place of Supply or Taxable Value is missing.",
      });
    }
  }

  // 18. Missing Evidence for Taxable Invoices
  if (isTaxable && item.evidenceCount === 0 && item.totalAmount > 0) {
    exceptions.push({
      code: "MISSING_EVIDENCE",
      severity: "MEDIUM",
      title: "Missing Tax Invoice Receipt Attachment",
      message: "Tax invoice item does not have any receipt/invoice PDF or image attached.",
    });
  }

  return exceptions;
}
