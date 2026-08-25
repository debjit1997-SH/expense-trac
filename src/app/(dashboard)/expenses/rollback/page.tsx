import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getSubmittedReportsForRollbackAction } from "@/actions/workflow.actions";
import { RollbackClientList } from "@/app/(dashboard)/rollback/RollbackClientList";
import { Undo2, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExpensesRollbackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const submittedReports = await getSubmittedReportsForRollbackAction();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              Rollback Submitted Expense
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pull back a submitted reimbursement report to DRAFT status to amend receipts or line items
            </p>
          </div>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-bold">Rollback Policy:</p>
          <p>
            &bull; You can only rollback reports that are currently in <strong>SUBMITTED</strong> status and awaiting review.
          </p>
          <p>
            &bull; Once an administrator approves or reimburses a report, it can no longer be rolled back.
          </p>
          <p>
            &bull; Rolling back will safely convert the report back to <strong>DRAFT</strong> so you can edit, add, or remove items.
          </p>
        </div>
      </div>

      {/* List of Submitted Reports */}
      <RollbackClientList initialReports={submittedReports as any} />
    </div>
  );
}
