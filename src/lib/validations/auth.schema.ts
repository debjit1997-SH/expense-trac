import { z } from "zod";

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const RequestAccessSchema = z
  .object({
    name: z.string().min(2, "Full Name must be at least 2 characters").trim(),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .max(15, "Phone number is too long")
      .regex(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
        "Invalid phone number format"
      )
      .trim(),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address")
      .transform((val) => val.toLowerCase().trim()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Confirm Password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ApproveUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]),
  reason: z.string().optional(),
});

export const RejectUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().optional(),
});

export const DeactivateUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().optional(),
});

export const ActivateUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().optional(),
});

export const UpdateUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["USER", "ADMIN", "SUPERADMIN"]),
  reason: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RequestAccessInput = z.infer<typeof RequestAccessSchema>;
export type ApproveUserInput = z.infer<typeof ApproveUserSchema>;
export type RejectUserInput = z.infer<typeof RejectUserSchema>;
