import React from "react";
import { getCurrentUser } from "@/lib/auth-utils";
import { getEligibleAdvanceApproversAction } from "@/actions/advance.actions";
import { CreateAdvanceClientView } from "./CreateAdvanceClientView";

export default async function CreateAdvancePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { approvers, isFallback } = await getEligibleAdvanceApproversAction();

  return (
    <div className="max-w-3xl mx-auto py-4">
      <CreateAdvanceClientView
        currentUserId={user.id}
        currentUserRole={user.role}
        eligibleApprovers={approvers}
        isFallback={isFallback}
      />
    </div>
  );
}
