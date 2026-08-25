import { z } from "zod";

export const CategorySchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(2, "Category name is required")
    .max(100)
    .transform((val) => val.toUpperCase().trim()),
  code: z
    .string()
    .min(2, "Category code is required")
    .max(50)
    .transform((val) => val.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_")),
  isActive: z.boolean().default(true),
});

export const SubcategorySchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  name: z
    .string()
    .min(2, "Subcategory name is required")
    .max(100)
    .transform((val) => val.toUpperCase().trim()),
  code: z
    .string()
    .min(2, "Subcategory code is required")
    .max(50)
    .transform((val) => val.toUpperCase().trim().replace(/[^A-Z0-9_]/g, "_")),
  isActive: z.boolean().default(true),
});

export const GstTreatmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is required").trim(),
  code: z.string().min(2, "Code is required").trim(),
  isTaxable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const GstRateSchema = z.object({
  id: z.string().optional(),
  ratePercent: z.number().min(0).max(100),
  label: z.string().min(1, "Label is required").trim(),
  isActive: z.boolean().default(true),
});
