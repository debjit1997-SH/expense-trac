import React from "react";
import { DateDisplay } from "./DateDisplay";
import { History, UserCheck, FileText, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousVal?: string | null;
  newVal?: string | null;
  reason?: string | null;
  timestamp: Date | string;
  actor: {
    name: string;
    email: string;
    role?: string;
  };
}

export function AuditTimeline({ logs }: { logs: AuditLogItem[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">
        No audit activity recorded yet.
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    if (action.includes("APPROVED")) return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    if (action.includes("ROLLED_BACK")) return <RefreshCw className="w-4 h-4 text-amber-600" />;
    if (action.includes("REJECTED") || action.includes("DEACTIVATED"))
      return <AlertCircle className="w-4 h-4 text-rose-600" />;
    if (action.includes("SUBMITTED")) return <UserCheck className="w-4 h-4 text-blue-600" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, " ").toUpperCase();
  };

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8 space-y-4">
        {logs.map((log, idx) => (
          <li key={log.id} className="relative pb-6">
            {idx !== logs.length - 1 && (
              <span
                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                aria-hidden="true"
              />
            )}
            <div className="relative flex items-start space-x-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 border border-slate-200">
                {getActionIcon(log.action)}
              </div>
              <div className="min-w-0 flex-1">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatActionName(log.action)}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    By <span className="font-medium text-slate-700">{log.actor.name}</span> (
                    {log.actor.email}) &bull; <DateDisplay date={log.timestamp} />
                  </p>
                </div>
                {log.reason && (
                  <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 italic">
                    &ldquo;{log.reason}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
