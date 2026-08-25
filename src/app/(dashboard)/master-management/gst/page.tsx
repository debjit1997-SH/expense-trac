import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { getGstMastersAction } from "@/actions/master.actions";
import { GstClientView } from "./GstClientView";

export default async function GstSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const { treatments, rates } = await getGstMastersAction(false);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          GST Settings &amp; Tax Masters
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure GST treatments, tax rate slabs, and applicability rules
        </p>
      </div>

      <GstClientView initialTreatments={treatments as any} initialRates={rates as any} />
    </div>
  );
}
