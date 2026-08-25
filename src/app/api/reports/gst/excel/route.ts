import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import {
  getGstRegisterData,
  getGstAnalyticsData,
  GstRegisterFilterParams,
} from "@/lib/reports/gst-register-query";
import { generateGstRegisterExcel } from "@/lib/reports/gst-register-excel";

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
    const filterParams: GstRegisterFilterParams = body.filters || {};

    const [regResult, analytics] = await Promise.all([
      getGstRegisterData(filterParams, false),
      getGstAnalyticsData(filterParams),
    ]);

    const excelBuffer = await generateGstRegisterExcel({
      rows: regResult.rows,
      analytics,
      filterParams,
      generatedByUser: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `GST_Expense_Register_${timestamp}.xlsx`;

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
    console.error("GST Excel export error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate GST Excel export." },
      { status: 500 }
    );
  }
}
