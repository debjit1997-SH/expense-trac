"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth-utils";
import { generateExpenseReportDocument, authorizeExpensePdfDownload } from "@/lib/pdf/pdf-generator";
import { Role, ReportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Generate or re-generate an expense report PDF document
 */
export async function generateExpenseReportPdfAction(params: {
  reportId: string;
  targetStatus?: ReportStatus;
}) {
  const user = await requireActiveUser();

  const report = await prisma.expenseReport.findUnique({
    where: { id: params.reportId },
    select: { id: true, userId: true, status: true },
  });

  if (!report) {
    return { success: false, error: "Expense report not found." };
  }

  // Authorization check
  const isOwner = report.userId === user.id;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPERADMIN;

  if (!isOwner && !isAdmin) {
    return { success: false, error: "Not authorized to generate PDF for this report." };
  }

  const result = await generateExpenseReportDocument(
    params.reportId,
    params.targetStatus || report.status,
    user.id
  );

  if (result.success) {
    revalidatePath(`/expenses/${params.reportId}`);
    revalidatePath("/expenses");
    revalidatePath("/approval-inbox");
    revalidatePath("/reimbursement-inbox");
  }

  return result;
}

/**
 * Get all document versions for a report with authorization check
 */
export async function getExpenseReportDocumentsAction(reportId: string) {
  const user = await requireActiveUser();

  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: {
      documents: {
        orderBy: { versionNumber: "desc" },
        include: {
          generatedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!report) return [];

  const isOwner = report.userId === user.id;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPERADMIN;

  if (!isOwner && !isAdmin) return [];

  return JSON.parse(JSON.stringify(report.documents));
}
