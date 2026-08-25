import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface StorageUploadResult {
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "receipts";

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceRoleKey &&
  !supabaseUrl.includes("example-project") &&
  !supabaseServiceRoleKey.includes("your-supabase-service-role-key")
);

const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: { persistSession: false },
    })
  : null;

const LOCAL_STORAGE_DIR = path.join(process.cwd(), "storage_uploads");

/**
 * Upload a receipt or evidence file securely on the server
 */
export async function uploadReceiptFile(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  userId: string
): Promise<StorageUploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Allowed formats: JPG, JPEG, PNG, WEBP, PDF.`
    );
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds 10MB limit. Current size: ${(
        fileBuffer.length /
        (1024 * 1024)
      ).toFixed(2)}MB`
    );
  }

  const timestamp = Date.now();
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueStoragePath = `${userId}/${timestamp}-${sanitizedFilename}`;

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(uniqueStoragePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  } else {
    // Local fallback for offline/development execution
    const fullDir = path.join(LOCAL_STORAGE_DIR, userId);
    await fs.mkdir(fullDir, { recursive: true });
    const fullFilePath = path.join(LOCAL_STORAGE_DIR, uniqueStoragePath);
    await fs.writeFile(fullFilePath, fileBuffer);
  }

  return {
    storagePath: uniqueStoragePath,
    originalName: originalFilename,
    mimeType,
    fileSize: fileBuffer.length,
  };
}

/**
 * Upload a generated Expense Report PDF document
 */
export async function uploadDocumentPdf(
  pdfBuffer: Buffer,
  filename: string,
  userId: string
): Promise<StorageUploadResult> {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const uniqueStoragePath = `documents/${userId}/${timestamp}-${sanitizedFilename}`;

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(uniqueStoragePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage document upload error:", error);
      throw new Error(`Document storage upload failed: ${error.message}`);
    }
  } else {
    // Local fallback for offline/development execution
    const fullDir = path.join(LOCAL_STORAGE_DIR, "documents", userId);
    await fs.mkdir(fullDir, { recursive: true });
    const fullFilePath = path.join(LOCAL_STORAGE_DIR, uniqueStoragePath);
    await fs.writeFile(fullFilePath, pdfBuffer);
  }

  return {
    storagePath: uniqueStoragePath,
    originalName: filename,
    mimeType: "application/pdf",
    fileSize: pdfBuffer.length,
  };
}

/**
 * Get an authorized signed URL or streamable view URL for evidence
 */
export async function getSignedReceiptUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error("Failed to generate signed URL for receipt.");
    }

    return data.signedUrl;
  }

  // Local fallback server endpoint
  return `/api/storage/view?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Retrieve raw file buffer from storage (Supabase or Local)
 */
export async function downloadStorageFile(
  storagePath: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .download(storagePath);

    if (error || !data) {
      throw new Error(`Failed to download storage file: ${error?.message || "Not found"}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = data.type || "application/octet-stream";
    return { buffer, mimeType };
  }

  // Local fallback
  return getLocalReceiptBuffer(storagePath);
}

/**
 * Retrieve the file buffer from local storage
 */
export async function getLocalReceiptBuffer(
  storagePath: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const fullFilePath = path.join(LOCAL_STORAGE_DIR, storagePath);
  const buffer = await fs.readFile(fullFilePath);

  const ext = path.extname(storagePath).toLowerCase();
  let mimeType = "application/octet-stream";
  if (ext === ".pdf") mimeType = "application/pdf";
  else if (ext === ".png") mimeType = "image/png";
  else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".webp") mimeType = "image/webp";

  return { buffer, mimeType };
}
