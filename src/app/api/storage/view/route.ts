import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth-utils";
import { getLocalReceiptBuffer, getSignedReceiptUrl } from "@/lib/storage";
import prisma from "@/lib/db";
import { Role, ReportStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const storagePath = req.nextUrl.searchParams.get("path");

    if (!storagePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    // Look up the evidence in DB to check report ownership / authorization
    const evidence = await prisma.expenseEvidence.findFirst({
      where: { storagePath },
      include: {
        report: {
          select: { id: true, userId: true, status: true },
        },
      },
    });

    // If evidence is already linked to a report, verify permissions
    if (evidence?.report) {
      const isOwner = evidence.report.userId === user.id;
      const isAdminOrSuper = user.role === Role.ADMIN || user.role === Role.SUPERADMIN;

      if (evidence.report.status === ReportStatus.DRAFT && !isOwner) {
        return NextResponse.json(
          { error: "Unauthorized to view evidence on another user's draft report." },
          { status: 403 }
        );
      }

      if (!isOwner && !isAdminOrSuper) {
        return NextResponse.json(
          { error: "Unauthorized to view this evidence." },
          { status: 403 }
        );
      }
    } else {
      // Unlinked evidence during item creation: only the uploader can view
      const pathOwnerId = storagePath.split("/")[0];
      if (pathOwnerId !== user.id && user.role !== Role.SUPERADMIN) {
        return NextResponse.json(
          { error: "Unauthorized to access this file." },
          { status: 403 }
        );
      }
    }

    // Serve via local buffer stream or redirect to signed URL
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("example-project")) {
      const signedUrl = await getSignedReceiptUrl(storagePath);
      return NextResponse.redirect(signedUrl);
    } else {
      const { buffer, mimeType } = await getLocalReceiptBuffer(storagePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${storagePath.split("/").pop()}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  } catch (error: any) {
    console.error("View file error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve receipt" },
      { status: 500 }
    );
  }
}
