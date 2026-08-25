import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { getSuperadminReimbursementInboxAction } from "@/actions/workflow.actions";
import { ReimbursementInboxClientView } from "./ReimbursementInboxClientView";

interface ReimbursementInboxPageProps {
  searchParams: { tab?: "ASSIGNED_TO_ME" | "ALL_APPROVED" | "REIMBURSED" | "UNASSIGNED" };
}

export default async function ReimbursementInboxPage({ searchParams }: ReimbursementInboxPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const activeTab = searchParams.tab || "ASSIGNED_TO_ME";
  const reports = await getSuperadminReimbursementInboxAction(activeTab);

  return (
    <ReimbursementInboxClientView
      initialReports={reports}
      currentTab={activeTab}
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    />
  );
}
