import { IOcrProvider, OcrExtractionResult } from "./types";
import { GeminiOcrProvider } from "./gemini-provider";

export class ReceiptOcrService {
  private provider: IOcrProvider;

  constructor(provider?: IOcrProvider) {
    this.provider = provider || new GeminiOcrProvider();
  }

  setProvider(provider: IOcrProvider) {
    this.provider = provider;
  }

  async extractReceipt(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<OcrExtractionResult | null> {
    try {
      return await this.provider.extractReceiptData(fileBuffer, mimeType);
    } catch (error) {
      console.warn(`OCR provider ${this.provider.name} failed:`, error);
      return null;
    }
  }
}

export const ocrService = new ReceiptOcrService();
