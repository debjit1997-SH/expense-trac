import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { DetailedExpenseReportClientView } from "@/components/reports/DetailedExpenseReportClientView";

export default async function DetailedExpenseReportPage() {
  const session = await auth();

  // Enforce ADMIN or SUPERADMIN access only
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true },
  });

  if (!currentUser || currentUser.status !== "ACTIVE" || (currentUser.role !== Role.ADMIN && currentUser.role !== Role.SUPERADMIN)) {
    redirect("/dashboard");
  }

  // Load filter master data
  const [categories, gstTreatments, gstRates, users, savedViews] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: { subcategories: { where: { isActive: true }, select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.gstTreatment.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.gstRate.findMany({
      where: { isActive: true },
      select: { id: true, label: true, ratePercent: true },
      orderBy: { ratePercent: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.reportViewPreference.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedViews = JSON.parse(JSON.stringify(savedViews));
  const defaultView = serializedViews.find((v: any) => v.isDefault) || null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <DetailedExpenseReportClientView
        categories={JSON.parse(JSON.stringify(categories))}
        gstTreatments={JSON.parse(JSON.stringify(gstTreatments))}
        gstRates={JSON.parse(JSON.stringify(gstRates))}
        users={JSON.parse(JSON.stringify(users))}
        initialSavedViews={serializedViews}
        defaultView={defaultView}
      />
    </div>
  );
}
