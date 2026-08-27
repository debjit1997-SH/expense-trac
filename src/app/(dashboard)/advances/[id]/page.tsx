import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getAdvanceDetailAction, getEligibleAdvanceApproversAction } from "@/actions/advance.actions";
import { AdvanceDetailClientView } from "./AdvanceDetailClientView";

interface AdvanceDetailPageProps {
  params: {
    id: string;
  };
}

export default async function AdvanceDetailPage({ params }: AdvanceDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const advance = await getAdvanceDetailAction(params.id);
  if (!advance) {
    notFound();
  }

  const { approvers, isFallback } = await getEligibleAdvanceApproversAction();

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      <AdvanceDetailClientView
        advance={advance}
        currentUserId={user.id}
        currentUserRole={user.role}
        eligibleApprovers={approvers}
        isFallback={isFallback}
      />
    </div>
  );
}
