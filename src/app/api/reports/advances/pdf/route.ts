import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getAdvanceRegisterData, AdvanceRegisterFilterParams } from "@/lib/reports/advance-register-query";
import { generateAdvanceRegisterPdf } from "@/lib/reports/advance-register-pdf";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE" || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to Admin and Superadmin accounts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const filterParams: AdvanceRegisterFilterParams = body.filters || {};

    const reportData = await getAdvanceRegisterData(filterParams, false);

    const pdfBuffer = await generateAdvanceRegisterPdf({
      rows: reportData.rows,
      summaryTotals: reportData.summaryTotals,
      filterParams,
      generatedByUser: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `Advance_Register_Report_${timestamp}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    console.error("Advance PDF export error:", err);
    return NextResponse.json(
      { error: "Failed to generate Advance Register PDF export", details: err.message },
      { status: 500 }
    );
  }
}
