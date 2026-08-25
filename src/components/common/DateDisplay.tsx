"use client";

import React from "react";
import { formatToKolkataDateTime, formatToKolkataDate } from "@/lib/formatters";

interface DateDisplayProps {
  date: Date | string | null | undefined;
  includeTime?: boolean;
  className?: string;
  pattern?: string;
}

export function DateDisplay({
  date,
  includeTime = true,
  className = "",
  pattern,
}: DateDisplayProps) {
  if (!date) return <span className={className}>-</span>;

  const formatted = includeTime
    ? formatToKolkataDateTime(date, pattern || "dd MMM yyyy, hh:mm a")
    : formatToKolkataDate(date, pattern || "dd MMM yyyy");

  return <span className={className}>{formatted}</span>;
}
