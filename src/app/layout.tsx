import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expense Management & Reimbursement Portal",
  description: "Enterprise expense reimbursement and GST invoice processing application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
