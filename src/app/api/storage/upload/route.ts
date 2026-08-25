import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth-utils";
import { uploadReceiptFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/storage";
import { ocrService } from "@/lib/ocr/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed formats: JPG, JPEG, PNG, WEBP, PDF.`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds 10MB limit. Current size: ${(
            file.size /
            (1024 * 1024)
          ).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload file securely to storage
    const uploadResult = await uploadReceiptFile(
      buffer,
      file.name,
      file.type,
      user.id
    );

    // 2. Perform OCR extraction suggestions (non-blocking failure)
    let ocrResult = null;
    try {
      ocrResult = await ocrService.extractReceipt(buffer, file.type);
    } catch (ocrErr) {
      console.warn("OCR failed gracefully during upload:", ocrErr);
    }

    return NextResponse.json({
      success: true,
      evidence: uploadResult,
      ocr: ocrResult,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
