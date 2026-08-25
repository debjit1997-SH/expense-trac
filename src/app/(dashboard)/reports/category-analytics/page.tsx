import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role, ReportStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { getCategoryAnalyticsData } from "@/lib/reports/category-analytics-query";
import { CategoryAnalyticsClientView } from "@/components/reports/CategoryAnalyticsClientView";

export default async function CategoryAnalyticsPage() {
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

  const [categories, users, initialData] = await Promise.all([
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
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    getCategoryAnalyticsData({
      filterMode: "DATE_RANGE",
      dateBasis: "EXPENSE_DATE",
      statuses: [ReportStatus.APPROVED, ReportStatus.REIMBURSED],
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <CategoryAnalyticsClientView
        categories={JSON.parse(JSON.stringify(categories))}
        users={JSON.parse(JSON.stringify(users))}
        initialData={JSON.parse(JSON.stringify(initialData))}
      />
    </div>
  );
}
