import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildApp } from "../src/app";
import { prisma, WorkspaceRole, RealtimeTestSessionStatus } from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { toolRegistry } from "../src/modules/tools/tool-registry";
import { ToolGatewayService } from "../src/modules/tools/services/tool-gateway.service";

describe("Phase 4 Trusted Server-Side Tool Execution Tests", () => {
  const app = buildApp();

  let workspaceAId: string;
  let workspaceBId: string;
  let ownerACookie: string;
  let ownerBCookie: string;
  let ownerAUser: any;
  let ownerBUser: any;

  let sessionA: any;
  let receptionistA: any;
  let receptionistRestrictedA: any;
  let sessionRestrictedA: any;

  beforeAll(async () => {
    // Clean tables
    await prisma.conversationConfirmation.deleteMany();
    await prisma.receptionistToolExecution.deleteMany();
    await prisma.receptionistMessage.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.businessProfile.deleteMany();
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

    // 1. Create Workspace A & B
    const wsA = await prisma.workspace.create({
      data: {
        name: "Acme Dental A",
        slug: "acme-dental-a",
        timezone: "America/New_York",
        industry: "Dental",
      },
    });
    workspaceAId = wsA.id;

    const wsB = await prisma.workspace.create({
      data: {
        name: "Apex Legal B",
        slug: "apex-legal-b",
        timezone: "America/Chicago",
        industry: "Legal",
      },
    });
    workspaceBId = wsB.id;

    // Create Business Profile for Workspace A
    await prisma.businessProfile.create({
      data: {
        workspaceId: workspaceAId,
        businessName: "Acme Dental Care",
        phone: "+12125550100",
        email: "info@acmedental.test",
        website: "https://acmedental.test",
        addressLine1: "100 Broadway",
        city: "New York",
        region: "NY",
        postalCode: "10005",
        country: "US",
        timezone: "America/New_York",
      },
    });

    // Create Business Hours for Workspace A (Mon-Fri 9-5)
    for (let day = 1; day <= 5; day++) {
      await prisma.businessHour.create({
        data: {
          workspaceId: workspaceAId,
          dayOfWeek: day,
          openTime: "09:00",
          closeTime: "17:00",
          enabled: true,
        },
      });
    }

    // 2. Create Users
    ownerAUser = await prisma.user.create({
      data: {
        email: "owner-a@example.com",
        name: "Owner A",
        passwordHash,
      },
    });

    ownerBUser = await prisma.user.create({
      data: {
        email: "owner-b@example.com",
        name: "Owner B",
        passwordHash,
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceAId,
        userId: ownerAUser.id,
        role: WorkspaceRole.OWNER,
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceBId,
        userId: ownerBUser.id,
        role: WorkspaceRole.OWNER,
      },
    });

    // Create Sessions & Cookies
    const tokenA = generateSecureToken();
    await prisma.session.create({
      data: {
        userId: ownerAUser.id,
        tokenHash: hashToken(tokenA),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    ownerACookie = `${SESSION_COOKIE_NAME}=${tokenA}`;

    const tokenB = generateSecureToken();
    await prisma.session.create({
      data: {
        userId: ownerBUser.id,
        tokenHash: hashToken(tokenB),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    ownerBCookie = `${SESSION_COOKIE_NAME}=${tokenB}`;

    // 3. Create Full-Capability Receptionist
    receptionistA = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "Ava",
        slug: "ava",
        roleTitle: "Receptionist",
        greeting: "Hello, thank you for calling Acme Dental!",
        status: "ACTIVE",
        objectiveConfig: {
          objectives: [
            "ANSWER_QUESTIONS",
            "COLLECT_CUSTOMER_INFORMATION",
            "CAPTURE_LEADS",
            "TAKE_MESSAGES",
            "HANDLE_AFTER_HOURS",
          ],
        },
      },
    });

    sessionA = await prisma.realtimeTestSession.create({
      data: {
        workspaceId: workspaceAId,
        receptionistId: receptionistA.id,
        createdByUserId: ownerAUser.id,
        status: RealtimeTestSessionStatus.CONNECTED,
        configurationVersion: 1,
      },
    });

    // 4. Create Restricted Receptionist (only ANSWER_QUESTIONS)
    receptionistRestrictedA = await prisma.receptionist.create({
      data: {
        workspaceId: workspaceAId,
        name: "InfoBot",
        slug: "infobot",
        roleTitle: "Info Assistant",
        greeting: "Hello!",
        status: "ACTIVE",
        objectiveConfig: {
          objectives: ["ANSWER_QUESTIONS"],
        },
      },
    });

    sessionRestrictedA = await prisma.realtimeTestSession.create({
      data: {
        workspaceId: workspaceAId,
        receptionistId: receptionistRestrictedA.id,
        createdByUserId: ownerAUser.id,
        status: RealtimeTestSessionStatus.CONNECTED,
        configurationVersion: 1,
      },
    });
  });

  describe("1. Tool Registry Verification", () => {
    it("should have all 9 required business tools registered with valid schemas", () => {
      const requiredTools = [
        "get_business_information",
        "get_business_hours",
        "find_contact",
        "create_contact",
        "update_contact",
        "create_lead",
        "update_lead",
        "take_message",
        "request_callback",
      ];

      for (const name of requiredTools) {
        const tool = toolRegistry.get(name);
        expect(tool, `Tool ${name} should be in registry`).toBeDefined();
        expect(tool!.description.length).toBeGreaterThan(10);
        expect(tool!.inputSchema).toBeDefined();
        expect(typeof tool!.execute).toBe("function");
      }
    });
  });

  describe("2. ToolGatewayService Business Tools Execution", () => {
    let createdContactId: string;
    let createdLeadId: string;

    it("should execute get_business_information successfully", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_info_1",
        toolName: "get_business_information",
        arguments: {},
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.businessName).toBe("Acme Dental Care");
        expect(res.data.phone).toBe("+12125550100");
        expect(res.data.address?.city).toBe("New York");
      }
    });

    it("should execute get_business_hours successfully", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_hours_1",
        toolName: "get_business_hours",
        arguments: {},
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.timezone).toBe("America/New_York");
        expect(["OPEN", "CLOSED"]).toContain(res.data.status);
      }
    });

    it("should execute create_contact and normalize phone and email", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_contact_create_1",
        toolName: "create_contact",
        arguments: {
          firstName: "Robert",
          lastName: "Chen",
          phone: "(212) 555-0155",
          email: "Robert.Chen@example.com ",
          company: "Chen Logistics",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.contactId).toBeDefined();
        expect(res.data.isExisting).toBe(false);
        createdContactId = res.data.contactId;

        // Verify normalized phone in database
        const saved = await prisma.contact.findUnique({
          where: { id: createdContactId },
        });
        expect(saved?.normalizedPhone).toBe("+12125550155");
        expect(saved?.normalizedEmail).toBe("robert.chen@example.com");
        expect(saved?.source).toBe("VOICE_RECEPTIONIST");
      }
    });

    it("should deduplicate contact creation when caller phone already exists", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_contact_create_2",
        toolName: "create_contact",
        arguments: {
          firstName: "Bob",
          phone: "+12125550155",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.contactId).toBe(createdContactId);
        expect(res.data.isExisting).toBe(true);
      }
    });

    it("should execute find_contact by phone number", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_contact_find_1",
        toolName: "find_contact",
        arguments: {
          phone: "+1 212 555 0155",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.found).toBe(true);
        expect(res.data.contact.firstName).toBe("Robert");
      }
    });

    it("should execute create_lead for an existing contact", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_lead_create_1",
        toolName: "create_lead",
        arguments: {
          contactId: createdContactId,
          intent: "Full Dental Implant Consultation",
          qualification: "Needs two lower molars replaced, looking for sedation options",
          notes: "Caller requested estimate over email",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.leadId).toBeDefined();
        expect(res.data.status).toBe("NEW");
        createdLeadId = res.data.leadId;
      }
    });

    it("should execute update_lead with new notes", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_lead_update_1",
        toolName: "update_lead",
        arguments: {
          leadId: createdLeadId,
          notes: "Updated: Caller confirmed preferred day is Tuesday",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.leadId).toBe(createdLeadId);
      }
    });

    it("should execute take_message with urgency NORMAL", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_msg_1",
        toolName: "take_message",
        arguments: {
          contactId: createdContactId,
          subject: "Insurance verification question",
          message: "Caller needs to confirm if Aetna DMO is accepted before booking.",
          urgency: "NORMAL",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.messageId).toBeDefined();
        expect(res.data.status).toBe("NEW");
      }
    });

    it("should execute request_callback with requested window", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_callback_1",
        toolName: "request_callback",
        arguments: {
          contactId: createdContactId,
          subject: "Follow-up Callback Request",
          message: "Please call back regarding treatment costs.",
          requestedCallbackWindow: "AFTERNOON",
          urgency: "HIGH",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.messageId).toBeDefined();
        expect(res.data.callbackRequested).toBe(true);
        expect(res.data.requestedCallbackWindow).toBe("AFTERNOON");
      }
    });
  });

  describe("3. Idempotency & Replay Protection", () => {
    it("should return identical cached response on duplicate toolCallId without re-executing", async () => {
      const toolCallId = "call_idempotent_test_1";
      const initialLeadCount = await prisma.lead.count();

      // First call
      const res1 = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId,
        toolName: "take_message",
        arguments: {
          contactId: (await prisma.contact.findFirst({ where: { workspaceId: workspaceAId } }))!.id,
          subject: "Test idempotency message",
          message: "Unique payload",
          urgency: "LOW",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res1.success).toBe(true);
      const msgCountAfterFirst = await prisma.receptionistMessage.count();

      // Second call with same sessionId and toolCallId
      const res2 = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId,
        toolName: "take_message",
        arguments: {
          contactId: (await prisma.contact.findFirst({ where: { workspaceId: workspaceAId } }))!.id,
          subject: "Test idempotency message",
          message: "Unique payload",
          urgency: "LOW",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res2.success).toBe(true);
      if (res1.success && res2.success) {
        expect(res2.data.messageId).toBe(res1.data.messageId);
      }

      // Verify no second message was created
      const msgCountAfterSecond = await prisma.receptionistMessage.count();
      expect(msgCountAfterSecond).toBe(msgCountAfterFirst);
    });
  });

  describe("4. AI Tool Policy & Capability Enforcement", () => {
    it("should reject tool execution if receptionist lacks the capability", async () => {
      // InfoBot has only ANSWER_QUESTIONS; calling create_lead should be blocked
      const contact = await prisma.contact.findFirst({ where: { workspaceId: workspaceAId } });
      const res = await ToolGatewayService.execute({
        sessionId: sessionRestrictedA.id,
        toolCallId: "call_restricted_1",
        toolName: "create_lead",
        arguments: {
          contactId: contact!.id,
          intent: "Unauthorized Lead Attempt",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("TOOL_NOT_ENABLED");
      }
    });

    it("should reject update_contact modifying phone without confirmation", async () => {
      const contact = await prisma.contact.findFirst({ where: { workspaceId: workspaceAId } });
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_unconfirmed_update_1",
        toolName: "update_contact",
        arguments: {
          contactId: contact!.id,
          phone: "+19999999999",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("CONFIRMATION_REQUIRED");
      }
    });

    it("should reject invalid tool parameters that fail schema validation", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_invalid_schema_1",
        toolName: "create_lead",
        arguments: {
          // Missing required contactId and intent
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("TOOL_INPUT_INVALID");
      }
    });
  });

  describe("5. Cross-Tenant Isolation Enforcement", () => {
    it("should reject executing tools with a session from another workspace", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_tenant_breach_1",
        toolName: "get_business_information",
        arguments: {},
        actorUserId: ownerBUser.id,
        userWorkspaceIds: [workspaceBId], // User B belongs only to Workspace B
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("TOOL_NOT_ALLOWED");
      }
    });

    it("should prevent creating a lead referencing a contact in another workspace", async () => {
      // Create contact in Workspace B
      const contactB = await prisma.contact.create({
        data: {
          workspaceId: workspaceBId,
          firstName: "Private",
          lastName: "Client",
          phone: "+13125550199",
        },
      });

      // Attempt to reference contact B in Workspace A session
      const res = await ToolGatewayService.execute({
        sessionId: sessionA.id,
        toolCallId: "call_cross_contact_1",
        toolName: "create_lead",
        arguments: {
          contactId: contactB.id,
          intent: "Unauthorized Cross-Tenant Lead",
        },
        actorUserId: ownerAUser.id,
        userWorkspaceIds: [workspaceAId],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("CONTACT_NOT_FOUND");
      }
    });
  });

  describe("6. REST Endpoints Verification", () => {
    it("POST /tools/execute should execute tool over HTTP gateway", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/realtime-test-sessions/${sessionA.id}/tools/execute`,
        headers: {
          cookie: ownerACookie,
        },
        payload: {
          toolCallId: "http_call_1",
          toolName: "get_business_information",
          arguments: {},
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.businessName).toBe("Acme Dental Care");
    });

    it("GET /tool-executions should return session execution history", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/realtime-test-sessions/${sessionA.id}/tool-executions`,
        headers: {
          cookie: ownerACookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].toolName).toBeDefined();
    });

    it("GET /workspaces/:id/contacts should list contacts", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceAId}/contacts`,
        headers: {
          cookie: ownerACookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.pagination).toBeDefined();
    });

    it("GET /workspaces/:id/leads should list leads", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceAId}/leads`,
        headers: {
          cookie: ownerACookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it("GET /workspaces/:id/messages should list messages", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceAId}/messages`,
        headers: {
          cookie: ownerACookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it("GET /workspaces/:id/business-profile should return profile", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceAId}/business-profile`,
        headers: {
          cookie: ownerACookie,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.businessName).toBe("Acme Dental Care");
    });
  });
});
