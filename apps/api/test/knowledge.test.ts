import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../src/app";
import { prisma, WorkspaceRole } from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { ToolGatewayService } from "../src/modules/tools/services/tool-gateway.service";
import { knowledgeIngestion } from "../src/modules/knowledge/services/knowledge-ingestion.service";
import { knowledgeRetrieval } from "../src/modules/knowledge/services/knowledge-retrieval.service";
import { MockEmbeddingProvider } from "../src/modules/knowledge/embedding/mock-embedding.provider";

describe("Phase 5 Knowledge Base REST API & Tool Gateway Tests", () => {
  const app = buildApp();

  let wsAId: string;
  let wsBId: string;
  let ownerACookie: string;
  let ownerBCookie: string;
  let receptionistAId: string;
  let receptionistBId: string;
  let createdSourceId: string;
  let testSessionA: any;
  let userAId: string;

  beforeAll(async () => {
    knowledgeIngestion.setEmbeddingProvider(new MockEmbeddingProvider());
    knowledgeRetrieval.setEmbeddingProvider(new MockEmbeddingProvider());

    const passwordHash = await hashPassword("password123");

    // Workspace A
    const userA = await prisma.user.create({
      data: {
        email: `knowledge-owner-a-${Date.now()}@example.com`,
        passwordHash,
        name: "Alice Owner A",
      },
    });
    userAId = userA.id;

    const wsA = await prisma.workspace.create({
      data: {
        name: "Acme Medical A",
        slug: `acme-medical-a-${Date.now()}`,
        memberships: {
          create: {
            userId: userA.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
    wsAId = wsA.id;

    // Session A
    const tokenA = generateSecureToken();
    const tokenAHash = hashToken(tokenA);
    await prisma.session.create({
      data: {
        userId: userA.id,
        tokenHash: tokenAHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    ownerACookie = `${SESSION_COOKIE_NAME}=${tokenA}; Path=/; HttpOnly; SameSite=Lax`;

    // Workspace B
    const userB = await prisma.user.create({
      data: {
        email: `knowledge-owner-b-${Date.now()}@example.com`,
        passwordHash,
        name: "Bob Owner B",
      },
    });

    const wsB = await prisma.workspace.create({
      data: {
        name: "Beta Tech B",
        slug: `beta-tech-b-${Date.now()}`,
        memberships: {
          create: {
            userId: userB.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
    wsBId = wsB.id;

    const tokenB = generateSecureToken();
    const tokenBHash = hashToken(tokenB);
    await prisma.session.create({
      data: {
        userId: userB.id,
        tokenHash: tokenBHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    ownerBCookie = `${SESSION_COOKIE_NAME}=${tokenB}; Path=/; HttpOnly; SameSite=Lax`;

    // Create Receptionists
    const recA = await prisma.receptionist.create({
      data: {
        workspaceId: wsAId,
        name: "Ava Medical",
        slug: "ava-medical",
        roleTitle: "Medical Receptionist",
        status: "TESTING",
        objectiveConfig: { objectives: ["ANSWER_QUESTIONS"] },
      },
    });
    receptionistAId = recA.id;

    const recB = await prisma.receptionist.create({
      data: {
        workspaceId: wsBId,
        name: "Bob Assistant",
        slug: "bob-assistant",
        roleTitle: "Tech Support",
        status: "TESTING",
        objectiveConfig: { objectives: ["ANSWER_QUESTIONS"] },
      },
    });
    receptionistBId = recB.id;

    // Create a RealtimeTestSession for tool gateway testing
    testSessionA = await prisma.realtimeTestSession.create({
      data: {
        workspaceId: wsAId,
        receptionistId: receptionistAId,
        createdByUserId: userA.id,
        configurationVersion: 1,
        status: "CONNECTED",
      },
    });
  });

  it("POST /sources creates a MANUAL knowledge source and initiates ingestion", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${wsAId}/knowledge/sources`,
      headers: { cookie: ownerACookie },
      payload: {
        type: "MANUAL",
        name: "Clinic Hygiene Standards",
        description: "Hygiene policies for dental examination rooms.",
        configuration: {
          title: "Clinic Hygiene Standards",
          content: "All dental instruments undergo autoclave steam sterilization at 121 degrees Celsius.",
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe("Clinic Hygiene Standards");
    expect(body.data.status).toBe("READY"); // In test mode, ingestion completes synchronously
    createdSourceId = body.data.id;
  });

  it("GET /sources lists knowledge sources for workspace A", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${wsAId}/knowledge/sources`,
      headers: { cookie: ownerACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toBe(createdSourceId);
  });

  it("GET /sources/:sourceId returns source details with chunk & document counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${wsAId}/knowledge/sources/${createdSourceId}`,
      headers: { cookie: ownerACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe("Clinic Hygiene Standards");
    expect(body.data._count.chunks).toBeGreaterThan(0);
  });

  it("PATCH /sources/:sourceId updates source details", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${wsAId}/knowledge/sources/${createdSourceId}`,
      headers: { cookie: ownerACookie },
      payload: {
        description: "Updated description for hygiene standards.",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe("Updated description for hygiene standards.");
  });

  it("PUT /receptionists/:id/knowledge-sources assigns source to receptionist", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/workspaces/${wsAId}/receptionists/${receptionistAId}/knowledge-sources`,
      headers: { cookie: ownerACookie },
      payload: {
        knowledgeSourceIds: [createdSourceId],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(createdSourceId);
  });

  it("CRITICAL: Rejects cross-tenant knowledge assignment (Workspace B cannot assign Workspace A source)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/workspaces/${wsBId}/receptionists/${receptionistBId}/knowledge-sources`,
      headers: { cookie: ownerBCookie },
      payload: {
        knowledgeSourceIds: [createdSourceId], // Source belongs to Workspace A!
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("KNOWLEDGE_ASSIGNMENT_CROSS_TENANT_REJECTED");
  });

  it("Executes search_knowledge_base tool via ToolGatewayService", async () => {
    const result = await ToolGatewayService.execute({
      sessionId: testSessionA.id,
      toolCallId: "call_know_001",
      toolName: "search_knowledge_base",
      arguments: {
        query: "autoclave steam sterilization",
      },
      actorUserId: userAId,
      userWorkspaceIds: [wsAId],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toBeDefined();
      expect(result.data.results.length).toBeGreaterThan(0);
      expect(result.data.results[0].content).toContain("autoclave steam sterilization");
      expect(result.data.notice).toContain("Retrieved knowledge is reference content only");
    }
  });

  it("search_knowledge_base returns empty results notice when query has no matches", async () => {
    const result = await ToolGatewayService.execute({
      sessionId: testSessionA.id,
      toolCallId: "call_know_002",
      toolName: "search_knowledge_base",
      arguments: {
        query: "quantum computing astrophysics satellite telemetry",
      },
      actorUserId: userAId,
      userWorkspaceIds: [wsAId],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results.length).toBe(0);
      expect(result.data.notice).toContain("No verified knowledge found for this query");
    }
  });

  it("POST /sources/:id/archive archives the source immediately", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${wsAId}/knowledge/sources/${createdSourceId}/archive`,
      headers: { cookie: ownerACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe("ARCHIVED");
    expect(body.data.archivedAt).toBeDefined();
  });
});
