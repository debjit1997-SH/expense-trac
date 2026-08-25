"use server";

import prisma from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { Role, AccountStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import {
  ApproveUserSchema,
  RejectUserSchema,
  DeactivateUserSchema,
  ActivateUserSchema,
  UpdateUserRoleSchema,
} from "@/lib/validations/auth.schema";
import { revalidatePath } from "next/cache";

/**
 * Get all pending access requests
 */
export async function getAccessRequestsAction() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { status: AccountStatus.PENDING },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Get all active users
 */
export async function getActiveUsersAction() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { status: AccountStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      accessHistories: {
        orderBy: { timestamp: "desc" },
        take: 1,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });
}

/**
 * Get all rejected access requests
 */
export async function getRejectedRequestsAction() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { status: AccountStatus.REJECTED },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      accessHistories: {
        orderBy: { timestamp: "desc" },
        take: 1,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });
}

/**
 * Get all disabled users
 */
export async function getDisabledUsersAction() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { status: AccountStatus.DISABLED },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      accessHistories: {
        orderBy: { timestamp: "desc" },
        take: 1,
        include: {
          actor: { select: { name: true, email: true } },
        },
      },
    },
  });
}

/**
 * Approve a pending access request and assign a role
 */
export async function approveAccessRequestAction(data: {
  userId: string;
  role: Role;
  reason?: string;
}) {
  try {
    const adminUser = await requireAdmin();
    const validated = ApproveUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { userId, role, reason } = validated.data;

    // ADMIN cannot assign SUPERADMIN role
    if (adminUser.role === Role.ADMIN && role === Role.SUPERADMIN) {
      return {
        success: false,
        error: "Admins cannot assign the Superadmin role.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    if (targetUser.status !== AccountStatus.PENDING) {
      return {
        success: false,
        error: `User is not in PENDING status (current: ${targetUser.status}).`,
      };
    }

    // Execute in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.ACTIVE,
          role: role,
          rejectionReason: null,
        },
      });

      // Record approval history
      await tx.accessApprovalHistory.create({
        data: {
          userId: user.id,
          actorId: adminUser.id,
          action: AccountStatus.ACTIVE,
          assignedRole: role,
          reason: reason || "Access request approved",
        },
      });

      // Record audit log
      await logAudit({
        actorId: adminUser.id,
        action: "ACCESS_REQUEST_APPROVED",
        entityType: "User",
        entityId: user.id,
        previousVal: { status: targetUser.status, role: targetUser.role },
        newVal: { status: AccountStatus.ACTIVE, role },
        reason: reason || "Access request approved",
        tx,
      });

      return user;
    });

    revalidatePath("/user-management");
    return { success: true, user: updated };
  } catch (error: any) {
    console.error("approveAccessRequestAction error:", error);
    return { success: false, error: error.message || "Failed to approve request." };
  }
}

/**
 * Reject a pending access request
 */
export async function rejectAccessRequestAction(data: {
  userId: string;
  reason?: string;
}) {
  try {
    const adminUser = await requireAdmin();
    const validated = RejectUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { userId, reason } = validated.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    if (targetUser.role === Role.SUPERADMIN && adminUser.role === Role.ADMIN) {
      return { success: false, error: "Admin cannot modify a Superadmin account." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.REJECTED,
          rejectionReason: reason || "Access request rejected",
        },
      });

      await tx.accessApprovalHistory.create({
        data: {
          userId,
          actorId: adminUser.id,
          action: AccountStatus.REJECTED,
          reason: reason || "Access request rejected",
        },
      });

      await logAudit({
        actorId: adminUser.id,
        action: "ACCESS_REQUEST_REJECTED",
        entityType: "User",
        entityId: userId,
        previousVal: { status: targetUser.status },
        newVal: { status: AccountStatus.REJECTED, rejectionReason: reason },
        reason: reason || "Access request rejected",
        tx,
      });
    });

    revalidatePath("/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("rejectAccessRequestAction error:", error);
    return { success: false, error: error.message || "Failed to reject request." };
  }
}

/**
 * Deactivate / Disable an active user account
 */
