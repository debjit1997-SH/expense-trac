import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm",
          className
        )
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(clsx("flex flex-col space-y-1.5 p-6 border-b border-slate-100", className))}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx("text-lg font-semibold leading-none tracking-tight text-slate-900", className)
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={twMerge(clsx("text-sm text-slate-500", className))}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge(clsx("p-6", className))} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(clsx("flex items-center p-6 pt-0 border-t border-slate-100 mt-6", className))}
      {...props}
    />
  );
}
