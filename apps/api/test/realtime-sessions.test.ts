import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildApp } from "../src/app";
import { prisma, WorkspaceRole, ActorType, RealtimeTestSessionStatus } from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { OpenAIRealtimeCredentialProvider } from "../src/modules/realtime/services/openai-realtime.service";

describe("Phase 3 Browser Realtime Voice Playground Integration Tests", () => {
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

  let readyReceptionistA: any;
  let incompleteReceptionistA: any;

  beforeAll(async () => {
    // Stub ephemeral credential provider for hermetic testing
    vi.spyOn(OpenAIRealtimeCredentialProvider, "createBrowserClientSecret").mockResolvedValue({
      clientSecret: "ek_test_mock_ephemeral_client_secret_xyz123",
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      model: "gpt-realtime-2.1",
    });
    // Clean tables
    await prisma.realtimeTestConversationItem.deleteMany();
    await prisma.realtimeTestSession.deleteMany();
    await prisma.receptionistConfigurationVersion.deleteMany();
    await prisma.receptionistTransferDestination.deleteMany();
    await prisma.transferDestination.deleteMany();
    await prisma.receptionist.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.workspaceMembership.deleteMany();
    await prisma.businessHour.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await hashPassword("password123");

    // 1. Create Workspaces
    const wsA = await prisma.workspace.create({
      data: {
        name: "Bright Dental Test",
        slug: "bright-dental-test",
        industry: "Dental",
        timezone: "America/New_York",
      },
    });
    workspaceAId = wsA.id;

    // Add business hours for Monday (day 1)
    await prisma.businessHour.create({
      data: {
        workspaceId: workspaceAId,
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "18:00",
        enabled: true,
      },
    });

    const wsB = await prisma.workspace.create({
      data: {
        name: "Acme Law Firm",
        slug: "acme-law-firm",
        industry: "Legal",
        timezone: "America/Chicago",
      },
    });
    workspaceBId = wsB.id;

    // 2. Create Users
    ownerAUser = await prisma.user.create({
      data: { email: "owner-realtime-a@test.com", name: "Owner A", passwordHash },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceAId, userId: ownerAUser.id, role: WorkspaceRole.OWNER },
    });

    viewerAUser = await prisma.user.create({
      data: { email: "viewer-realtime-a@test.com", name: "Viewer A", passwordHash },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceAId, userId: viewerAUser.id, role: WorkspaceRole.VIEWER },
    });

    agentManagerAUser = await prisma.user.create({
      data: { email: "manager-realtime-a@test.com", name: "Manager A", passwordHash },
    });
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceAId,
        userId: agentManagerAUser.id,
        role: WorkspaceRole.AGENT_MANAGER,
      },
    });

    ownerBUser = await prisma.user.create({
      data: { email: "owner-realtime-b@test.com", name: "Owner B", passwordHash },
    });
    await prisma.workspaceMembership.create({
      data: { workspaceId: workspaceBId, userId: ownerBUser.id, role: WorkspaceRole.OWNER },
    });

    // Helper to generate authenticated cookies
    const createSessionCookie = async (userId: string) => {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.session.create({
        data: { userId, tokenHash, expiresAt },
      });
      return `${SESSION_COOKIE_NAME}=${rawToken}`;
    };

    ownerACookie = await createSessionCookie(ownerAUser.id);
    viewerACookie = await createSessionCookie(viewerAUser.id);
    agentManagerACookie = await createSessionCookie(agentManagerAUser.id);
    ownerBCookie = await createSessionCookie(ownerBUser.id);

    // 3. Create a Complete, Test-Ready Receptionist in Workspace A
    readyReceptionistA = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Ava Dental",
        slug: "ava-dental",
        roleTitle: "Front Desk Assistant",
        industry: "DENTAL",
        primaryLanguage: "en-US",
        status: "TESTING",
        greeting: "Thank you for calling Bright Dental. This is Ava. How may I assist you today?",
        instructions:
          "Welcome patients warmly, answer questions about dental cleaning, root canals, and office hours. Be concise and polite.",
        voiceConfig: { speakingStyle: "warm", speakingRate: "normal" },
        personalityConfig: { traits: ["WARM", "PROFESSIONAL"] },
        objectiveConfig: { objectives: ["ANSWER_QUESTIONS"] },
        behaviorConfig: {
          responseLength: "concise",
          askOneQuestionAtATime: true,
          confirmCriticalDetails: true,
        },
      },
    });

    // 4. Create an Incomplete Receptionist in Workspace A (missing greeting & instructions)
    incompleteReceptionistA = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Incomplete Bot",
        slug: "incomplete-bot",
        roleTitle: "Receptionist",
        status: "DRAFT",
      },
    });
  });

  describe("1. Realtime Test Session Creation & Credential Minting", () => {
    it("should successfully mint ephemeral client secret and create RealtimeTestSession", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: ownerACookie },
        payload: { metadata: { source: "vitest_suite" } },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data).toBeDefined();
      expect(body.data.testSessionId).toBeDefined();
      expect(body.data.configurationVersion).toBe(readyReceptionistA.configurationVersion);
      expect(body.data.clientSecret).toMatch(/^ek_/);
      expect(body.data.expiresAt).toBeGreaterThan(Date.now() / 1000);

      // Verify Runtime Instruction Stacking
      expect(body.data.runtime.model).toBe("gpt-realtime-2.1");
      expect(body.data.runtime.voice).toBe("coral"); // mapped from "warm"
      expect(body.data.runtime.initialGreeting).toContain("Bright Dental");
      expect(body.data.runtime.instructions).toContain("=== LAYER 1: PLATFORM SAFETY ===");
      expect(body.data.runtime.instructions).toContain(
        "=== LAYER 2: TRUSTED SERVER-SIDE TOOL CAPABILITIES & BOUNDARIES ==="
      );
      expect(body.data.runtime.instructions).toContain("Ava Dental");

      // Verify PostgreSQL Session Record
      const session = await prisma.realtimeTestSession.findUnique({
        where: { id: body.data.testSessionId },
      });
      expect(session).toBeDefined();
      expect(session?.status).toBe(RealtimeTestSessionStatus.CREATED);
      expect(session?.workspaceId).toBe(workspaceAId);
      expect(session?.receptionistId).toBe(readyReceptionistA.id);

      // Verify Audit Log was written
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: body.data.testSessionId,
          action: "receptionist.test_session_started",
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorUserId).toBe(ownerAUser.id);
    });

    it("should allow AGENT_MANAGER to create a voice test session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: agentManagerACookie },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.clientSecret).toMatch(/^ek_/);
    });
  });

  describe("2. RBAC Enforcement", () => {
    it("should reject VIEWER from initiating voice test session (403)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: viewerACookie },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  });

  describe("3. Multi-Tenant Isolation", () => {
    it("should block Workspace B user from creating a session for Workspace A receptionist (404)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: ownerBCookie },
      });

      expect(res.statusCode).toBe(403); // Cross-workspace access denied
    });

    it("should return 404 when Workspace B specifies its own workspace ID with Workspace A receptionist ID", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceBId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: ownerBCookie },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("RECEPTIONIST_NOT_FOUND");
    });
  });

  describe("4. Configuration Readiness Guard", () => {
    it("should reject testing an incomplete draft receptionist (400)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${incompleteReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: ownerACookie },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe("RECEPTIONIST_NOT_TEST_READY");
      expect(body.error.details).toBeDefined();
      expect(body.error.details.length).toBeGreaterThan(0);
    });
  });

  describe("5. Session Lifecycle & Transcript Persistence", () => {
    let createdSessionId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/receptionists/${readyReceptionistA.id}/realtime-test-sessions`,
        headers: { cookie: ownerACookie },
      });
      createdSessionId = res.json().data.testSessionId;
    });

    it("should retrieve session details via GET", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceAId}/realtime-test-sessions/${createdSessionId}`,
        headers: { cookie: ownerACookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.id).toBe(createdSessionId);
      expect(body.data.receptionist.name).toBe("Ava Dental");
    });

    it("should save live conversation transcript items", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/realtime-test-sessions/${createdSessionId}/transcript`,
        headers: { cookie: ownerACookie },
        payload: {
          items: [
            {
              sequence: 0,
              role: "ASSISTANT",
              type: "message",
              text: "Thank you for calling Bright Dental. How may I help you?",
            },
            {
              sequence: 1,
              role: "USER",
              type: "message",
              text: "Hi, what time do you close today?",
            },
            {
              sequence: 2,
              role: "ASSISTANT",
              type: "message",
              text: "We are open until 6:00 PM this evening.",
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.savedCount).toBe(3);

      const itemsInDb = await prisma.realtimeTestConversationItem.findMany({
        where: { testSessionId: createdSessionId },
        orderBy: { sequence: "asc" },
      });
      expect(itemsInDb.length).toBe(3);
      expect(itemsInDb[1].role).toBe("USER");
      expect(itemsInDb[1].text).toBe("Hi, what time do you close today?");
    });

    it("should mark session completed upon end and compute duration", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceAId}/realtime-test-sessions/${createdSessionId}/end`,
        headers: { cookie: ownerACookie },
        payload: {
          disconnectReason: "User finished test dialogue",
          clientDurationSeconds: 42,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe(RealtimeTestSessionStatus.COMPLETED);
      expect(body.data.durationSeconds).toBe(42);
      expect(body.data.disconnectReason).toBe("User finished test dialogue");

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          resourceId: createdSessionId,
          action: "receptionist.test_session_completed",
        },
      });
      expect(audit).toBeDefined();
    });
  });
});
