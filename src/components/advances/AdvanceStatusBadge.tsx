import React from "react";
import { AdvanceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";

export function AdvanceStatusBadge({ status }: { status: AdvanceStatus }) {
  switch (status) {
    case AdvanceStatus.DRAFT:
      return <Badge variant="secondary" className="bg-slate-100 text-slate-700">DRAFT</Badge>;
    case AdvanceStatus.SUBMITTED:
      return <Badge variant="warning" className="bg-amber-100 text-amber-900 border-amber-300">SUBMITTED</Badge>;
    case AdvanceStatus.APPROVED:
      return <Badge variant="info" className="bg-blue-100 text-blue-900 border-blue-300">APPROVED (PENDING DISBURSEMENT)</Badge>;
    case AdvanceStatus.DISBURSED:
      return <Badge variant="success" className="bg-emerald-100 text-emerald-900 border-emerald-300">DISBURSED (ACTIVE)</Badge>;
    case AdvanceStatus.PARTIALLY_SETTLED:
      return <Badge variant="warning" className="bg-indigo-100 text-indigo-900 border-indigo-300">PARTIALLY SETTLED</Badge>;
    case AdvanceStatus.SETTLED:
      return <Badge variant="success" className="bg-green-100 text-green-900 border-green-300 font-bold">FULLY SETTLED</Badge>;
    case AdvanceStatus.REJECTED:
      return <Badge variant="danger" className="bg-red-100 text-red-900 border-red-300">REJECTED</Badge>;
    case AdvanceStatus.CANCELLED:
      return <Badge variant="secondary" className="bg-slate-200 text-slate-600">CANCELLED</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
