import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import {
  getAccessRequestsAction,
  getActiveUsersAction,
  getRejectedRequestsAction,
  getDisabledUsersAction,
} from "@/actions/user-management.actions";
import { UserManagementClientView } from "./UserManagementClientView";

interface UserManagementPageProps {
  searchParams: { tab?: string };
}

export default async function UserManagementPage({ searchParams }: UserManagementPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const [pendingRequests, activeUsers, rejectedRequests, disabledUsers] =
    await Promise.all([
      getAccessRequestsAction(),
      getActiveUsersAction(),
      getRejectedRequestsAction(),
      getDisabledUsersAction(),
    ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          User Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Approve pending registration requests, assign roles, and manage active employee accounts
        </p>
      </div>

      <UserManagementClientView
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        defaultTab={searchParams.tab || "requests"}
        initialPending={pendingRequests as any}
        initialActive={activeUsers as any}
        initialRejected={rejectedRequests as any}
        initialDisabled={disabledUsers as any}
      />
    </div>
  );
}
