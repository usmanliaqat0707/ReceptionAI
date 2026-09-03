import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Permission, ROLE_PERMISSIONS, WorkspaceRole } from "@receptionai/config";

const SALT_ROUNDS = 12;

/**
 * Generates an opaque cryptographically secure random token (e.g. for session cookies or reset links).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Computes the SHA-256 hash of an opaque token.
 * Raw tokens are never stored in the database; only token hashes are persisted.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time string comparison to defend against timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Secure password hashing using bcrypt with 12 rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Verifies if a given workspace role holds a specific permission.
 */
export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return (permissions as readonly string[]).includes(permission);
}

/**
 * Enforces role hierarchy rules:
 * - Only an OWNER can assign or remove an OWNER.
 * - An ADMIN can only manage roles below ADMIN (AGENT_MANAGER, RECEPTION_STAFF, VIEWER).
 * - Other roles cannot manage any members.
 */
export function canManageTargetRole(
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  newRole?: WorkspaceRole
): boolean {
  if (actorRole === "OWNER") return true;

  if (actorRole === "ADMIN") {
    // Admin cannot modify an Owner, nor grant Owner role
    if (targetCurrentRole === "OWNER") return false;
    if (newRole === "OWNER") return false;
    return true;
  }

  return false;
}
