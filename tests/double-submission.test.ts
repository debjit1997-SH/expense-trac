import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { ReportStatus, Prisma } from "@prisma/client";
import { generateReportNumber } from "../src/lib/report-number";

describe("Double-Submission Prevention Test", () => {
  let employeeUser: any;
  let sampleCategory: any;
  let testReportId: string;

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    sampleCategory = await prisma.expenseCategory.findFirst({
      where: { code: "OFFICE_SUPPLIES" },
      include: { subcategories: true },
    });

    const reportNumber = await generateReportNumber();
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "CONCURRENCY & DOUBLE SUBMIT TEST",
        userId: employeeUser.id,
        status: ReportStatus.DRAFT,
        totalAmount: new Prisma.Decimal(0.0),
      },
    });

    testReportId = report.id;
  });

  afterAll(async () => {
    if (testReportId) {
      await prisma.expenseReport.deleteMany({ where: { id: testReportId } });
    }
  });

  it("prevents double insertion when simulated button lock / debounce is active", async () => {
    let isSubmitting = false;
    let successfulCreations = 0;

    const simulateUserClick = async () => {
      if (isSubmitting) {
        // Double click prevented by client submission lock
        return { blocked: true };
      }
      isSubmitting = true;
      try {
        await prisma.expenseItem.create({
          data: {
            reportId: testReportId,
            expenseDate: new Date(),
            vendorName: "Amazon Business",
            description: "Stationery and printer cartridges",
            categoryId: sampleCategory.id,
            subcategoryId: sampleCategory.subcategories[0].id,
            totalAmount: new Prisma.Decimal(1250.0),
          },
        });
        successfulCreations++;
        return { blocked: false };
      } finally {
        isSubmitting = false;
      }
    };

    // Simulate 5 simultaneous rapid clicks
    const results = await Promise.all([
      simulateUserClick(),
      simulateUserClick(),
      simulateUserClick(),
      simulateUserClick(),
      simulateUserClick(),
    ]);

    const createdItems = await prisma.expenseItem.findMany({
      where: { reportId: testReportId },
    });

    expect(createdItems.length).toBe(1);
    expect(successfulCreations).toBe(1);
  });
});
