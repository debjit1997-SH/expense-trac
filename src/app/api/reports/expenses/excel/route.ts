import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getDetailedExpenseReportData, DetailedReportFilterParams } from "@/lib/reports/report-query";
import { generateDetailedExpenseExcel } from "@/lib/reports/excel-export";

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
    const filterParams: DetailedReportFilterParams = body.filters || {};
    const visibleColumnIds: string[] = body.visibleColumnIds || [];

    // Fetch ALL matching rows (unpaginated)
    const reportData = await getDetailedExpenseReportData(filterParams, false);

    const excelBuffer = await generateDetailedExpenseExcel({
      rows: reportData.rows,
      summaryTotals: reportData.summaryTotals,
      filterParams,
      visibleColumnIds,
      generatedByUser: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `Detailed_Expense_Report_${timestamp}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": excelBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    console.error("Excel export error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate Excel report." },
      { status: 500 }
    );
  }
}
