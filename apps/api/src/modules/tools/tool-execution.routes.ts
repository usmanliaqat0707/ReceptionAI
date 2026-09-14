import { FastifyInstance } from "fastify";
import { executeToolSchema } from "@receptionai/validation";
import { ToolGatewayService } from "./services/tool-gateway.service";
import { prisma } from "@receptionai/db";

import { authenticateSession } from "../../middleware/auth";

export async function toolExecutionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // POST /api/v1/realtime-test-sessions/:sessionId/tools/execute
  app.post("/api/v1/realtime-test-sessions/:sessionId/tools/execute", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const parsed = executeToolSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid tool execution payload",
          details: parsed.error.errors,
        },
      });
    }

    const userId = req.user!.id;
    // Get user's active workspaces
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const result = await ToolGatewayService.execute({
      sessionId,
      toolCallId: parsed.data.toolCallId,
      toolName: parsed.data.toolName,
      arguments: parsed.data.arguments,
      actorUserId: userId,
      userWorkspaceIds: workspaceIds,
      requestId: req.id,
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/realtime-test-sessions/:sessionId/tool-executions
  app.get("/api/v1/realtime-test-sessions/:sessionId/tool-executions", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const userId = req.user!.id;

    const session = await prisma.realtimeTestSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({
        error: { code: "SESSION_NOT_FOUND", message: "Voice test session not found" },
      });
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.workspaceId,
          userId,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "Access denied to session records" },
      });
    }

    const executions = await prisma.receptionistToolExecution.findMany({
      where: { testSessionId: sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        toolCallId: true,
        toolName: true,
        status: true,
        inputJson: true,
        outputJson: true,
        errorCode: true,
        errorMessageSafe: true,
        durationMs: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return reply.status(200).send({ data: executions });
  });

  // GET /api/v1/realtime-test-sessions/:sessionId/tool-executions/:executionId
  app.get(
    "/api/v1/realtime-test-sessions/:sessionId/tool-executions/:executionId",
    async (req, reply) => {
      const { sessionId, executionId } = req.params as {
        sessionId: string;
        executionId: string;
      };
      const userId = req.user!.id;

      const session = await prisma.realtimeTestSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({
          error: { code: "SESSION_NOT_FOUND", message: "Voice test session not found" },
        });
      }

      const membership = await prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: session.workspaceId,
            userId,
          },
        },
      });

      if (!membership || membership.status !== "ACTIVE") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "Access denied to session records" },
        });
      }

      const execution = await prisma.receptionistToolExecution.findFirst({
        where: { id: executionId, testSessionId: sessionId },
      });

      if (!execution) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Tool execution not found" },
        });
      }

      return reply.status(200).send({ data: execution });
    }
  );
}
