export interface OcrExtractionResult {
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // YYYY-MM-DD
  totalAmount?: number;
  vendorGstin?: string;
  taxableValue?: number;
  gstRate?: number; // e.g. 18
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  confidence?: number; // 0 - 100
  rawResponse?: string;
  detectedFields: string[];
}

export interface IOcrProvider {
  name: string;
  extractReceiptData(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<OcrExtractionResult | null>;
}
