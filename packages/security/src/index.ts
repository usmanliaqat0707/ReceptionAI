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

/**
 * Validates and normalizes phone numbers into standard E.164 format.
 * Rejects numbers that do not match E.164 (+ followed by 7 to 15 digits).
 */
export function normalizeE164(phone: string): string {
  const trimmed = phone.trim();
  // Remove formatting characters (spaces, dashes, parens)
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, "");
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    throw new Error(
      `Invalid phone number format: "${phone}". Must be valid E.164 starting with '+' followed by 7 to 15 digits.`
    );
  }
  return cleaned;
}

/**
 * Masks a phone number for safe display in UI/logs (e.g. "+15555550100" -> "+1 555 *** 0100").
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  const start = phone.slice(0, 5);
  const end = phone.slice(-4);
  return `${start} *** ${end}`;
}

/**
 * Encrypts sensitive credentials or tokens at rest using AES-256-GCM.
 * Output format: iv:authTag:ciphertext in hex encoding.
 */
export function encryptText(plaintext: string, secretKey: string): string {
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts AES-256-GCM encrypted tokens.
 */
export function decryptText(encryptedString: string, secretKey: string): string {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format. Expected iv:authTag:ciphertext.");
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

