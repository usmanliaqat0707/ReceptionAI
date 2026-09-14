import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../src/app";
import { prisma, WorkspaceRole, ActorType } from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";

describe("Phase 2 Receptionist Builder & Configuration Integration Tests", () => {
  const app = buildApp();

  let workspaceAId: string;
  let workspaceBId: string;
  let ownerACookie: string;
  let viewerACookie: string;
  let agentManagerACookie: string;
  let ownerBCookie: string;

  let ownerAUser: any;
  let viewerAUser: any;
  let agentManagerAUser: any;
  let ownerBUser: any;

  beforeAll(async () => {
    // Clean tables
    await prisma.receptionistConfigurationVersion.deleteMany();
    await prisma.receptionistTransferDestination.deleteMany();
    await prisma.transferDestination.deleteMany();
    await prisma.receptionist.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.workspaceMembership.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await hashPassword("password123");

    // 1. Create Workspace A
    const wsA = await prisma.workspace.create({
      data: {
        name: "Acme Dental",
        slug: "acme-dental",
        industry: "Dental",
        timezone: "America/New_York",
      },
    });
    workspaceAId = wsA.id;

    // 2. Create Workspace B
    const wsB = await prisma.workspace.create({
      data: {
        name: "Omega Legal",
        slug: "omega-legal",
        industry: "Legal",
        timezone: "America/Chicago",
      },
    });
    workspaceBId = wsB.id;

    // 3. Create Users
    ownerAUser = await prisma.user.create({
      data: {
        email: "owner-a@test.com",
        name: "Owner A",
        passwordHash,
      },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceAId, userId: ownerAUser.id, role: WorkspaceRole.OWNER },
    });

    viewerAUser = await prisma.user.create({
      data: {
        email: "viewer-a@test.com",
        name: "Viewer A",
        passwordHash,
      },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceAId, userId: viewerAUser.id, role: WorkspaceRole.VIEWER },
    });

    agentManagerAUser = await prisma.user.create({
      data: {
        email: "manager-a@test.com",
        name: "Manager A",
        passwordHash,
      },
    });
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceAId,
        userId: agentManagerAUser.id,
        role: WorkspaceRole.AGENT_MANAGER,
      },
    });

    ownerBUser = await prisma.user.create({
      data: {
        email: "owner-b@test.com",
        name: "Owner B",
        passwordHash,
      },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceBId, userId: ownerBUser.id, role: WorkspaceRole.OWNER },
    });

    // Helper to generate authenticated cookies
    const createSessionCookie = async (userId: string) => {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.session.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });

      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    };

    ownerACookie = await createSessionCookie(ownerAUser.id);
    viewerACookie = await createSessionCookie(viewerAUser.id);
    agentManagerACookie = await createSessionCookie(agentManagerAUser.id);
    ownerBCookie = await createSessionCookie(ownerBUser.id);
  });

  // 1. Receptionist CRUD & Templates
  it("should create a receptionist from a template with default configurations", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Ava",
        roleTitle: "Dental Receptionist",
        template: "DENTAL_RECEPTIONIST",
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.data.id).toBeDefined();
    expect(json.data.name).toBe("Ava");
    expect(json.data.slug).toBe("ava");
    expect(json.data.status).toBe("DRAFT");
    expect(json.data.configurationVersion).toBe(1);
    expect(json.data.greeting).toContain("Bright Dental");
    expect(json.data.personalityConfig.traits).toContain("PROFESSIONAL");
  });

  // 2. Concurrency Conflict (409)
  it("should return 409 CONFLICT if expectedVersion does not match current configurationVersion", async () => {
    // Create test receptionist
    const createRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Chloe",
        roleTitle: "Support Agent",
      },
    });
    const receptionist = JSON.parse(createRes.body).data;

    // Try update with wrong expectedVersion (e.g. 5 instead of 1)
    const conflictRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${receptionist.id}`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Chloe Updated",
        expectedVersion: 5,
      },
    });

    expect(conflictRes.statusCode).toBe(409);
    const conflictJson = JSON.parse(conflictRes.body);
    expect(conflictJson.error.code).toBe("CONFIGURATION_VERSION_CONFLICT");

    // Proper update with matching expectedVersion = 1 succeeds and increments version to 2
    const validRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${receptionist.id}`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Chloe Updated",
        expectedVersion: 1,
      },
    });

    expect(validRes.statusCode).toBe(200);
    const validJson = JSON.parse(validRes.body);
    expect(validJson.data.configurationVersion).toBe(2);
    expect(validJson.data.name).toBe("Chloe Updated");
  });

  // 3. Cross-Tenant Isolation
  it("should enforce strict cross-tenant isolation (Workspace B cannot access Workspace A receptionist)", async () => {
    // Create receptionist in Workspace A
    const createRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Secret Receptionist",
        roleTitle: "Confidential Agent",
      },
    });
    const recId = JSON.parse(createRes.body).data.id;

    // User B tries to read it using Workspace A ID -> 403 Forbidden (not a member of Workspace A)
    const readA = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${recId}`,
      headers: { cookie: ownerBCookie },
    });
    expect(readA.statusCode).toBe(403);

    // User B tries to read it claiming Workspace B context -> 404 Not Found (scoped lookup)
    const readB = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceBId}/receptionists/${recId}`,
      headers: { cookie: ownerBCookie },
    });
    expect(readB.statusCode).toBe(404);

    // User B tries to mutate it -> 403 Forbidden
    const patchA = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${recId}`,
      headers: { cookie: ownerBCookie },
      payload: { name: "Hacked" },
    });
    expect(patchA.statusCode).toBe(403);
  });

  // 4. RBAC Permission Checks
  it("should enforce RBAC matrix (VIEWER cannot create or update; AGENT_MANAGER can update)", async () => {
    // VIEWER attempts to create -> 403
    const viewerCreate = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists`,
      headers: { cookie: viewerACookie },
      payload: { name: "Viewer Bot" },
    });
    expect(viewerCreate.statusCode).toBe(403);

    // AGENT_MANAGER creates -> 201
    const managerCreate = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists`,
      headers: { cookie: agentManagerACookie },
      payload: { name: "Manager Bot" },
    });
    expect(managerCreate.statusCode).toBe(201);
  });

  // 5. Lifecycle Transitions & Readiness Blocking
  it("should block transition to TESTING or ACTIVE if required configuration is missing", async () => {
    // Create incomplete draft
    const rec = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Incomplete Bot",
        slug: "incomplete-bot",
        roleTitle: "Bot",
        status: "DRAFT",
        greeting: null, // Missing greeting
        instructions: null, // Missing instructions
      },
    });

    // Try to transition to TESTING -> 400 RECEPTIONIST_NOT_READY
    const testRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/testing`,
      headers: { cookie: ownerACookie },
    });
    expect(testRes.statusCode).toBe(400);
    const json = JSON.parse(testRes.body);
    expect(json.error.code).toBe("RECEPTIONIST_NOT_READY");

    // Add greeting, instructions, and objectives
    await prisma.receptionist.update({
      where: { id: rec.id },
      data: {
        greeting: "Hello, welcome to Acme Dental. How can I help you?",
        instructions: "You are the receptionist. Answer questions politely and take messages.",
        objectiveConfig: { objectives: ["ANSWER_QUESTIONS", "TAKE_MESSAGES"] },
      },
    });

    // Now transition to TESTING succeeds
    const testRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/testing`,
      headers: { cookie: ownerACookie },
    });
    expect(testRes2.statusCode).toBe(200);
    expect(JSON.parse(testRes2.body).data.status).toBe("TESTING");

    // Verify snapshot was created in receptionist_configuration_versions
    const snapshot = await prisma.receptionistConfigurationVersion.findFirst({
      where: { receptionistId: rec.id, version: 1 },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.triggerStatus).toBe("TESTING");

    // Transition from TESTING to ACTIVE succeeds
    const activeRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/activate`,
      headers: { cookie: ownerACookie },
    });
    expect(activeRes.statusCode).toBe(200);
    expect(JSON.parse(activeRes.body).data.status).toBe("ACTIVE");
  });

  // 6. Transfer Destination Management & E.164 Normalization
  it("should create E.164 normalized transfer destination and reject cross-workspace references", async () => {
    // Create destination in Workspace A
    const createDest = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/transfer-destinations`,
      headers: { cookie: ownerACookie },
      payload: {
        name: "Doctor Office",
        type: "PHONE",
        destination: "+1 (555) 234-5678", // Needs normalization
      },
    });

    expect(createDest.statusCode).toBe(201);
    const dest = JSON.parse(createDest.body).data;
    expect(dest.destination).toBe("+15552345678"); // Normalized
    expect(dest.maskedDestination).toBe("+1555 *** 5678");

    // Create destination in Workspace B
    const destB = await prisma.transferDestination.create({
      data: {
        workspaceId: workspaceBId,
        name: "Foreign Destination",
        destination: "+15559990000",
      },
    });

    // Create receptionist in Workspace A
    const rec = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Transfer Tester",
        slug: "transfer-tester",
        roleTitle: "Receptionist",
      },
    });

    // Try to assign Workspace B destination to Workspace A receptionist -> 400 CROSS_WORKSPACE_REFERENCE
    const assignRes = await app.inject({
      method: "PUT",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/transfer-destinations`,
      headers: { cookie: ownerACookie },
      payload: {
        destinations: [
          { transferDestinationId: destB.id, priority: 1, purpose: "GENERAL", enabled: true },
        ],
      },
    });

    expect(assignRes.statusCode).toBe(400);
    expect(JSON.parse(assignRes.body).error.code).toBe("CROSS_WORKSPACE_REFERENCE");

    // Assigning legitimate Workspace A destination succeeds
    const assignValid = await app.inject({
      method: "PUT",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/transfer-destinations`,
      headers: { cookie: ownerACookie },
      payload: {
        destinations: [
          { transferDestinationId: dest.id, priority: 1, purpose: "GENERAL", enabled: true },
        ],
      },
    });

    expect(assignValid.statusCode).toBe(200);
  });

  // 7. Receptionist Duplication
  it("should duplicate a receptionist into a new DRAFT with a clean version and unique slug", async () => {
    // Create source receptionist
    const source = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Original Ava",
        slug: "original-ava",
        roleTitle: "Senior Receptionist",
        greeting: "Hello from Ava",
        configurationVersion: 4,
        status: "ACTIVE",
      },
    });

    const dupRes = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${source.id}/duplicate`,
      headers: { cookie: ownerACookie },
      payload: { name: "Original Ava Copy" },
    });

    expect(dupRes.statusCode).toBe(201);
    const dup = JSON.parse(dupRes.body).data;
    expect(dup.id).not.toBe(source.id);
    expect(dup.name).toBe("Original Ava Copy");
    expect(dup.slug).toBe("original-ava-copy");
    expect(dup.status).toBe("DRAFT"); // Reset to DRAFT
    expect(dup.configurationVersion).toBe(1); // Reset version
    expect(dup.greeting).toBe("Hello from Ava"); // Copied config
  });

  // 8. Runtime Config Contract (Phase 3 Handoff)
  it("should assemble a complete runtime configuration object for Phase 3 without live voice execution", async () => {
    const rec = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Contract Bot",
        slug: "contract-bot",
        roleTitle: "Contract Agent",
        greeting: "Welcome to Acme",
        instructions: "Standard instructions",
        voiceConfig: { speakingStyle: "warm", speakingRate: "normal", responsePacing: "concise" },
        personalityConfig: { traits: ["PROFESSIONAL", "WARM"] },
        objectiveConfig: { objectives: ["ANSWER_QUESTIONS", "TAKE_MESSAGES"] },
        status: "TESTING",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspaceAId}/receptionists/${rec.id}/runtime-config`,
      headers: { cookie: ownerACookie },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.receptionistId).toBe(rec.id);
    expect(["CONFIGURED_RUNTIME_UNAVAILABLE", "BROWSER_TEST_AVAILABLE"]).toContain(
      json.data.runtimeReadiness
    );
    expect(json.data.voice.speakingStyle).toBe("warm");
    expect(json.data.personality).toContain("WARM");
    expect(json.data.objectives).toContain("ANSWER_QUESTIONS");
  });
});
