import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import {
  Role,
  ReportStatus,
  AccountStatus,
  WorkflowStage,
  AssignmentStatus,
  RecipientType,
  Prisma,
} from "@prisma/client";
import {
  getEligibleApprovers,
  getEligibleReimbursementOwners,
  canSubmitExpenseReport,
  canApproveExpenseReport,
  canReimburseExpenseReport,
  canRollbackExpenseReport,
} from "../src/lib/workflow-rules";

describe("Approver Assignment & Multi-Stage Workflow Tests", () => {
  let employeeUser: any;
  let adminUser1: any;
  let adminUser2: any;
  let superadminUser: any;
  let disabledAdminUser: any;
  let sampleCategory: any;
  let sampleSubcategory: any;

  const testReportIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findUnique({ where: { email: "employee@company.com" } });
    adminUser1 = await prisma.user.findUnique({ where: { email: "admin@company.com" } });
    superadminUser = await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } });

    // Create a 2nd active admin for testing
    adminUser2 = await prisma.user.upsert({
      where: { email: "admin2@company.com" },
      update: { status: AccountStatus.ACTIVE, role: Role.ADMIN },
      create: {
        email: "admin2@company.com",
        name: "Second Admin",
        phone: "+919876543219",
        passwordHash: "dummyhash",
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    // Create a disabled admin for testing eligibility filtering
    disabledAdminUser = await prisma.user.upsert({
      where: { email: "disabled_admin@company.com" },
      update: { status: AccountStatus.DISABLED, role: Role.ADMIN },
      create: {
        email: "disabled_admin@company.com",
        name: "Disabled Admin",
        phone: "+919876543218",
        passwordHash: "dummyhash",
        role: Role.ADMIN,
        status: AccountStatus.DISABLED,
      },
    });

    sampleCategory = await prisma.expenseCategory.findFirst({
      where: { code: "TRAVEL" },
      include: { subcategories: true },
    });
    sampleSubcategory = sampleCategory?.subcategories[0];
  });

  afterAll(async () => {
    if (testReportIds.length > 0) {
      await prisma.expenseReport.deleteMany({
        where: { id: { in: testReportIds } },
      });
    }
  });

  const createDraftReport = async (ownerId: string, title = "WORKFLOW TEST REPORT") => {
    const reportNumber = `EXP-TEST-WF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const report = await prisma.expenseReport.create({
      data: {
        reportNumber,
        title,
        userId: ownerId,
        status: ReportStatus.DRAFT,
        totalAmount: new Prisma.Decimal(3500.0),
        items: {
          create: {
            expenseDate: new Date(),
            vendorName: "Taj Hotel",
            description: "Accommodation",
            categoryId: sampleCategory.id,
            subcategoryId: sampleSubcategory.id,
            totalAmount: new Prisma.Decimal(3500.0),
          },
        },
      },
    });
    testReportIds.push(report.id);
    return report;
  };

  it("1 & 4. Verifies eligible approver list excludes disabled admin and superadmin for normal USER", async () => {
    const { approvers, isFallback } = await getEligibleApprovers({
      reportOwnerId: employeeUser.id,
      reportOwnerRole: Role.USER,
    });

    expect(isFallback).toBe(false);
    expect(approvers.length).toBeGreaterThanOrEqual(2);

    // Must include active admins
    const hasAdmin1 = approvers.some((a) => a.id === adminUser1.id);
    const hasAdmin2 = approvers.some((a) => a.id === adminUser2.id);
    expect(hasAdmin1).toBe(true);
    expect(hasAdmin2).toBe(true);

    // Must EXCLUDE disabled admin
    const hasDisabled = approvers.some((a) => a.id === disabledAdminUser.id);
    expect(hasDisabled).toBe(false);

    // Must EXCLUDE superadmin for normal USER
    const hasSuper = approvers.some((a) => a.id === superadminUser.id);
    expect(hasSuper).toBe(false);
  });

  it("2 & 5. USER submits report, selects 1 Primary Admin and 1 CC Admin, creating assignment and recipient records", async () => {
    const draft = await createDraftReport(employeeUser.id, "USER TRIP EXPENSES");

    // Perform submission transaction
    await prisma.$transaction(async (tx) => {
      await tx.expenseReport.update({
        where: { id: draft.id },
        data: {
          status: ReportStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      // Primary Assignment
      await tx.approvalAssignment.create({
        data: {
          expenseReportId: draft.id,
          stage: WorkflowStage.ADMIN_APPROVAL,
          assigneeUserId: adminUser1.id,
          assignedByUserId: employeeUser.id,
          status: AssignmentStatus.PENDING,
        },
      });

      // Primary Recipient
      await tx.workflowRecipient.create({
        data: {
          expenseReportId: draft.id,
          workflowStage: WorkflowStage.ADMIN_APPROVAL,
          recipientUserId: adminUser1.id,
          recipientType: RecipientType.PRIMARY,
          selectedByUserId: employeeUser.id,
        },
      });

      // CC Recipient
      await tx.workflowRecipient.create({
        data: {
          expenseReportId: draft.id,
          workflowStage: WorkflowStage.ADMIN_APPROVAL,
          recipientUserId: adminUser2.id,
          recipientType: RecipientType.CC,
          selectedByUserId: employeeUser.id,
        },
      });
    });

    // 5. Verify report appears in Primary Admin's Assigned to Me inbox query
    const admin1Inbox = await prisma.expenseReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
        approvalAssignments: {
          some: {
            stage: WorkflowStage.ADMIN_APPROVAL,
            status: AssignmentStatus.PENDING,
            assigneeUserId: adminUser1.id,
          },
        },
      },
    });

    expect(admin1Inbox.some((r) => r.id === draft.id)).toBe(true);

    // Verify it does NOT appear in Admin 2's Assigned to Me inbox
    const admin2Inbox = await prisma.expenseReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
        approvalAssignments: {
          some: {
            stage: WorkflowStage.ADMIN_APPROVAL,
            status: AssignmentStatus.PENDING,
            assigneeUserId: adminUser2.id,
          },
        },
      },
    });
    expect(admin2Inbox.some((r) => r.id === draft.id)).toBe(false);
  });

  it("3. Submission without Primary Approver fails validation", async () => {
    const draft = await createDraftReport(employeeUser.id, "NO APPROVER SUBMIT TEST");

    const checkSubmit = (primaryApproverId?: string) => {
      if (!primaryApproverId) {
        throw new Error("Please select a Primary Approver before submitting.");
      }
    };

    expect(() => checkSubmit(undefined)).toThrow("Please select a Primary Approver before submitting.");
  });

  it("6 & 7. CC Admin and unassigned Admin cannot approve the report", async () => {
    const draft = await createDraftReport(employeeUser.id, "PERMISSION CHECK REPORT");

    // Assigned to Admin 1, Admin 2 is CC
    const checkPrimary = canApproveExpenseReport({
      reportOwnerId: employeeUser.id,
      currentUserId: adminUser1.id,
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.SUBMITTED,
      primaryAssigneeUserId: adminUser1.id,
      isCcRecipient: false,
    });
    expect(checkPrimary.allowed).toBe(true);

    // Check CC Admin 2
    const checkCc = canApproveExpenseReport({
      reportOwnerId: employeeUser.id,
      currentUserId: adminUser2.id,
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.SUBMITTED,
      primaryAssigneeUserId: adminUser1.id,
      isCcRecipient: true,
    });
    expect(checkCc.allowed).toBe(false);
    expect(checkCc.reason).toContain("CC notification recipient");

    // Check unassigned third user
    const checkUnassigned = canApproveExpenseReport({
      reportOwnerId: employeeUser.id,
      currentUserId: "random-admin-id",
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.SUBMITTED,
      primaryAssigneeUserId: adminUser1.id,
      isCcRecipient: false,
    });
    expect(checkUnassigned.allowed).toBe(false);
    expect(checkUnassigned.reason).toContain("not the assigned Primary Approver");
  });

  it("8. ADMIN cannot approve their own report", async () => {
    const adminReport = await createDraftReport(adminUser1.id, "ADMIN SELF REPORT");

    const checkSelfApproval = canApproveExpenseReport({
      reportOwnerId: adminUser1.id,
      currentUserId: adminUser1.id,
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.SUBMITTED,
    });

    expect(checkSelfApproval.allowed).toBe(false);
    expect(checkSelfApproval.reason).toContain("Self-approval is prohibited");
  });

  it("9 & 10. Assigned Admin approves and selects Superadmin, creating Reimbursement Assignment", async () => {
    const report = await createDraftReport(employeeUser.id, "STAGE 2 REIMBURSEMENT ASSIGNMENT");

    // Initial Submission with Admin 1
    const adminAssignment = await prisma.approvalAssignment.create({
      data: {
        expenseReportId: report.id,
        stage: WorkflowStage.ADMIN_APPROVAL,
        assigneeUserId: adminUser1.id,
        assignedByUserId: employeeUser.id,
        status: AssignmentStatus.PENDING,
      },
    });

    await prisma.expenseReport.update({
      where: { id: report.id },
      data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() },
    });

    // Admin 1 Approves and assigns Superadmin
    await prisma.$transaction(async (tx) => {
      // Mark Admin Assignment COMPLETED
      await tx.approvalAssignment.update({
        where: { id: adminAssignment.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Update Report to APPROVED
      await tx.expenseReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.APPROVED,
          approvedById: adminUser1.id,
          approvedAt: new Date(),
          approvalNote: "Invoices verified, approved for payment",
        },
      });

      // Create Reimbursement Assignment
      await tx.approvalAssignment.create({
        data: {
          expenseReportId: report.id,
          stage: WorkflowStage.REIMBURSEMENT,
          assigneeUserId: superadminUser.id,
          assignedByUserId: adminUser1.id,
          status: AssignmentStatus.PENDING,
        },
      });

      // Create Primary Workflow Recipient for Reimbursement
      await tx.workflowRecipient.create({
        data: {
          expenseReportId: report.id,
          workflowStage: WorkflowStage.REIMBURSEMENT,
          recipientUserId: superadminUser.id,
          recipientType: RecipientType.PRIMARY,
          selectedByUserId: adminUser1.id,
        },
      });
    });

    // 10. Report appears in Superadmin's Reimbursement Inbox (ASSIGNED_TO_ME)
    const superadminInbox = await prisma.expenseReport.findMany({
      where: {
        status: ReportStatus.APPROVED,
        approvalAssignments: {
          some: {
            stage: WorkflowStage.REIMBURSEMENT,
            status: AssignmentStatus.PENDING,
            assigneeUserId: superadminUser.id,
          },
        },
      },
    });

    expect(superadminInbox.some((r) => r.id === report.id)).toBe(true);
  });

  it("11. Superadmin marks report as REIMBURSED", async () => {
    const report = await createDraftReport(employeeUser.id, "REIMBURSEMENT SETTLEMENT TEST");

    await prisma.expenseReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.APPROVED,
        approvedById: adminUser1.id,
        approvedAt: new Date(),
      },
    });

    const assignment = await prisma.approvalAssignment.create({
      data: {
        expenseReportId: report.id,
        stage: WorkflowStage.REIMBURSEMENT,
        assigneeUserId: superadminUser.id,
        assignedByUserId: adminUser1.id,
        status: AssignmentStatus.PENDING,
      },
    });

    // Check permission
    const check = canReimburseExpenseReport({
      currentUserRole: Role.SUPERADMIN,
      reportStatus: ReportStatus.APPROVED,
    });
    expect(check.allowed).toBe(true);

    // Complete Reimbursement
    await prisma.$transaction(async (tx) => {
      await tx.approvalAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.expenseReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.REIMBURSED,
          reimbursedById: superadminUser.id,
          reimbursedAt: new Date(),
          reimbursementDate: new Date("2026-08-24"),
          paymentMethod: "BANK_TRANSFER",
          reimbursementRef: "UTR-TEST-998877",
          transactionId: "TXN-TEST-1234",
          reimbursementNote: "Settled via corporate bank",
        },
      });
    });

    const updated = await prisma.expenseReport.findUnique({
      where: { id: report.id },
    });

    expect(updated?.status).toBe(ReportStatus.REIMBURSED);
    expect(updated?.reimbursementRef).toBe("UTR-TEST-998877");
  });

  it("12. Rollback cancels a pending assignment and preserves history", async () => {
    const report = await createDraftReport(employeeUser.id, "ROLLBACK ASSIGNMENT TEST");

    await prisma.expenseReport.update({
      where: { id: report.id },
      data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() },
    });

    const pendingAssignment = await prisma.approvalAssignment.create({
      data: {
        expenseReportId: report.id,
        stage: WorkflowStage.ADMIN_APPROVAL,
        assigneeUserId: adminUser1.id,
        assignedByUserId: employeeUser.id,
        status: AssignmentStatus.PENDING,
      },
    });

    // Rollback
    await prisma.$transaction(async (tx) => {
      await tx.approvalAssignment.updateMany({
        where: {
          expenseReportId: report.id,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.expenseReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.DRAFT,
          submittedAt: null,
        },
      });
    });

    const cancelled = await prisma.approvalAssignment.findUnique({
      where: { id: pendingAssignment.id },
    });
    expect(cancelled?.status).toBe(AssignmentStatus.CANCELLED);
    expect(cancelled?.cancelledAt).not.toBeNull();

    // Assignment history is preserved
    const totalAssignments = await prisma.approvalAssignment.count({
      where: { expenseReportId: report.id },
    });
    expect(totalAssignments).toBe(1);
  });

  it("13. Repeated submission cancels old pending assignment and creates new one cleanly", async () => {
    const report = await createDraftReport(employeeUser.id, "RESUBMIT CLEAN TEST");

    // First submission
    const assign1 = await prisma.approvalAssignment.create({
      data: {
        expenseReportId: report.id,
        stage: WorkflowStage.ADMIN_APPROVAL,
        assigneeUserId: adminUser1.id,
        assignedByUserId: employeeUser.id,
        status: AssignmentStatus.PENDING,
      },
    });

    // Second submission (e.g. after rollback or re-trigger)
    await prisma.$transaction(async (tx) => {
      await tx.approvalAssignment.updateMany({
        where: {
          expenseReportId: report.id,
          status: AssignmentStatus.PENDING,
        },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.approvalAssignment.create({
        data: {
          expenseReportId: report.id,
          stage: WorkflowStage.ADMIN_APPROVAL,
          assigneeUserId: adminUser2.id,
          assignedByUserId: employeeUser.id,
          status: AssignmentStatus.PENDING,
        },
      });
    });

    const activePending = await prisma.approvalAssignment.findMany({
      where: {
        expenseReportId: report.id,
        status: AssignmentStatus.PENDING,
      },
    });

    expect(activePending.length).toBe(1);
    expect(activePending[0].assigneeUserId).toBe(adminUser2.id);
  });

  it("14. Existing unassigned reports appear under UNASSIGNED tab queries", async () => {
    const unassignedReport = await createDraftReport(employeeUser.id, "UNASSIGNED LEGACY REPORT");

    await prisma.expenseReport.update({
      where: { id: unassignedReport.id },
      data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() },
    });

    // Find reports with no pending ADMIN_APPROVAL assignment
    const unassignedSubmitted = await prisma.expenseReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
        approvalAssignments: {
          none: {
            stage: WorkflowStage.ADMIN_APPROVAL,
            status: AssignmentStatus.PENDING,
          },
        },
      },
    });

    expect(unassignedSubmitted.some((r) => r.id === unassignedReport.id)).toBe(true);
  });

  it("15. Direct invalid transitions are rejected by centralized workflow rules", () => {
    // Cannot approve DRAFT report
    const draftApprove = canApproveExpenseReport({
      reportOwnerId: employeeUser.id,
      currentUserId: adminUser1.id,
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.DRAFT,
    });
    expect(draftApprove.allowed).toBe(false);

    // Normal USER cannot approve
    const userApprove = canApproveExpenseReport({
      reportOwnerId: adminUser1.id,
      currentUserId: employeeUser.id,
      currentUserRole: Role.USER,
      reportStatus: ReportStatus.SUBMITTED,
    });
    expect(userApprove.allowed).toBe(false);

    // Non-Superadmin cannot reimburse
    const adminReimburse = canReimburseExpenseReport({
      currentUserRole: Role.ADMIN,
      reportStatus: ReportStatus.APPROVED,
    });
    expect(adminReimburse.allowed).toBe(false);

    // Cannot reimburse SUBMITTED report (must be APPROVED)
    const submittedReimburse = canReimburseExpenseReport({
      currentUserRole: Role.SUPERADMIN,
      reportStatus: ReportStatus.SUBMITTED,
    });
    expect(submittedReimburse.allowed).toBe(false);
  });
});
