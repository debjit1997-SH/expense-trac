import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getExpenseReportByIdAction } from "@/actions/expense.actions";
import { getCategoriesAction, getGstMastersAction } from "@/actions/master.actions";
import { ReportStatus } from "@prisma/client";
import { EditDraftClientView } from "./EditDraftClientView";

interface EditDraftPageProps {
  params: { id: string };
}

export default async function EditDraftPage({ params }: EditDraftPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let report;
  try {
    report = await getExpenseReportByIdAction(params.id);
  } catch {
    notFound();
  }

  if (!report) notFound();

  // Enforce DRAFT status and ownership
  if (report.status !== ReportStatus.DRAFT || report.userId !== user.id) {
    redirect(`/expenses/${report.id}`);
  }

  const [categories, { treatments, rates }] = await Promise.all([
    getCategoriesAction(true),
    getGstMastersAction(true),
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <EditDraftClientView
        initialReport={report as any}
        categories={categories as any}
        gstTreatments={treatments as any}
        gstRates={rates as any}
      />
    </div>
  );
}
