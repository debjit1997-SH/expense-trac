import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { getSuperadminDisbursementInboxAction } from "@/actions/advance.actions";
import { Role } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateDisplay } from "@/components/common/DateDisplay";
import { formatCurrencyINR } from "@/lib/formatters";
import { Banknote, ArrowRight, CheckCircle2, Wallet, Coins } from "lucide-react";

export default async function AdvanceDisbursementsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const data = await getSuperadminDisbursementInboxAction();
  const pendingDisbursement = Array.isArray(data?.pendingDisbursement) ? data.pendingDisbursement : [];
  const activeAdvances = Array.isArray(data?.activeAdvances) ? data.activeAdvances : [];

  const isCompletelyEmpty = pendingDisbursement.length === 0 && activeAdvances.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <Banknote className="w-6 h-6 text-purple-600" />
            Advance Disbursement & Settlement Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Superadmin Treasury Console for releasing approved advance funds and logging returned balances.
          </p>
        </div>
      </div>

      {isCompletelyEmpty && (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="py-12 px-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Workspace Clear</h3>
            <p className="text-xs text-slate-500 mt-1">
              No advance requests are currently awaiting disbursement or settlement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Approved Advances Awaiting Disbursement */}
      <Card className="shadow-sm border-purple-200">
        <CardHeader className="border-b border-purple-100 py-3.5 px-4 bg-purple-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-purple-900 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-purple-600" />
            Awaiting Disbursement ({pendingDisbursement.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingDisbursement.length === 0 ? (
            <div className="text-center py-8 px-4">
              <CheckCircle2 className="w-8 h-8 text-purple-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                No approved advances are currently pending disbursement.
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
                    <th className="py-3 px-4">Approved Amount (₹)</th>
                    <th className="py-3 px-4">Approved By</th>
                    <th className="py-3 px-4">Approved On</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pendingDisbursement.map((adv: any) => (
                    <tr key={adv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900">
                        {adv.advanceNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <span className="font-semibold">{adv.user?.name || "Unknown"}</span>
                        <span className="text-[11px] text-slate-400 block">{adv.user?.email || "-"}</span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800">
                        {adv.purpose}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-purple-700">
                        {formatCurrencyINR(adv.approvedAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {adv.approvedBy?.name || "-"}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {adv.approvedAt ? <DateDisplay date={adv.approvedAt} /> : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link href={`/advances/${adv.id}`}>
                          <Button size="sm" variant="primary" className="text-xs h-7 px-3 bg-purple-600 hover:bg-purple-700 font-semibold">
                            Disburse Funds <ArrowRight className="w-3 h-3 ml-1" />
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

      {/* Section 2: Active Disbursed Advances with Outstanding / Available Balances */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            Active Advances & Balances ({activeAdvances.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeAdvances.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-xs text-slate-400">No active disbursed advances found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Advance #</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Disbursed (₹)</th>
                    <th className="py-3 px-4">Adjusted (₹)</th>
                    <th className="py-3 px-4">Returned (₹)</th>
                    <th className="py-3 px-4">Available (₹)</th>
                    <th className="py-3 px-4">Outstanding (₹)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeAdvances.map((adv: any) => (
                    <tr key={adv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900">
                        {adv.advanceNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <span className="font-semibold">{adv.user?.name || "Unknown"}</span>
                        <span className="text-[11px] text-slate-400 block">{adv.user?.email || "-"}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-purple-700">
                        {formatCurrencyINR(adv.disbursedAmount)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-blue-700">
                        {formatCurrencyINR(adv.adjustedAmount)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-700">
                        {formatCurrencyINR(adv.returnedAmount)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-700">
                        {formatCurrencyINR(adv.availableBalance)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {formatCurrencyINR(adv.outstandingBalance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link href={`/advances/${adv.id}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                            Manage <ArrowRight className="w-3 h-3 ml-1" />
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
