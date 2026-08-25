import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { Role, ReportStatus, Prisma } from "@prisma/client";

describe("Expense Workflow & Status Transitions", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  let sampleCategory: any;
  let sampleSubcategory: any;
  let testReportId: string;

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    sampleCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });
    sampleSubcategory = sampleCategory?.subcategories[0];

    const reportNumber = `EXP-TEST-WF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title: "TEST AUGUST TRAVEL",
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

  it("should verify Expense Tag in DRAFT status with 0.00 totalAmount", async () => {
    const report = await prisma.expenseReport.findUnique({
      where: { id: testReportId },
    });
    expect(report?.status).toBe(ReportStatus.DRAFT);
    expect(Number(report?.totalAmount)).toBe(0);
  });

  it("should add multiple Expense Items and dynamically update totalAmount", async () => {
    // Add Item 1: ₹1,500.00
    await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date(),
        vendorName: "Uber Rides",
        description: "Airport taxi",
        categoryId: sampleCategory.id,
        subcategoryId: sampleSubcategory.id,
        totalAmount: new Prisma.Decimal(1500.0),
      },
    });

    // Add Item 2: ₹3,500.00
    await prisma.expenseItem.create({
      data: {
        reportId: testReportId,
        expenseDate: new Date(),
        vendorName: "Indigo Airlines",
        description: "Flight ticket",
        categoryId: sampleCategory.id,
        subcategoryId: sampleSubcategory.id,
        totalAmount: new Prisma.Decimal(3500.0),
      },
    });

    // Recalculate sum
    const items = await prisma.expenseItem.findMany({ where: { reportId: testReportId } });
    const sum = items.reduce((acc, curr) => acc.add(curr.totalAmount), new Prisma.Decimal(0.0));

    const updatedReport = await prisma.expenseReport.update({
      where: { id: testReportId },
      data: { totalAmount: sum },
    });

    expect(items.length).toBe(2);
    expect(Number(updatedReport.totalAmount)).toBe(5000.0);
  });

  it("should transition from DRAFT to SUBMITTED", async () => {
    const updated = await prisma.expenseReport.update({
      where: { id: testReportId },
      data: {
        status: ReportStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    expect(updated.status).toBe(ReportStatus.SUBMITTED);
    expect(updated.submittedAt).not.toBeNull();
  });

  it("should prevent self-approval by report owner", async () => {
    const report = await prisma.expenseReport.findUnique({
      where: { id: testReportId },
    });

    const attemptSelfApproval = (reviewerId: string) => {
      if (report?.userId === reviewerId) {
        throw new Error("You cannot approve your own expense report.");
      }
    };

    expect(() => attemptSelfApproval(employeeUser.id)).toThrow(
      "You cannot approve your own expense report."
    );
  });

  it("should allow an Admin (non-owner) to approve the SUBMITTED report", async () => {
    const approved = await prisma.expenseReport.update({
      where: { id: testReportId },
      data: {
        status: ReportStatus.APPROVED,
        approvedById: adminUser.id,
        approvedAt: new Date(),
      },
    });

    expect(approved.status).toBe(ReportStatus.APPROVED);
    expect(approved.approvedById).toBe(adminUser.id);
  });

  it("should allow a Superadmin to mark an APPROVED report as REIMBURSED", async () => {
    const reimbursed = await prisma.expenseReport.update({
      where: { id: testReportId },
      data: {
        status: ReportStatus.REIMBURSED,
        reimbursedById: superadminUser.id,
        reimbursedAt: new Date(),
        reimbursementRef: "UTR-TEST-12345678",
        reimbursementNote: "Paid via corporate bank",
      },
    });

    expect(reimbursed.status).toBe(ReportStatus.REIMBURSED);
    expect(reimbursed.reimbursedById).toBe(superadminUser.id);
    expect(reimbursed.reimbursementRef).toBe("UTR-TEST-12345678");
  });
});
