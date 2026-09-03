import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app";
import { FastifyInstance } from "fastify";
import { prisma, User, Workspace } from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";

describe("Phase 1 Multi-Tenancy & Authorization Integration Tests", () => {
  let app: FastifyInstance;

  // Tenant A: Alpha Corp (User A is OWNER)
  let userA: User;
  let workspaceA: Workspace;
  let cookieA: string;

  // Tenant B: Beta LLC (User B is OWNER)
  let userB: User;
  let workspaceB: Workspace;
  let cookieB: string;

  // User C: Viewer in Tenant A
  let userC: User;
  let cookieC: string;

  // Helper to create user and session
  async function createUserAndSession(name: string, email: string) {
    const passwordHash = await hashPassword("password123");
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await prisma.session.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const cookie = `${SESSION_COOKIE_NAME}=${rawToken}`;
    return { user, cookie };
  }

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Setup Tenant A
    const resA = await createUserAndSession("Alice Owner", `alice_${Date.now()}@alpha.test`);
    userA = resA.user;
    cookieA = resA.cookie;

    workspaceA = await prisma.workspace.create({
      data: {
        name: "Alpha Corp",
        slug: `alpha-corp-${Date.now()}`,
        industry: "Technology",
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceA.id,
        userId: userA.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    // 2. Setup Tenant B
    const resB = await createUserAndSession("Bob Owner", `bob_${Date.now()}@beta.test`);
    userB = resB.user;
    cookieB = resB.cookie;

    workspaceB = await prisma.workspace.create({
      data: {
        name: "Beta LLC",
        slug: `beta-llc-${Date.now()}`,
        industry: "Finance",
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceB.id,
        userId: userB.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    // 3. Setup User C (Viewer in Tenant A)
    const resC = await createUserAndSession("Charlie Viewer", `charlie_${Date.now()}@alpha.test`);
    userC = resC.user;
    cookieC = resC.cookie;

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceA.id,
        userId: userC.id,
        role: "VIEWER",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.workspaceMembership.deleteMany({
      where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [workspaceA.id, workspaceB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("Tenant Isolation: User A cannot access Workspace B resources", async () => {
    // User A attempts to view Workspace B details
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceB.id}`,
      headers: { cookie: cookieA },
    });

    // Must be 403 Forbidden
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("Tenant Isolation: User B cannot access Workspace A member list", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceA.id}/members`,
      headers: { cookie: cookieB },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("RBAC Restrictions: VIEWER cannot invite new members", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceA.id}/invitations`,
      headers: { cookie: cookieC },
      payload: {
        email: "intruder@test.com",
        role: "RECEPTION_STAFF",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("RBAC Restrictions: VIEWER cannot update workspace settings", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceA.id}`,
      headers: { cookie: cookieC },
      payload: {
        name: "Hacked Alpha Corp",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("Owner Safeguards: Cannot remove or demote the last remaining active OWNER", async () => {
    // Find Alice's membership ID
    const membershipA = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceA.id,
          userId: userA.id,
        },
      },
    });

    // Attempt to demote Alice to VIEWER
    const demoteRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceA.id}/members/${membershipA!.id}`,
      headers: { cookie: cookieA },
      payload: { role: "VIEWER" },
    });

    expect(demoteRes.statusCode).toBe(400);
    const body = JSON.parse(demoteRes.body);
    expect(body.error.code).toBe("CANNOT_DEMOTE_LAST_OWNER");
  });

  it("Disabled Membership: User whose membership is DISABLED cannot access workspace", async () => {
    // Disable Charlie's membership
    const membershipC = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceA.id,
          userId: userC.id,
        },
      },
    });

    await prisma.workspaceMembership.update({
      where: { id: membershipC!.id },
      data: { status: "DISABLED" },
    });

    // Charlie tries to access Workspace A
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceA.id}`,
      headers: { cookie: cookieC },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("MEMBERSHIP_INACTIVE");
  });

  it("Audit Trail: Workspace updates record immutable audit events", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceA.id}`,
      headers: { cookie: cookieA },
      payload: {
        industry: "Advanced Robotics",
      },
    });

    expect(res.statusCode).toBe(200);

    // Verify audit log
    const auditRes = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceA.id}/audit-logs`,
      headers: { cookie: cookieA },
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = JSON.parse(auditRes.body);
    const updateLog = auditBody.data.logs.find(
      (l: { action: string }) => l.action === "workspace.updated"
    );
    expect(updateLog).toBeDefined();
    expect(updateLog.resourceType).toBe("workspace");
    expect(updateLog.actor.email).toBe(userA.email);
  });
});
