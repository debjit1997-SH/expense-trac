"use server";

import { requireAdmin } from "@/lib/auth-utils";
import {
  GstRegisterFilterParams,
  getGstRegisterData,
  getGstAnalyticsData,
} from "@/lib/reports/gst-register-query";

/**
 * Server action to fetch paginated GST Expense Register items (Admin / Superadmin only)
 */
export async function getGstRegisterAction(
  filters: GstRegisterFilterParams,
  pagination = true
) {
  await requireAdmin();

  const data = await getGstRegisterData(filters, pagination);
  return JSON.parse(JSON.stringify(data));
}

/**
 * Server action to fetch deep GST analytics aggregations (Admin / Superadmin only)
 */
export async function getGstAnalyticsAction(filters: GstRegisterFilterParams) {
  await requireAdmin();

  const data = await getGstAnalyticsData(filters);
  return JSON.parse(JSON.stringify(data));
}
