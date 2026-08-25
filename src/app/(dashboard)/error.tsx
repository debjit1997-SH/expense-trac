"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 bg-white border border-red-100 rounded-xl shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-1">
            {error.message || "An error occurred while loading this section."}
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button onClick={() => reset()} variant="primary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
