import { FastifyInstance } from "fastify";
import { prisma, ActorType, RealtimeTestSessionStatus } from "@receptionai/db";
import {
  createRealtimeTestSessionSchema,
  endRealtimeTestSessionSchema,
  saveRealtimeTranscriptSchema,
} from "@receptionai/validation";
import { REALTIME_RATE_LIMIT_MAX_PER_MINUTE } from "@receptionai/config";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { redis } from "../../lib/redis";
import { ReceptionistPolicyService } from "../receptionists/services/receptionist-policy.service";
import { OpenAIRealtimeCredentialProvider } from "./services/openai-realtime.service";
import { RealtimeInstructionService } from "./services/realtime-instruction.service";
import { getAllowedToolsForObjectives } from "../tools/tool-registry";

export async function realtimeSessionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. Create Realtime Test Session & Mint Ephemeral Client Secret
  app.post<{
    Params: { workspaceId: string; receptionistId: string };
  }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/realtime-test-sessions",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.test"
      );
      if (!membership) return;

      const { workspaceId, receptionistId } = req.params;
      const body = createRealtimeTestSessionSchema.parse(req.body || {});

      // Rate limit session minting: 6 per minute per user/workspace
      const rateLimitKey = `ratelimit:realtime:${workspaceId}:${req.user!.id}`;
      const requestCount = await redis.incr(rateLimitKey);
      if (requestCount === 1) {
        await redis.expire(rateLimitKey, 60);
      }
      if (requestCount > REALTIME_RATE_LIMIT_MAX_PER_MINUTE) {
        return reply.status(429).send({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message:
              "Too many voice test sessions were initiated recently. Please wait a minute before starting another session.",
            requestId: req.id,
          },
        });
      }

      // Lookup receptionist scoped to workspace
      const receptionist = await prisma.receptionist.findFirst({
        where: { id: receptionistId, workspaceId },
        include: {
          transferDestinations: { include: { transferDestination: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found in this workspace.",
            requestId: req.id,
          },
        });
      }

      if (receptionist.status === "ARCHIVED") {
        return reply.status(400).send({
          error: {
            code: "RECEPTIONIST_ARCHIVED",
            message: "Archived receptionists cannot be tested in the voice playground.",
            requestId: req.id,
          },
        });
      }

      // Check test readiness
      const readiness = ReceptionistPolicyService.evaluateReadiness(
        receptionist,
        receptionist.transferDestinations
      );
      if (!readiness.canEnterTesting) {
        return reply.status(400).send({
          error: {
            code: "RECEPTIONIST_NOT_TEST_READY",
            message:
              "The receptionist configuration has incomplete required fields. Please resolve all blocking issues before testing.",
            details: readiness.blockingIssues.map((i) => ({ field: i.field, message: i.message })),
            requestId: req.id,
          },
        });
      }

      // Load workspace with business hours
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { businessHours: true },
      });

      if (!workspace) {
        return reply.status(404).send({
          error: {
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace not found.",
            requestId: req.id,
          },
        });
      }

      // Assemble 7-layer platform instruction prompt
      const assembled = RealtimeInstructionService.buildInstructions(receptionist, workspace);

      // Mint ephemeral client secret (ek_...) from OpenAI Realtime API
      let credentials;
      try {
        credentials = await OpenAIRealtimeCredentialProvider.createBrowserClientSecret();
      } catch (err: any) {
        if (err.message === "OPENAI_API_KEY_MISSING") {
          return reply.status(503).send({
            error: {
              code: "REALTIME_NOT_CONFIGURED",
              message:
                "OpenAI Realtime API is not configured on this server. Please provide OPENAI_API_KEY.",
              requestId: req.id,
            },
          });
        }
        return reply.status(502).send({
          error: {
            code: "REALTIME_CREDENTIAL_FAILED",
            message: "Unable to generate OpenAI Realtime connection secret. Please try again.",
            requestId: req.id,
          },
        });
      }

      // Compute allowed tools based on receptionist objectives
      const objectiveConfig =
        (receptionist.objectiveConfig as { objectives?: string[] }) || {};
      const objectives = objectiveConfig.objectives || ["ANSWER_QUESTIONS"];
      const allowedToolDefs = getAllowedToolsForObjectives(objectives);
      const allowedTools = allowedToolDefs.map((t) => ({
        name: t.name,
        description: t.description,
      }));

      // Persist RealtimeTestSession record in PostgreSQL
      const testSession = await prisma.realtimeTestSession.create({
        data: {
          workspaceId,
          receptionistId,
          configurationVersion: receptionist.configurationVersion,
          createdByUserId: req.user!.id,
          status: RealtimeTestSessionStatus.CREATED,
          provider: "openai",
          model: credentials.model,
          metadata: {
            ...(body.metadata || {}),
            voice: assembled.voice,
            businessStatus: assembled.businessStatus,
            greetingLength: assembled.selectedGreeting.length,
            enabledTools: allowedTools.map((t) => t.name),
          },
        },
      });

      // Audit trail (never stores the secret)
      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action: "receptionist.test_session_started",
          resourceType: "realtime_test_session",
          resourceId: testSession.id,
          metadata: {
            receptionistId,
            receptionistName: receptionist.name,
            configurationVersion: receptionist.configurationVersion,
            model: credentials.model,
            enabledToolsCount: allowedTools.length,
          },
        },
      });

      // Return connection payload with ephemeral secret
      return reply.status(201).send({
        data: {
          testSessionId: testSession.id,
          receptionist: {
            id: receptionist.id,
            name: receptionist.name,
            roleTitle: receptionist.roleTitle,
          },
          configurationVersion: receptionist.configurationVersion,
          runtime: {
            model: credentials.model,
            voice: assembled.voice,
            initialGreeting: assembled.selectedGreeting,
            instructions: assembled.instructions,
            businessStatus: assembled.businessStatus,
            timezone: assembled.timezone,
            allowedTools,
          },
          clientSecret: credentials.clientSecret,
          expiresAt: credentials.expiresAt,
        },
      });
    }
  );

  // 2. Get Realtime Test Session Details & History
  app.get<{
    Params: { workspaceId: string; sessionId: string };
  }>("/api/v1/workspaces/:workspaceId/realtime-test-sessions/:sessionId", async (req, reply) => {
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      req.params.workspaceId,
      "receptionists.read"
    );
    if (!membership) return;

    const session = await prisma.realtimeTestSession.findFirst({
      where: {
        id: req.params.sessionId,
        workspaceId: req.params.workspaceId,
      },
      include: {
        receptionist: {
          select: { id: true, name: true, roleTitle: true, slug: true },
        },
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        conversationItems: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!session) {
      return reply.status(404).send({
        error: {
          code: "TEST_SESSION_NOT_FOUND",
          message: "Realtime test session not found in this workspace.",
          requestId: req.id,
        },
      });
    }

    return reply.send({ data: session });
  });

  // 3. End Realtime Test Session
  app.post<{
    Params: { workspaceId: string; sessionId: string };
  }>(
    "/api/v1/workspaces/:workspaceId/realtime-test-sessions/:sessionId/end",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.test"
      );
      if (!membership) return;

      const session = await prisma.realtimeTestSession.findFirst({
        where: {
          id: req.params.sessionId,
          workspaceId: req.params.workspaceId,
        },
      });

      if (!session) {
        return reply.status(404).send({
          error: {
            code: "TEST_SESSION_NOT_FOUND",
            message: "Realtime test session not found.",
            requestId: req.id,
          },
        });
      }

      const validated = endRealtimeTestSessionSchema.parse(req.body || {});
      const endedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
      );

      const finalStatus = validated.errorCode
        ? RealtimeTestSessionStatus.FAILED
        : RealtimeTestSessionStatus.COMPLETED;

      const updated = await prisma.realtimeTestSession.update({
        where: { id: session.id },
        data: {
          status: finalStatus,
          endedAt,
          durationSeconds: validated.clientDurationSeconds ?? durationSeconds,
          disconnectReason: validated.disconnectReason || "User ended session",
          errorCode: validated.errorCode || null,
          metadata: validated.metadata
            ? { ...(session.metadata as any), ...validated.metadata }
            : undefined,
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: req.params.workspaceId,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action:
            finalStatus === RealtimeTestSessionStatus.COMPLETED
              ? "receptionist.test_session_completed"
              : "receptionist.test_session_failed",
          resourceType: "realtime_test_session",
          resourceId: session.id,
          metadata: {
            receptionistId: session.receptionistId,
            configurationVersion: session.configurationVersion,
            durationSeconds: updated.durationSeconds,
            disconnectReason: updated.disconnectReason,
          },
        },
      });

      return reply.send({ data: updated });
    }
  );

  // 4. Save Final Realtime Transcript
  app.post<{
    Params: { workspaceId: string; sessionId: string };
  }>(
    "/api/v1/workspaces/:workspaceId/realtime-test-sessions/:sessionId/transcript",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.test"
      );
      if (!membership) return;

      const session = await prisma.realtimeTestSession.findFirst({
        where: {
          id: req.params.sessionId,
          workspaceId: req.params.workspaceId,
        },
      });

      if (!session) {
        return reply.status(404).send({
          error: {
            code: "TEST_SESSION_NOT_FOUND",
            message: "Realtime test session not found.",
            requestId: req.id,
          },
        });
      }

      const validated = saveRealtimeTranscriptSchema.parse(req.body);

      if (validated.items.length > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.realtimeTestConversationItem.deleteMany({
            where: { testSessionId: session.id },
          });

          await tx.realtimeTestConversationItem.createMany({
            data: validated.items.map((item) => ({
              workspaceId: req.params.workspaceId,
              testSessionId: session.id,
              providerItemId: item.providerItemId || null,
              sequence: item.sequence,
              role: item.role,
              type: item.type || "message",
              text: item.text,
              startedAt: item.startedAt ? new Date(item.startedAt) : null,
              completedAt: item.completedAt ? new Date(item.completedAt) : null,
              metadata: (item.metadata as any) || undefined,
            })),
          });
        });
      }

      return reply.send({
        data: { savedCount: validated.items.length },
        message: "Transcript items saved successfully.",
      });
    }
  );
}
