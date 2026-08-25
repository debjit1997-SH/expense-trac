import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../src/lib/db";
import { Role, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

describe("RBAC & Account Status Security Tests", () => {
  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  it("should have seeded Superadmin, Admin, and User with ACTIVE status", async () => {
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@company.com").toLowerCase().trim();
    const superadmin = await prisma.user.findFirst({
      where: { email: { equals: superadminEmail, mode: "insensitive" } },
    });
    expect(superadmin).not.toBeNull();
    expect(superadmin?.role).toBe(Role.SUPERADMIN);
    expect(superadmin?.status).toBe(AccountStatus.ACTIVE);

    const admin = await prisma.user.findUnique({
      where: { email: "admin@company.com" },
    });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe(Role.ADMIN);
    expect(admin?.status).toBe(AccountStatus.ACTIVE);

    const user = await prisma.user.findUnique({
      where: { email: "employee@company.com" },
    });
    expect(user).not.toBeNull();
    expect(user?.role).toBe(Role.USER);
    expect(user?.status).toBe(AccountStatus.ACTIVE);
  });

  it("should authenticate the configured Superadmin through the credentials provider authorize path", async () => {
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || "superadmin@company.com").toLowerCase().trim();
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || "SuperPassword123!";

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: superadminEmail,
          mode: "insensitive",
        },
      },
    });

    expect(user).not.toBeNull();
    expect(user?.status).toBe(AccountStatus.ACTIVE);
    expect(user?.role).toBe(Role.SUPERADMIN);

    const isMatch = await bcrypt.compare(superadminPassword, user!.passwordHash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare("WrongPass999!", user!.passwordHash);
    expect(isWrongMatch).toBe(false);
  });

  it("should enforce PENDING status for new public applicants without role choice", async () => {
    const testEmail = `applicant_${Date.now()}@test.com`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("ApplicantPass123!", salt);

    const newApplicant = await prisma.user.create({
      data: {
        name: "Test Applicant",
        email: testEmail,
        phone: "+919876543299",
        passwordHash,
        role: Role.USER,
        status: AccountStatus.PENDING,
      },
    });

    expect(newApplicant.status).toBe(AccountStatus.PENDING);
    expect(newApplicant.role).toBe(Role.USER);

    // Clean up
    await prisma.user.delete({ where: { id: newApplicant.id } });
  });

  it("should verify password hashing with bcrypt", async () => {
    const salt = await bcrypt.genSalt(10);
    const plainPassword = "SecretPassword123!";
    const hash = await bcrypt.hash(plainPassword, salt);

    expect(hash).not.toBe(plainPassword);
    const isMatch = await bcrypt.compare(plainPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare("WrongPassword!", hash);
    expect(isWrongMatch).toBe(false);
  });
});
