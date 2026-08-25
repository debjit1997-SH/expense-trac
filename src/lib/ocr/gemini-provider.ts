import { IOcrProvider, OcrExtractionResult } from "./types";

export class GeminiOcrProvider implements IOcrProvider {
  name = "GeminiMultimodal";

  async extractReceiptData(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<OcrExtractionResult | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return null;
    }

    try {
      const base64Data = fileBuffer.toString("base64");
      const prompt = `You are a specialized receipt and tax invoice parser. 
Extract the following information from the receipt image or PDF if clearly visible. 
Do NOT invent or extrapolate missing values.
Return ONLY valid JSON matching this schema:
{
  "vendorName": string or null,
  "invoiceNumber": string or null,
  "invoiceDate": "YYYY-MM-DD" or null,
  "totalAmount": number or null,
  "vendorGstin": string or null,
  "taxableValue": number or null,
  "gstRate": number (e.g. 18) or null,
  "cgstAmount": number or null,
  "sgstAmount": number or null,
  "igstAmount": number or null,
  "cessAmount": number or null,
  "confidence": number between 1 and 100
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType === "application/pdf" ? "application/pdf" : mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn("Gemini OCR request failed:", await response.text());
        return null;
      }

      const responseData = await response.json();
      const textContent =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) return null;

      const parsed = JSON.parse(textContent);
      const detectedFields: string[] = [];

      if (parsed.vendorName) detectedFields.push("vendorName");
      if (parsed.invoiceNumber) detectedFields.push("invoiceNumber");
      if (parsed.invoiceDate) detectedFields.push("invoiceDate");
      if (parsed.totalAmount !== null && parsed.totalAmount !== undefined) detectedFields.push("totalAmount");
      if (parsed.vendorGstin) detectedFields.push("vendorGstin");
      if (parsed.taxableValue !== null && parsed.taxableValue !== undefined) detectedFields.push("taxableValue");
      if (parsed.gstRate !== null && parsed.gstRate !== undefined) detectedFields.push("gstRate");
      if (parsed.cgstAmount !== null && parsed.cgstAmount !== undefined) detectedFields.push("cgstAmount");
      if (parsed.sgstAmount !== null && parsed.sgstAmount !== undefined) detectedFields.push("sgstAmount");
      if (parsed.igstAmount !== null && parsed.igstAmount !== undefined) detectedFields.push("igstAmount");
      if (parsed.cessAmount !== null && parsed.cessAmount !== undefined) detectedFields.push("cessAmount");

      return {
        vendorName: parsed.vendorName || undefined,
        invoiceNumber: parsed.invoiceNumber || undefined,
        invoiceDate: parsed.invoiceDate || undefined,
        totalAmount: typeof parsed.totalAmount === "number" ? parsed.totalAmount : undefined,
        vendorGstin: parsed.vendorGstin || undefined,
        taxableValue: typeof parsed.taxableValue === "number" ? parsed.taxableValue : undefined,
        gstRate: typeof parsed.gstRate === "number" ? parsed.gstRate : undefined,
        cgstAmount: typeof parsed.cgstAmount === "number" ? parsed.cgstAmount : undefined,
        sgstAmount: typeof parsed.sgstAmount === "number" ? parsed.sgstAmount : undefined,
        igstAmount: typeof parsed.igstAmount === "number" ? parsed.igstAmount : undefined,
        cessAmount: typeof parsed.cessAmount === "number" ? parsed.cessAmount : undefined,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 85,
        rawResponse: JSON.stringify(parsed),
        detectedFields,
      };
    } catch (err) {
      console.warn("OCR processing encountered an error:", err);
      return null;
    }
  }
}
