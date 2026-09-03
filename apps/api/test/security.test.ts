import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  timingSafeCompare,
  hasPermission,
  canManageTargetRole,
} from "@receptionai/security";

describe("Phase 1 Security Utilities", () => {
  it("should securely hash and verify passwords using bcrypt (12 rounds)", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$")).toBe(true);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword", hash);
    expect(isInvalid).toBe(false);
  });

  it("should generate cryptographically secure opaque tokens and deterministic hashes", () => {
    const rawToken = generateSecureToken(32);
    expect(rawToken).toHaveLength(64); // 32 bytes hex = 64 characters

    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex = 64 characters
    expect(hash1).not.toBe(rawToken);
  });

  it("should perform timing-safe string comparisons correctly", () => {
    const str = "d41d8cd98f00b204e9800998ecf8427e";
    expect(timingSafeCompare(str, str)).toBe(true);
    expect(timingSafeCompare(str, "different-string")).toBe(false);
    expect(timingSafeCompare(str, str.slice(0, -1))).toBe(false);
  });

  it("should enforce the centralized role permission matrix", () => {
    // OWNER has all permissions
    expect(hasPermission("OWNER", "workspace.manage")).toBe(true);
    expect(hasPermission("OWNER", "members.manage")).toBe(true);
    expect(hasPermission("OWNER", "audit.read")).toBe(true);

    // ADMIN can manage members and workspace, but not security.manage
    expect(hasPermission("ADMIN", "workspace.manage")).toBe(true);
    expect(hasPermission("ADMIN", "members.manage")).toBe(true);
    expect(hasPermission("ADMIN", "security.manage")).toBe(false);

    // AGENT_MANAGER can read members and workspace, cannot manage
    expect(hasPermission("AGENT_MANAGER", "workspace.read")).toBe(true);
    expect(hasPermission("AGENT_MANAGER", "members.read")).toBe(true);
    expect(hasPermission("AGENT_MANAGER", "members.manage")).toBe(false);

    // VIEWER can only read workspace
    expect(hasPermission("VIEWER", "workspace.read")).toBe(true);
    expect(hasPermission("VIEWER", "members.read")).toBe(false);
    expect(hasPermission("VIEWER", "workspace.manage")).toBe(false);
  });

  it("should enforce role management hierarchy safeguards", () => {
    // OWNER can manage any role
    expect(canManageTargetRole("OWNER", "ADMIN", "AGENT_MANAGER")).toBe(true);
    expect(canManageTargetRole("OWNER", "OWNER", "ADMIN")).toBe(true);

    // ADMIN cannot modify or grant OWNER role
    expect(canManageTargetRole("ADMIN", "OWNER", "ADMIN")).toBe(false);
    expect(canManageTargetRole("ADMIN", "VIEWER", "OWNER")).toBe(false);
    expect(canManageTargetRole("ADMIN", "VIEWER", "RECEPTION_STAFF")).toBe(true);

    // VIEWER or STAFF cannot manage any role
    expect(canManageTargetRole("VIEWER", "VIEWER")).toBe(false);
    expect(canManageTargetRole("RECEPTION_STAFF", "VIEWER")).toBe(false);
  });
});
