import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { getAdminApprovalInboxAction } from "@/actions/workflow.actions";
import { ApprovalInboxClientView } from "./ApprovalInboxClientView";

interface ApprovalInboxPageProps {
  searchParams: { tab?: "ASSIGNED_TO_ME" | "ALL_SUBMITTED" | "APPROVED_BY_ME" | "UNASSIGNED" };
}

export default async function ApprovalInboxPage({ searchParams }: ApprovalInboxPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const activeTab = searchParams.tab || "ASSIGNED_TO_ME";
  const reports = await getAdminApprovalInboxAction(activeTab);

  return (
    <ApprovalInboxClientView
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
