import prisma from "./db";

/**
 * Generate a unique sequential advance request number for the current year
 * Format: ADV-YYYY-XXXXXX (e.g. ADV-2026-000001)
 */
export async function generateAdvanceNumber(): Promise<string> {
  const currentYear = new Date().getUTCFullYear();
  const prefix = `ADV-${currentYear}-`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await prisma.advanceRequest.count({
      where: {
        advanceNumber: {
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

    const existing = await prisma.advanceRequest.findUnique({
      where: { advanceNumber: candidateNumber },
    });

    if (!existing) {
      return candidateNumber;
    }
  }

  // Fallback unique timestamp number
  return `${prefix}${Date.now().toString().slice(-6)}`;
}
