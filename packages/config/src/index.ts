import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://127.0.0.1:6380"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters for security"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[CRITICAL] Invalid environment variables configuration:\n${errorDetails}\nPlease check your .env file.`
    );
  }
  return parsed.data;
}

// Role Definitions for Phase 1
export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "AGENT_MANAGER",
  "RECEPTION_STAFF",
  "VIEWER",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  "workspace.read",
  "workspace.manage",
  "members.read",
  "members.manage",
  "security.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [
    "workspace.read",
    "workspace.manage",
    "members.read",
    "members.manage",
    "security.manage",
    "audit.read",
  ],
  ADMIN: ["workspace.read", "workspace.manage", "members.read", "members.manage", "audit.read"],
  AGENT_MANAGER: ["workspace.read", "members.read"],
  RECEPTION_STAFF: ["workspace.read"],
  VIEWER: ["workspace.read"],
};

export const SESSION_COOKIE_NAME = "rai_session";
export const SESSION_EXPIRY_DAYS = 7;
export const INVITATION_EXPIRY_DAYS = 7;
export const PASSWORD_RESET_EXPIRY_HOURS = 2;
export const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
