import React from "react";
import { ReportStatus } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Clock, Send, CheckCircle, Banknote } from "lucide-react";

export function StatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "DRAFT":
      return (
        <Badge variant="secondary" className="gap-1 font-medium bg-slate-100 text-slate-700">
          <Clock className="w-3 h-3" />
          DRAFT
        </Badge>
      );
    case "SUBMITTED":
      return (
        <Badge variant="info" className="gap-1 font-medium bg-blue-100 text-blue-800 border-blue-200">
          <Send className="w-3 h-3" />
          SUBMITTED
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="success" className="gap-1 font-medium bg-emerald-100 text-emerald-800 border-emerald-200">
          <CheckCircle className="w-3 h-3" />
          APPROVED
        </Badge>
      );
    case "REIMBURSED":
      return (
        <Badge variant="default" className="gap-1 font-medium bg-purple-100 text-purple-900 border-purple-200">
          <Banknote className="w-3 h-3 text-purple-700" />
          REIMBURSED
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}
