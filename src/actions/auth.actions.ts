"use server";

import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { RequestAccessSchema, RequestAccessInput } from "@/lib/validations/auth.schema";
import { Role, AccountStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";

export async function requestAccessAction(data: RequestAccessInput) {
  try {
    const validated = RequestAccessSchema.safeParse(data);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || "Invalid input data",
      };
    }

    const { name, email, phone, password } = validated.data;
    const lowerEmail = email.toLowerCase().trim();

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (existingUser) {
      return {
        success: false,
        error: "An account with this email address already exists.",
      };
    }

    // Secure password hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user strictly with PENDING status and USER role
    const newUser = await prisma.user.create({
      data: {
        name,
        email: lowerEmail,
        phone,
        passwordHash,
        role: Role.USER,
        status: AccountStatus.PENDING,
      },
    });

    // Audit log
    await logAudit({
      actorId: newUser.id,
      action: "ACCESS_REQUEST_SUBMITTED",
      entityType: "User",
      entityId: newUser.id,
      newVal: { email: lowerEmail, name, phone, role: Role.USER, status: AccountStatus.PENDING },
      reason: "Public access request registration",
    });

    return {
      success: true,
      message: "Your access request has been submitted successfully and is awaiting administrator approval.",
    };
  } catch (error: any) {
    console.error("requestAccessAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to submit access request. Please try again later.",
    };
  }
}
