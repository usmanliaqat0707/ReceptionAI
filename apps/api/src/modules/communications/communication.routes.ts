import { FastifyInstance } from "fastify";
import { prisma, CommunicationChannel } from "@receptionai/db";
import {
  updateCommunicationSettingsSchema,
  createTemplateSchema,
  sendTestCommunicationSchema,
  queryCommunicationsSchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { CommunicationDeliveryService } from "./services/communication-delivery.service";
import { DEFAULT_COMMUNICATION_TEMPLATES } from "./services/default-templates";

function maskAddress(address: string, channel: CommunicationChannel): string {
  if (channel === "SMS") {
    if (address.length <= 4) return "****";
    return address.slice(0, 3) + "***" + address.slice(-2);
  } else {
    const parts = address.split("@");
    if (parts.length !== 2) return "*****";
    const name = parts[0];
    const maskedName = name.length <= 2 ? name[0] + "*" : name[0] + "***" + name.slice(-1);
    return `${maskedName}@${parts[1]}`;
  }
}

export async function communicationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. GET /api/v1/workspaces/:workspaceId/communications
  app.get("/api/v1/workspaces/:workspaceId/communications", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "communications.read");
    if (!membership) return;

    const query = queryCommunicationsSchema.parse(req.query);
    const where: any = { workspaceId };

    if (query.channel) where.channel = query.channel;
    if (query.purpose) where.purpose = query.purpose;
    if (query.status) where.status = query.status;
    if (query.contactId) where.recipientContactId = query.contactId;

    if (query.search) {
      where.OR = [
        { recipientAddress: { contains: query.search, mode: "insensitive" } },
        { body: { contains: query.search, mode: "insensitive" } },
        { subject: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.outboundCommunication.count({ where }),
      prisma.outboundCommunication.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { createdAt: "desc" },
        include: {
          recipientContact: {
            select: { id: true, firstName: true, lastName: true },
          },
          deliveryAttempts: {
            take: 1,
            orderBy: { attempt: "desc" },
            select: { attempt: true, status: true, errorCode: true },
          },
        },
      }),
    ]);

    const canViewFull =
      membership.role === "OWNER" || membership.role === "ADMIN";

    const sanitized = items.map((item) => ({
      ...item,
      recipientAddress: canViewFull
        ? item.recipientAddress
        : maskAddress(item.recipientAddress, item.channel),
    }));

    return reply.send({
      success: true,
      total,
      items: sanitized,
    });
  });

  // 2. GET /api/v1/workspaces/:workspaceId/communications/settings
  app.get("/api/v1/workspaces/:workspaceId/communications/settings", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "communications.read");
    if (!membership) return;

    let settings = await prisma.workspaceCommunicationSettings.findUnique({
      where: { workspaceId },
    });

    if (!settings) {
      settings = await prisma.workspaceCommunicationSettings.create({
        data: { workspaceId },
      });
    }

    return reply.send({ success: true, settings });
  });

  // 3. PUT /api/v1/workspaces/:workspaceId/communications/settings
  app.put("/api/v1/workspaces/:workspaceId/communications/settings", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      workspaceId,
      "communications.manage_settings"
    );
    if (!membership) return;

    const input = updateCommunicationSettingsSchema.parse(req.body);

    const settings = await prisma.workspaceCommunicationSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ...input,
      },
      update: input,
    });

    return reply.send({ success: true, settings });
  });

  // 4. GET /api/v1/workspaces/:workspaceId/communications/templates
  app.get("/api/v1/workspaces/:workspaceId/communications/templates", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "communications.read");
    if (!membership) return;

    const customTemplates = await prisma.communicationTemplate.findMany({
      where: { workspaceId },
      orderBy: { key: "asc" },
    });

    const templates = DEFAULT_COMMUNICATION_TEMPLATES.map((def) => {
      const custom = customTemplates.find(
        (c) => c.key === def.key && c.channel === def.channel
      );
      if (custom) {
        return {
          ...custom,
          isCustom: true,
        };
      }
      return {
        id: `default_${def.key}`,
        key: def.key,
        channel: def.channel,
        name: def.name,
        purpose: def.purpose,
        subjectTemplate: def.subjectTemplate || null,
        bodyTemplate: def.bodyTemplate,
        version: 1,
        status: "ACTIVE",
        variables: def.variables,
        isCustom: false,
      };
    });

    return reply.send({ success: true, templates });
  });

  // 5. POST /api/v1/workspaces/:workspaceId/communications/templates
  app.post("/api/v1/workspaces/:workspaceId/communications/templates", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      workspaceId,
      "communications.manage_templates"
    );
    if (!membership) return;

    const input = createTemplateSchema.parse(req.body);

    const template = await prisma.communicationTemplate.upsert({
      where: {
        workspaceId_key_channel: {
          workspaceId,
          key: input.key,
          channel: input.channel,
        },
      },
      create: {
        workspaceId,
        ...input,
      },
      update: {
        name: input.name,
        purpose: input.purpose,
        subjectTemplate: input.subjectTemplate,
        bodyTemplate: input.bodyTemplate,
        variables: input.variables,
        version: { increment: 1 },
      },
    });

    return reply.status(201).send({ success: true, template });
  });

  // 6. POST /api/v1/workspaces/:workspaceId/communications/send-test
  app.post("/api/v1/workspaces/:workspaceId/communications/send-test", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      workspaceId,
      "communications.send_test"
    );
    if (!membership) return;

    const input = sendTestCommunicationSchema.parse(req.body);

    const comm = await prisma.outboundCommunication.create({
      data: {
        workspaceId,
        channel: input.channel,
        purpose: "CUSTOM_TRANSACTIONAL",
        recipientAddress: input.recipient,
        subject: input.channel === "EMAIL" ? "ReceptionAI Test Notification" : null,
        body:
          input.message ||
          `This is a test notification from ReceptionAI sent at ${new Date().toLocaleTimeString()}.`,
        status: "PENDING",
        sourceType: "MANUAL_TEST",
      },
    });

    const delivered = await CommunicationDeliveryService.deliver(comm.id);

    return reply.send({ success: true, communication: delivered });
  });

  // 7. GET /api/v1/workspaces/:workspaceId/communications/suppressions
  app.get("/api/v1/workspaces/:workspaceId/communications/suppressions", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "communications.read");
    if (!membership) return;

    const suppressions = await prisma.communicationSuppression.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, suppressions });
  });

  // 8. DELETE /api/v1/workspaces/:workspaceId/communications/suppressions/:id
  app.delete("/api/v1/workspaces/:workspaceId/communications/suppressions/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      workspaceId,
      "communications.manage_settings"
    );
    if (!membership) return;

    await prisma.communicationSuppression.deleteMany({
      where: { id, workspaceId },
    });

    return reply.send({ success: true, message: "Suppression removed successfully." });
  });

  // 9. GET /api/v1/workspaces/:workspaceId/communications/:id
  app.get("/api/v1/workspaces/:workspaceId/communications/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "communications.read");
    if (!membership) return;

    const comm = await prisma.outboundCommunication.findFirst({
      where: { id, workspaceId },
      include: {
        recipientContact: true,
        deliveryAttempts: { orderBy: { attempt: "asc" } },
        providerEvents: { orderBy: { receivedAt: "asc" } },
      },
    });

    if (!comm) {
      return reply.status(404).send({
        error: { code: "COMMUNICATION_NOT_FOUND", message: "Communication not found." },
      });
    }

    const canViewFull =
      membership.role === "OWNER" || membership.role === "ADMIN";

    const response = {
      ...comm,
      recipientAddress: canViewFull
        ? comm.recipientAddress
        : maskAddress(comm.recipientAddress, comm.channel),
    };

    return reply.send({ success: true, communication: response });
  });

  // 10. POST /api/v1/workspaces/:workspaceId/communications/:id/retry
  app.post("/api/v1/workspaces/:workspaceId/communications/:id/retry", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      workspaceId,
      "communications.retry"
    );
    if (!membership) return;

    try {
      const updated = await CommunicationDeliveryService.manualRetry(workspaceId, id);
      return reply.send({ success: true, communication: updated });
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: "RETRY_FAILED", message: err.message || "Failed to retry communication." },
      });
    }
  });
}
