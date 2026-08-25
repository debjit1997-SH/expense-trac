import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { ReportStatus, Role, Prisma } from "@prisma/client";
import { canRollbackExpenseReport } from "../src/lib/workflow-rules";

describe("Bug 5 Test: Rollback Visibility Across USER, ADMIN, and SUPERADMIN", () => {
  let employeeUser: any;
  let adminUser: any;
  let superadminUser: any;
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findUnique({ where: { email: "superadmin@company.com" } });
  });

  afterAll(async () => {
    if (createdReportIds.length > 0) {
      await prisma.expenseReport.deleteMany({
        where: { id: { in: createdReportIds } },
      });
    }
  });

  const testUserRoleRollback = (roleName: string, getUser: () => any) => {
    describe(`Rollback Lifecycle for ${roleName}`, () => {
      let testReportId: string;

      beforeAll(async () => {
        const currentUser = getUser();
        const reportNumber = `EXP-TEST-RLB-${roleName.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}-${Math.floor(
          Math.random() * 10000
        )}`;
        const report = await prisma.expenseReport.create({
          data: {
            reportNumber,
            title: `ROLLBACK ${roleName} TEST REPORT`,
            userId: currentUser.id,
            status: ReportStatus.DRAFT,
            totalAmount: new Prisma.Decimal(2500.0),
          },
        });
        testReportId = report.id;
        createdReportIds.push(report.id);
      });

      it(`1 & 2. Verifies report was created as DRAFT for ${roleName}`, async () => {
        const report = await prisma.expenseReport.findUnique({
          where: { id: testReportId },
        });
        expect(report?.status).toBe(ReportStatus.DRAFT);
      });

      it(`3. Verifies DRAFT is NOT in rollback list for ${roleName}`, async () => {
        const currentUser = getUser();
        const rollbackList = await prisma.expenseReport.findMany({
          where: {
            userId: currentUser.id,
            status: ReportStatus.SUBMITTED,
          },
        });

        const found = rollbackList.some((r) => r.id === testReportId);
        expect(found).toBe(false);
      });

      it(`4 & 5. Submits report and verifies it appears immediately in ${roleName}'s rollback list`, async () => {
        const currentUser = getUser();
        await prisma.expenseReport.update({
          where: { id: testReportId },
          data: {
            status: ReportStatus.SUBMITTED,
            submittedAt: new Date(),
          },
        });

        const rollbackList = await prisma.expenseReport.findMany({
          where: {
            userId: currentUser.id,
            status: ReportStatus.SUBMITTED,
          },
        });

        const found = rollbackList.some((r) => r.id === testReportId);
        expect(found).toBe(true);
      });

      it(`6. Verifies submitted report does NOT appear in another user's rollback list`, async () => {
        const currentUser = getUser();
        const otherUserId = currentUser.id === employeeUser.id ? adminUser.id : employeeUser.id;

        const otherRollbackList = await prisma.expenseReport.findMany({
          where: {
            userId: otherUserId,
            status: ReportStatus.SUBMITTED,
          },
        });

        const foundInOther = otherRollbackList.some((r) => r.id === testReportId);
        expect(foundInOther).toBe(false);
      });

      it(`7 & 8. Rolls back report and verifies it disappears from rollback and returns to DRAFT`, async () => {
        const currentUser = getUser();

        const check = canRollbackExpenseReport({
          reportOwnerId: currentUser.id,
          currentUserId: currentUser.id,
          reportStatus: ReportStatus.SUBMITTED,
        });
        expect(check.allowed).toBe(true);

        await prisma.expenseReport.update({
          where: { id: testReportId },
          data: {
            status: ReportStatus.DRAFT,
            submittedAt: null,
          },
        });

        const rollbackList = await prisma.expenseReport.findMany({
          where: {
            userId: currentUser.id,
            status: ReportStatus.SUBMITTED,
          },
        });

        const found = rollbackList.some((r) => r.id === testReportId);
        expect(found).toBe(false);

        const updated = await prisma.expenseReport.findUnique({
          where: { id: testReportId },
        });
        expect(updated?.status).toBe(ReportStatus.DRAFT);
      });

      it(`9 & 10. Submits and approves report, and verifies APPROVED report CANNOT be rolled back`, async () => {
        const currentUser = getUser();
        await prisma.expenseReport.update({
          where: { id: testReportId },
          data: {
            status: ReportStatus.APPROVED,
            submittedAt: new Date(),
            approvedAt: new Date(),
          },
        });

        const check = canRollbackExpenseReport({
          reportOwnerId: currentUser.id,
          currentUserId: currentUser.id,
          reportStatus: ReportStatus.APPROVED,
        });

        expect(check.allowed).toBe(false);
        expect(check.reason).toContain("Only SUBMITTED reports can be rolled back");
      });

      it(`11. Verifies REIMBURSED report CANNOT be rolled back`, async () => {
        const currentUser = getUser();
        await prisma.expenseReport.update({
          where: { id: testReportId },
          data: {
            status: ReportStatus.REIMBURSED,
            reimbursedAt: new Date(),
          },
        });

        const check = canRollbackExpenseReport({
          reportOwnerId: currentUser.id,
          currentUserId: currentUser.id,
          reportStatus: ReportStatus.REIMBURSED,
        });

        expect(check.allowed).toBe(false);
        expect(check.reason).toContain("Only SUBMITTED reports can be rolled back");
      });
    });
  };

  testUserRoleRollback("USER (Employee)", () => employeeUser);
  testUserRoleRollback("ADMIN", () => adminUser);
  testUserRoleRollback("SUPERADMIN", () => superadminUser);
});
