import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { getCategoriesAction } from "@/actions/master.actions";
import { CategoriesClientView } from "./CategoriesClientView";

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
    redirect("/dashboard");
  }

  const categories = await getCategoriesAction(false);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          Expense Categories Master
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage corporate expense categories, subcategories, and active statuses
        </p>
      </div>

      <CategoriesClientView initialCategories={categories as any} />
    </div>
  );
}
