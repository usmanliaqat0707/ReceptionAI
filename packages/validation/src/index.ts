import { z } from "zod";
import { WORKSPACE_ROLES } from "@receptionai/config";

// Authentication Schemas
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address format")
  .max(255, "Email is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Workspace Schemas
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(100),
  industry: z
    .string()
    .trim()
    .min(2, "Industry must be specified")
    .max(100)
    .default("General Business"),
  timezone: z.string().trim().min(2, "Timezone is required").default("America/New_York"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100)
    .optional(),
  industry: z.string().trim().min(2).max(100).optional(),
  timezone: z.string().trim().min(2).optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// Member & Invitation Schemas
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(WORKSPACE_ROLES),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// Security Schemas
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
