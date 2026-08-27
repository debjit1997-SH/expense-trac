import { z } from "zod";

export const CreateExpenseTagSchema = z.object({
  title: z
    .string()
    .min(3, "Expense Tag title must be at least 3 characters")
    .max(120, "Title is too long")
    .trim(),
  description: z.string().max(500, "Description is too long").optional().nullable(),
  advanceRequestId: z.string().optional().nullable(),
  advanceAdjustmentAmount: z.number().nonnegative().optional().nullable(),
});

export const UpdateExpenseTagSchema = CreateExpenseTagSchema.extend({
  id: z.string().min(1, "Report ID is required"),
});

export const ExpenseItemSchema = z
  .object({
    id: z.string().optional(),
    reportId: z.string().min(1, "Report ID is required"),
    expenseDate: z.string().or(z.date()),
    vendorName: z.string().min(2, "Vendor name is required").trim(),
    invoiceNumber: z.string().max(100).optional().nullable(),
    invoiceDate: z.string().or(z.date()).optional().nullable(),
    description: z.string().min(1, "Description is required").trim(),
    
    categoryId: z.string().min(1, "Category is required"),
    subcategoryId: z.string().min(1, "Subcategory is required"),
    categoryCode: z.string().optional(),
    subcategoryCode: z.string().optional(),
    
    totalAmount: z
      .number()
      .positive("Amount must be greater than 0")
      .or(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format").transform(Number)),
    currency: z.string().default("INR"),

    // GST Fields
    gstTreatmentId: z.string().optional().nullable(),
    gstRateId: z.string().optional().nullable(),
    documentType: z.string().optional().nullable(),
    vendorGstStatus: z
      .enum(["REGISTERED_REGULAR", "REGISTERED_COMPOSITION", "UNREGISTERED", "OVERSEAS"])
      .optional()
      .nullable(),
    vendorGstin: z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GSTIN format (e.g. 27AAAAA0000A1Z5)"
      )
      .or(z.literal(""))
      .optional()
      .nullable(),
    companyGstin: z.string().optional().nullable(),
    placeOfSupply: z.string().optional().nullable(),
    hsnSacCode: z.string().optional().nullable(),
    taxableValue: z.number().nonnegative().or(z.string().transform(Number)).optional().nullable(),
    taxMode: z.enum(["INTRA_STATE", "INTER_STATE"]).optional().nullable(),
    cgstRate: z.number().nonnegative().optional().nullable(),
    cgstAmount: z.number().nonnegative().optional().nullable(),
    sgstRate: z.number().nonnegative().optional().nullable(),
    sgstAmount: z.number().nonnegative().optional().nullable(),
    igstRate: z.number().nonnegative().optional().nullable(),
    igstAmount: z.number().nonnegative().optional().nullable(),
    cessAmount: z.number().nonnegative().optional().nullable(),
    totalGstAmount: z.number().nonnegative().optional().nullable(),
    reverseCharge: z.boolean().default(false),
    itcEligibility: z
      .enum(["PENDING_REVIEW", "ELIGIBLE", "INELIGIBLE", "NOT_APPLICABLE"])
      .default("PENDING_REVIEW"),
    gstRemarks: z.string().max(500).optional().nullable(),

    // Evidence
    evidence: z
      .object({
        originalName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        storagePath: z.string(),
        ocrConfidence: z.number().optional().nullable(),
        ocrRawResponse: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // If category or subcategory is OTHER, description must be at least 5 characters
      if (
        data.subcategoryCode === "OTHER" ||
        data.categoryCode === "MISCELLANEOUS"
      ) {
        return data.description && data.description.trim().length >= 5;
      }
      return true;
    },
    {
      message: "Please provide a detailed business description (at least 5 characters) for OTHER expenses",
      path: ["description"],
    }
  );

export const WorkflowActionSchema = z.object({
  reportId: z.string().min(1, "Report ID is required"),
  reason: z.string().optional(),
  reimbursementRef: z.string().optional(),
  reimbursementNote: z.string().optional(),
});

export type CreateExpenseTagInput = z.infer<typeof CreateExpenseTagSchema>;
export type ExpenseItemInput = z.infer<typeof ExpenseItemSchema>;
export type WorkflowActionInput = z.infer<typeof WorkflowActionSchema>;
