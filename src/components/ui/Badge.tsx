import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline" | "info";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-100 text-amber-800 border border-amber-200",
    danger: "bg-rose-100 text-rose-800 border border-rose-200",
    info: "bg-blue-100 text-blue-800 border border-blue-200",
    outline: "border border-slate-200 text-slate-700",
  };

  return (
    <div
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
          variantStyles[variant],
          className
        )
      )}
      {...props}
    />
  );
}
