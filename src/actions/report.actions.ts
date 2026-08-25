"use server";

import prisma from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import {
  DetailedReportFilterParams,
  getDetailedExpenseReportData,
} from "@/lib/reports/report-query";
import { revalidatePath } from "next/cache";

/**
 * Server action to fetch paginated detailed expense report data (Admin / Superadmin only)
 */
export async function getDetailedExpenseReportAction(filters: DetailedReportFilterParams) {
  const user = await requireAdmin(); // Enforces ADMIN or SUPERADMIN

  const data = await getDetailedExpenseReportData(filters, true);
  return JSON.parse(JSON.stringify(data));
}

/**
 * Get all saved view preferences for the logged-in admin
 */
export async function getSavedViewPreferencesAction() {
  const user = await requireAdmin();

  const views = await prisma.reportViewPreference.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return JSON.parse(JSON.stringify(views));
}

/**
 * Save or update a view preference
 */
export async function saveViewPreferenceAction(data: {
  name: string;
  columnConfig: any;
  filterConfig?: any;
  sortConfig?: any;
  isDefault?: boolean;
}) {
  const user = await requireAdmin();
  const { name, columnConfig, filterConfig, sortConfig, isDefault } = data;

  if (!name.trim()) {
    return { success: false, error: "Please enter a view name." };
  }

  if (isDefault) {
    // Reset any existing default views for this user
    await prisma.reportViewPreference.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const preference = await prisma.reportViewPreference.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: name.trim(),
      },
    },
    update: {
      columnConfig,
      filterConfig: filterConfig || null,
      sortConfig: sortConfig || null,
      isDefault: Boolean(isDefault),
    },
    create: {
      userId: user.id,
      name: name.trim(),
      columnConfig,
      filterConfig: filterConfig || null,
      sortConfig: sortConfig || null,
      isDefault: Boolean(isDefault),
    },
  });

  revalidatePath("/reports/expenses");
  return { success: true, preference: JSON.parse(JSON.stringify(preference)) };
}

/**
 * Delete a saved view preference
 */
export async function deleteViewPreferenceAction(viewId: string) {
  const user = await requireAdmin();

  await prisma.reportViewPreference.deleteMany({
    where: {
      id: viewId,
      userId: user.id,
    },
  });

  revalidatePath("/reports/expenses");
  return { success: true };
}

/**
 * Set a saved view as default
 */
export async function setDefaultViewPreferenceAction(viewId: string) {
  const user = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    await tx.reportViewPreference.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });

    await tx.reportViewPreference.update({
      where: { id: viewId },
      data: { isDefault: true },
    });
  });

  revalidatePath("/reports/expenses");
  return { success: true };
}
