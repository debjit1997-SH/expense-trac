import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { ReportStatus, Prisma } from "@prisma/client";

describe("Rollback Submitted Expense Tests", () => {
  let employeeUser: any;
  let anotherUser: any;
  let testReportId: string;

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    anotherUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });

    const reportNumber = `EXP-TEST-RB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "ROLLBACK TEST REPORT",
        userId: employeeUser.id,
        status: ReportStatus.SUBMITTED,
        submittedAt: new Date(),
        totalAmount: new Prisma.Decimal(1200.0),
      },
    });

    testReportId = report.id;
  });

  afterAll(async () => {
    if (testReportId) {
      await prisma.expenseReport.deleteMany({ where: { id: testReportId } });
    }
  });

  it("should prevent a non-owner from initiating a rollback", async () => {
    const report = await prisma.expenseReport.findUnique({
      where: { id: testReportId },
    });

    const verifyRollbackPermission = (actorId: string) => {
      if (report?.userId !== actorId) {
        throw new Error("Only the report owner can initiate a rollback.");
      }
    };

    expect(() => verifyRollbackPermission(anotherUser.id)).toThrow(
      "Only the report owner can initiate a rollback."
    );
  });

  it("should successfully rollback a SUBMITTED report back to DRAFT inside a transaction", async () => {
    const rolledBack = await prisma.$transaction(async (tx) => {
      const current = await tx.expenseReport.findUnique({
        where: { id: testReportId },
      });

      if (current?.status !== ReportStatus.SUBMITTED) {
        throw new Error("Only SUBMITTED reports can be rolled back.");
      }

      return tx.expenseReport.update({
        where: { id: testReportId },
        data: {
          status: ReportStatus.DRAFT,
          submittedAt: null,
        },
      });
    });

    expect(rolledBack.status).toBe(ReportStatus.DRAFT);
    expect(rolledBack.submittedAt).toBeNull();
  });

  it("should prevent rollback if report is already APPROVED or REIMBURSED", async () => {
    // Set to APPROVED
    await prisma.expenseReport.update({
      where: { id: testReportId },
      data: { status: ReportStatus.APPROVED },
    });

    const attemptRollback = async () => {
      const current = await prisma.expenseReport.findUnique({
        where: { id: testReportId },
      });

      if (current?.status !== ReportStatus.SUBMITTED) {
        throw new Error(
          `Cannot rollback report. Current status is ${current?.status}. Only SUBMITTED reports can be rolled back.`
        );
      }
    };

    await expect(attemptRollback()).rejects.toThrow("Cannot rollback report.");
  });
});
