import prisma from "./db";

/**
 * Generate a unique sequential report number for the current year
 * Format: EXP-YYYY-XXXXXX (e.g. EXP-2026-000001)
 */
export async function generateReportNumber(): Promise<string> {
  const currentYear = new Date().getUTCFullYear();
  const prefix = `EXP-${currentYear}-`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await prisma.expenseReport.count({
      where: {
        reportNumber: {
          startsWith: prefix,
        },
      },
    });

    const nextSeq = count + 1 + attempt;
    const paddedSeq = nextSeq.toString().padStart(6, "0");
    const candidateNumber =
      attempt === 0
        ? `${prefix}${paddedSeq}`
        : `${prefix}${paddedSeq}-${Math.floor(1000 + Math.random() * 9000)}`;

    const existing = await prisma.expenseReport.findUnique({
      where: { reportNumber: candidateNumber },
    });

    if (!existing) {
      return candidateNumber;
    }
  }

  // Fallback unique timestamp number
  return `${prefix}${Date.now().toString().slice(-6)}`;
}
