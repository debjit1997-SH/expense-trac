import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isSuggested?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, isSuggested, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className="block text-xs font-semibold text-slate-700 tracking-wide"
            >
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {isSuggested && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300">
                ✨ Auto-detected (Editable)
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={twMerge(
              clsx(
                "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 transition-colors",
                error && "border-red-500 focus:ring-red-500",
                isSuggested && "bg-amber-50/50 border-amber-400",
                className
              )
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
