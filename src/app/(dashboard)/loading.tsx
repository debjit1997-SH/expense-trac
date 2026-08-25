import React from "react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
      <div className="h-10 bg-slate-200 rounded-md w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-slate-200 rounded-lg"></div>
        <div className="h-28 bg-slate-200 rounded-lg"></div>
        <div className="h-28 bg-slate-200 rounded-lg"></div>
      </div>
      <div className="h-64 bg-slate-200 rounded-lg"></div>
    </div>
  );
}
