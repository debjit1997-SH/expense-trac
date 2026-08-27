import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getAdvanceRegisterData, AdvanceRegisterFilterParams } from "@/lib/reports/advance-register-query";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE" || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Access restricted to Admin and Superadmin accounts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const filterParams: AdvanceRegisterFilterParams = body.filters || {};

    const reportData = await getAdvanceRegisterData(filterParams, true);

    return NextResponse.json(reportData);
  } catch (err: any) {
    console.error("Advance query error:", err);
    return NextResponse.json(
      { error: "Failed to query advance register data", details: err.message },
      { status: 500 }
    );
  }
}
