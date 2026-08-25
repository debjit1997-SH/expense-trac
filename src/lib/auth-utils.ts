import { auth } from "./auth";
import { Role, AccountStatus, ReportStatus } from "@prisma/client";
import prisma from "./db";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: AccountStatus;
}

/**
 * Get current authenticated user session
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name || "User",
    email: session.user.email || "",
    phone: session.user.phone || "",
    role: session.user.role as Role,
    status: session.user.status as AccountStatus,
  };
}

/**
 * Enforce that the user is logged in and is in ACTIVE status
 */
export async function requireActiveUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required. Please sign in.");
  }
  if (user.status !== AccountStatus.ACTIVE) {
    throw new Error("Your account is not active.");
  }
  return user;
}

/**
 * Enforce that the user is an ADMIN or SUPERADMIN
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireActiveUser();
  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  return user;
}

/**
 * Enforce that the user is a SUPERADMIN
 */
export async function requireSuperAdmin(): Promise<AuthenticatedUser> {
  const user = await requireActiveUser();
  if (user.role !== Role.SUPERADMIN) {
    throw new Error("Unauthorized: Superadmin privileges required.");
  }
  return user;
}

/**
 * Verify access permissions on an Expense Report
 */
export async function verifyReportAccess(
  reportId: string,
  user: AuthenticatedUser,
  action: "VIEW" | "EDIT" | "SUBMIT" | "ROLLBACK" | "APPROVE" | "REIMBURSE"
) {
  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: {
      items: true,
      evidences: true,
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!report) {
    throw new Error("Expense report not found.");
  }

  const isOwner = report.userId === user.id;
  const isAdminOrSuper = user.role === Role.ADMIN || user.role === Role.SUPERADMIN;
  const isSuperAdmin = user.role === Role.SUPERADMIN;

  switch (action) {
    case "VIEW": {
      // DRAFT is visible ONLY to the owner
      if (report.status === ReportStatus.DRAFT) {
        if (!isOwner) {
          throw new Error("You are not authorized to view another user's draft report.");
        }
        return report;
      }
      // SUBMITTED / APPROVED / REIMBURSED
      if (isOwner || isAdminOrSuper) {
        return report;
      }
      throw new Error("Unauthorized to view this expense report.");
    }

    case "EDIT": {
      // Only owner can edit, and only when status is DRAFT
      if (!isOwner) {
        throw new Error("You can only edit your own expense reports.");
      }
      if (report.status !== ReportStatus.DRAFT) {
        throw new Error("Only reports in DRAFT status can be modified.");
      }
      return report;
    }

    case "SUBMIT": {
      // Only owner can submit, and only when status is DRAFT
      if (!isOwner) {
        throw new Error("You can only submit your own expense reports.");
      }
      if (report.status !== ReportStatus.DRAFT) {
        throw new Error("Only reports in DRAFT status can be submitted.");
      }
      if (report.items.length === 0) {
        throw new Error("Cannot submit an empty expense report. Add at least one expense item.");
      }
      return report;
    }

    case "ROLLBACK": {
      // Only owner can rollback, and only when status is SUBMITTED
      if (!isOwner) {
        throw new Error("Only the report owner can initiate a rollback.");
      }
      if (report.status !== ReportStatus.SUBMITTED) {
        throw new Error("Only SUBMITTED reports can be rolled back to DRAFT.");
      }
      return report;
    }

    case "APPROVE": {
      // Must be Admin or Superadmin
      if (!isAdminOrSuper) {
        throw new Error("Only Admins and Superadmins can approve reports.");
      }
      // CANNOT approve own report
      if (isOwner) {
        throw new Error("You cannot approve your own expense report.");
      }
      if (report.status !== ReportStatus.SUBMITTED) {
        throw new Error("Only SUBMITTED reports can be approved.");
      }
      return report;
    }

    case "REIMBURSE": {
      // ONLY Superadmin
      if (!isSuperAdmin) {
        throw new Error("Only Superadmins can mark an expense report as reimbursed.");
      }
      // Must be in APPROVED status first
      if (report.status !== ReportStatus.APPROVED) {
        throw new Error("Report must be in APPROVED status before it can be reimbursed.");
      }
      return report;
    }

    default:
      throw new Error("Unknown action.");
  }
}
