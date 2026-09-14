import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  queryMessagesRestSchema,
  updateMessageStatusRestSchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // GET /api/v1/workspaces/:workspaceId/messages
  app.get("/api/v1/workspaces/:workspaceId/messages", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "messages.read");
    if (!membership) return;

    const query = queryMessagesRestSchema.parse(req.query);
    const where: any = { workspaceId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.urgency) {
      where.urgency = query.urgency;
    }
    if (query.callbackRequested !== undefined) {
      where.callbackRequested = query.callbackRequested;
    }
    if (query.receptionistId) {
      where.receptionistId = query.receptionistId;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.receptionistMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              company: true,
            },
          },
          receptionist: {
            select: {
              id: true,
              name: true,
            },
          },
          recipientUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.receptionistMessage.count({ where }),
    ]);

    return reply.send({
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /api/v1/workspaces/:workspaceId/messages/:messageId
  app.get("/api/v1/workspaces/:workspaceId/messages/:messageId", async (req, reply) => {
    const { workspaceId, messageId } = req.params as {
      workspaceId: string;
      messageId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "messages.read");
    if (!membership) return;

    const message = await prisma.receptionistMessage.findFirst({
      where: { id: messageId, workspaceId },
      include: {
        contact: true,
        receptionist: true,
        testSession: {
          select: {
            id: true,
            startedAt: true,
            durationSeconds: true,
          },
        },
        recipientUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!message) {
      return reply.status(404).send({
        error: { code: "MESSAGE_NOT_FOUND", message: "Message not found" },
      });
    }

    return reply.send({ data: message });
  });

  // PATCH /api/v1/workspaces/:workspaceId/messages/:messageId/status
  app.patch(
    "/api/v1/workspaces/:workspaceId/messages/:messageId/status",
    async (req, reply) => {
      const { workspaceId, messageId } = req.params as {
        workspaceId: string;
        messageId: string;
      };
      const membership = await requireWorkspaceAccess(req, reply, workspaceId, "messages.update");
      if (!membership) return;

      const body = updateMessageStatusRestSchema.parse(req.body);
      const existing = await prisma.receptionistMessage.findFirst({
        where: { id: messageId, workspaceId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: "MESSAGE_NOT_FOUND", message: "Message not found" },
        });
      }

      const updated = await prisma.receptionistMessage.update({
        where: { id: messageId },
        data: { status: body.status },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorType: "USER",
          actorUserId: req.user!.id,
          action: "message.status_updated",
          resourceType: "message",
          resourceId: messageId,
          metadata: { oldStatus: existing.status, newStatus: body.status },
        },
      });

      return reply.send({ data: updated });
    }
  );
}
