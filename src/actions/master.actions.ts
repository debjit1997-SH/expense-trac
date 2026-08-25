"use server";

import prisma from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import {
  CategorySchema,
  SubcategorySchema,
  GstTreatmentSchema,
  GstRateSchema,
} from "@/lib/validations/master.schema";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

/**
 * Get all categories with subcategories
 */
export async function getCategoriesAction(onlyActive: boolean = false) {
  return prisma.expenseCategory.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: { name: "asc" },
    include: {
      subcategories: {
        where: onlyActive ? { isActive: true } : {},
        orderBy: { name: "asc" },
      },
      _count: {
        select: { expenseItems: true },
      },
    },
  });
}

/**
 * Add or Update Category
 */
export async function saveCategoryAction(data: {
  id?: string;
  name: string;
  code: string;
  isActive?: boolean;
}) {
  try {
    const admin = await requireAdmin();
    const validated = CategorySchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { id, name, code, isActive = true } = validated.data;

    let category;
    if (id) {
      const existing = await prisma.expenseCategory.findUnique({ where: { id } });
      category = await prisma.expenseCategory.update({
        where: { id },
        data: { name, code, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_CATEGORY_UPDATED",
        entityType: "ExpenseCategory",
        entityId: id,
        previousVal: existing,
        newVal: category,
      });
    } else {
      category = await prisma.expenseCategory.create({
        data: { name, code, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_CATEGORY_CREATED",
        entityType: "ExpenseCategory",
        entityId: category.id,
        newVal: category,
      });
    }

    revalidatePath("/master-management/categories");
    return { success: true, category };
  } catch (error: any) {
    console.error("saveCategoryAction error:", error);
    return { success: false, error: error.message || "Failed to save category." };
  }
}

/**
 * Add or Update Subcategory
 */
export async function saveSubcategoryAction(data: {
  id?: string;
  categoryId: string;
  name: string;
  code: string;
  isActive?: boolean;
}) {
  try {
    const admin = await requireAdmin();
    const validated = SubcategorySchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { id, categoryId, name, code, isActive = true } = validated.data;

    let subcategory;
    if (id) {
      const existing = await prisma.expenseSubcategory.findUnique({ where: { id } });
      subcategory = await prisma.expenseSubcategory.update({
        where: { id },
        data: { name, code, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_SUBCATEGORY_UPDATED",
        entityType: "ExpenseSubcategory",
        entityId: id,
        previousVal: existing,
        newVal: subcategory,
      });
    } else {
      subcategory = await prisma.expenseSubcategory.create({
        data: { categoryId, name, code, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_SUBCATEGORY_CREATED",
        entityType: "ExpenseSubcategory",
        entityId: subcategory.id,
        newVal: subcategory,
      });
    }

    revalidatePath("/master-management/categories");
    return { success: true, subcategory };
  } catch (error: any) {
    console.error("saveSubcategoryAction error:", error);
    return { success: false, error: error.message || "Failed to save subcategory." };
  }
}

/**
 * Toggle category active status (soft-deactivate)
 */
export async function toggleCategoryStatusAction(categoryId: string, isActive: boolean) {
  try {
    const admin = await requireAdmin();
    const updated = await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: { isActive },
    });

    await logAudit({
      actorId: admin.id,
      action: "MASTER_CATEGORY_STATUS_TOGGLED",
      entityType: "ExpenseCategory",
      entityId: categoryId,
      newVal: { isActive },
    });

    revalidatePath("/master-management/categories");
    return { success: true, category: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle category." };
  }
}

/**
 * Get all GST Treatments and Rates
 */
export async function getGstMastersAction(onlyActive: boolean = false) {
  const [treatments, rates] = await Promise.all([
    prisma.gstTreatment.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { name: "asc" },
      include: { _count: { select: { expenseItems: true } } },
    }),
    prisma.gstRate.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { ratePercent: "asc" },
      include: { _count: { select: { expenseItems: true } } },
    }),
  ]);

  return {
    treatments,
    rates: rates.map((r) => ({
      ...r,
      ratePercent: Number(r.ratePercent),
    })),
  };
}

/**
 * Save GST Treatment
 */
export async function saveGstTreatmentAction(data: {
  id?: string;
  name: string;
  code: string;
  isTaxable?: boolean;
  isActive?: boolean;
}) {
  try {
    const admin = await requireAdmin();
    const validated = GstTreatmentSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { id, name, code, isTaxable = true, isActive = true } = validated.data;

    let treatment;
    if (id) {
      const existing = await prisma.gstTreatment.findUnique({ where: { id } });
      treatment = await prisma.gstTreatment.update({
        where: { id },
        data: { name, code, isTaxable, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_GST_TREATMENT_UPDATED",
        entityType: "GstTreatment",
        entityId: id,
        previousVal: existing,
        newVal: treatment,
      });
    } else {
      treatment = await prisma.gstTreatment.create({
        data: { name, code, isTaxable, isActive },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_GST_TREATMENT_CREATED",
        entityType: "GstTreatment",
        entityId: treatment.id,
        newVal: treatment,
      });
    }

    revalidatePath("/master-management/gst");
    return { success: true, treatment };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save GST treatment." };
  }
}

/**
 * Save GST Rate
 */
export async function saveGstRateAction(data: {
  id?: string;
  ratePercent: number;
  label: string;
  isActive?: boolean;
}) {
  try {
    const admin = await requireAdmin();
    const validated = GstRateSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { id, ratePercent, label, isActive = true } = validated.data;

    let rate;
    if (id) {
      const existing = await prisma.gstRate.findUnique({ where: { id } });
      rate = await prisma.gstRate.update({
        where: { id },
        data: {
          ratePercent: new Prisma.Decimal(ratePercent),
          label,
          isActive,
        },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_GST_RATE_UPDATED",
        entityType: "GstRate",
        entityId: id,
        previousVal: existing,
        newVal: rate,
      });
    } else {
      rate = await prisma.gstRate.create({
        data: {
          ratePercent: new Prisma.Decimal(ratePercent),
          label,
          isActive,
        },
      });

      await logAudit({
        actorId: admin.id,
        action: "MASTER_GST_RATE_CREATED",
        entityType: "GstRate",
        entityId: rate.id,
        newVal: rate,
      });
    }

    revalidatePath("/master-management/gst");
    return { success: true, rate };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save GST rate." };
  }
}
