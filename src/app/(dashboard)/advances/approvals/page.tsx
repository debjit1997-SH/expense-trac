import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getAdvanceApprovalInboxAction } from "@/actions/advance.actions";
import { Role } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { FileCheck, ArrowRight, User, Clock, CheckCircle2, Shield } from "lucide-react";

export default async function AdvanceApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
    redirect("/dashboard");
  }

  const items = await getAdvanceApprovalInboxAction();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-amber-500" />
            Advance Approval Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and approve pending upfront employee advance requests assigned to you.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            Pending Advance Requests
            <span className="text-xs font-normal text-slate-500 lowercase">({items.length} pending)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-center py-12 px-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Inbox Clear</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have no pending employee advance requests waiting for your approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Advance #</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Requested (₹)</th>
                    <th className="py-3 px-4">Required By</th>
                    <th className="py-3 px-4">Assigned On</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {item.advanceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{item.user.name}</span>
                        <span className="text-[11px] text-slate-400 block">{item.user.email}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1 max-w-xs">
                          {item.purpose}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-blue-700 whitespace-nowrap">
                        {formatCurrencyINR(item.requestedAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {item.requiredByDate ? <DateDisplay date={item.requiredByDate} /> : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <DateDisplay date={item.createdAt} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link href={`/advances/${item.id}`}>
                          <Button size="sm" variant="primary" className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700 font-semibold">
                            Review & Decide <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
