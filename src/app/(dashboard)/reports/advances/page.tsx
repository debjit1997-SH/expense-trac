import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { getAdvanceRegisterData } from "@/lib/reports/advance-register-query";
import { AdvanceRegisterClientView } from "./AdvanceRegisterClientView";

export default async function AdvanceRegisterReportPage() {
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

  const [users, initialData] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    getAdvanceRegisterData({
      page: 1,
      pageSize: 25,
    }),
  ]);

  return (
    <div className="space-y-6">
      <AdvanceRegisterClientView
        initialData={initialData}
        users={users}
        currentUserRole={currentUser.role}
      />
    </div>
  );
}
