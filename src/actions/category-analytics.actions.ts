"use server";

import { requireAdmin } from "@/lib/auth-utils";
import {
  CategoryAnalyticsFilterParams,
  getCategoryAnalyticsData,
} from "@/lib/reports/category-analytics-query";

/**
 * Server Action to compute and fetch Category Expense Analytics (Admin / Superadmin only)
 */
export async function getCategoryAnalyticsAction(filters: CategoryAnalyticsFilterParams) {
  await requireAdmin(); // Enforces ADMIN or SUPERADMIN

  const data = await getCategoryAnalyticsData(filters);
  return JSON.parse(JSON.stringify(data));
}
