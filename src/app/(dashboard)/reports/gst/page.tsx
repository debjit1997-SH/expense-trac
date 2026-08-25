import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getGstRegisterData, getGstAnalyticsData } from "@/lib/reports/gst-register-query";
import { GstRegisterClientView } from "@/components/reports/GstRegisterClientView";

export default async function GstRegisterPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true },
  });

  if (
    !currentUser ||
    currentUser.status !== "ACTIVE" ||
    (currentUser.role !== Role.ADMIN && currentUser.role !== Role.SUPERADMIN)
  ) {
    redirect("/dashboard");
  }

  const [categories, gstTreatments, gstRates, users, initialData, initialAnalytics] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.gstTreatment.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.gstRate.findMany({
      where: { isActive: true },
      orderBy: { ratePercent: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    getGstRegisterData({
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      page: 1,
      pageSize: 25,
    }),
    getGstAnalyticsData({
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <GstRegisterClientView
        categories={JSON.parse(JSON.stringify(categories))}
        gstTreatments={JSON.parse(JSON.stringify(gstTreatments))}
        gstRates={JSON.parse(JSON.stringify(gstRates))}
        users={JSON.parse(JSON.stringify(users))}
        initialData={JSON.parse(JSON.stringify(initialData))}
        initialAnalytics={JSON.parse(JSON.stringify(initialAnalytics))}
      />
    </div>
  );
}
