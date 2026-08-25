import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { authorizeExpensePdfDownload, generateExpenseReportDocument } from "@/lib/pdf/pdf-generator";
import { downloadStorageFile } from "@/lib/storage";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Active account required" }, { status: 403 });
    }

    const reportId = params.id;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId") || undefined;
    const asAttachment = searchParams.get("download") === "true";
    const forceGenerate = searchParams.get("generate") === "true";

    // Check if document exists or needs initial generation
    let authCheck = await authorizeExpensePdfDownload(reportId, documentId, {
      id: user.id,
      role: user.role,
    });

    if ((!authCheck.allowed || !authCheck.document) && forceGenerate) {
      // Try generating if not yet generated
      const genRes = await generateExpenseReportDocument(reportId, undefined, user.id);
      if (genRes.success) {
        authCheck = await authorizeExpensePdfDownload(reportId, undefined, {
          id: user.id,
          role: user.role,
        });
      }
    }

    if (!authCheck.allowed || !authCheck.document) {
      return NextResponse.json(
        { error: authCheck.reason || "Document not found or unauthorized" },
        { status: 404 }
      );
    }

    const document = authCheck.document;
    const { buffer } = await downloadStorageFile(document.storagePath);

    const disposition = asAttachment ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${document.filename}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    console.error("PDF download route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to download PDF document." },
      { status: 500 }
    );
  }
}