export async function deactivateUserAction(data: {
  userId: string;
  reason?: string;
}) {
  try {
    const adminUser = await requireAdmin();
    const validated = DeactivateUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { userId, reason } = validated.data;

    // Rule: ADMIN cannot disable their own account
    if (adminUser.id === userId) {
      return { success: false, error: "You cannot disable your own account." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    // Rule: ADMIN cannot modify or disable a SUPERADMIN
    if (targetUser.role === Role.SUPERADMIN && adminUser.role === Role.ADMIN) {
      return {
        success: false,
        error: "Admins cannot disable a Superadmin account.",
      };
    }

    // Rule: SUPERADMIN cannot disable their own account if they are the final active SUPERADMIN
    if (targetUser.role === Role.SUPERADMIN) {
      const activeSuperadminCount = await prisma.user.count({
        where: {
          role: Role.SUPERADMIN,
          status: AccountStatus.ACTIVE,
        },
      });

      if (activeSuperadminCount <= 1) {
        return {
          success: false,
          error: "Cannot disable the final active Superadmin account.",
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: AccountStatus.DISABLED },
      });

      await tx.accessApprovalHistory.create({
        data: {
          userId,
          actorId: adminUser.id,
          action: AccountStatus.DISABLED,
          reason: reason || "User account disabled",
        },
      });

      await logAudit({
        actorId: adminUser.id,
        action: "USER_DEACTIVATED",
        entityType: "User",
        entityId: userId,
        previousVal: { status: targetUser.status },
        newVal: { status: AccountStatus.DISABLED },
        reason: reason || "User account disabled",
        tx,
      });
    });

    revalidatePath("/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("deactivateUserAction error:", error);
    return { success: false, error: error.message || "Failed to disable user." };
  }
}

/**
 * Re-activate a disabled user account
 */
export async function activateUserAction(data: {
  userId: string;
  reason?: string;
}) {
  try {
    const adminUser = await requireAdmin();
    const validated = ActivateUserSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { userId, reason } = validated.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    if (targetUser.role === Role.SUPERADMIN && adminUser.role === Role.ADMIN) {
      return {
        success: false,
        error: "Admins cannot modify a Superadmin account.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: AccountStatus.ACTIVE },
      });

      await tx.accessApprovalHistory.create({
        data: {
          userId,
          actorId: adminUser.id,
          action: AccountStatus.ACTIVE,
          reason: reason || "User account re-activated",
        },
      });

      await logAudit({
        actorId: adminUser.id,
        action: "USER_ACTIVATED",
        entityType: "User",
        entityId: userId,
        previousVal: { status: targetUser.status },
        newVal: { status: AccountStatus.ACTIVE },
        reason: reason || "User account re-activated",
        tx,
      });
    });

    revalidatePath("/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("activateUserAction error:", error);
    return { success: false, error: error.message || "Failed to activate user." };
  }
}

/**
 * Change role of an existing user
 */
export async function updateUserRoleAction(data: {
  userId: string;
  role: Role;
  reason?: string;
}) {
  try {
    const adminUser = await requireAdmin();
    const validated = UpdateUserRoleSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const { userId, role, reason } = validated.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    // Rules:
    // ADMIN cannot modify a SUPERADMIN
    if (targetUser.role === Role.SUPERADMIN && adminUser.role === Role.ADMIN) {
      return { success: false, error: "Admins cannot modify a Superadmin." };
    }
    // ADMIN cannot promote anyone to SUPERADMIN
    if (role === Role.SUPERADMIN && adminUser.role === Role.ADMIN) {
      return { success: false, error: "Admins cannot promote a user to Superadmin." };
    }
    // SUPERADMIN cannot demote the last active superadmin
    if (targetUser.role === Role.SUPERADMIN && role !== Role.SUPERADMIN) {
      const superCount = await prisma.user.count({
        where: { role: Role.SUPERADMIN, status: AccountStatus.ACTIVE },
      });
      if (superCount <= 1) {
        return { success: false, error: "Cannot demote the final active Superadmin." };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role },
      });

      await logAudit({
        actorId: adminUser.id,
        action: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: userId,
        previousVal: { role: targetUser.role },
        newVal: { role },
        reason: reason || "User role updated",
        tx,
      });
    });

    revalidatePath("/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("updateUserRoleAction error:", error);
    return { success: false, error: error.message || "Failed to update user role." };
  }
}
