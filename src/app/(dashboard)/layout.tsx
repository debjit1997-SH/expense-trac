import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AccountStatus } from "@prisma/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.status !== AccountStatus.ACTIVE) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          userName={user.name}
          userEmail={user.email}
          userRole={user.role}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
