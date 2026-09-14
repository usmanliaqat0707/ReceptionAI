import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  createServiceSchema,
  updateServiceSchema,
  updateAppointmentPolicySchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function serviceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. GET /api/v1/workspaces/:workspaceId/services
  app.get("/api/v1/workspaces/:workspaceId/services", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.read");
    if (!membership) return;

    const services = await prisma.service.findMany({
      where: { workspaceId, archivedAt: null },
      include: {
        calendarIntegration: {
          select: { id: true, name: true, provider: true, status: true },
        },
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return reply.send({ data: services });
  });

  // 2. POST /api/v1/workspaces/:workspaceId/services
  app.post("/api/v1/workspaces/:workspaceId/services", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.create");
    if (!membership) return;

    const body = createServiceSchema.parse(req.body);

    const service = await prisma.service.create({
      data: {
        workspaceId,
        name: body.name,
        description: body.description,
        durationMinutes: body.durationMinutes,
        bufferBeforeMinutes: body.bufferBeforeMinutes,
        bufferAfterMinutes: body.bufferAfterMinutes,
        priceText: body.priceText,
        active: body.active,
        calendarIntegrationId: body.calendarIntegrationId,
      },
      include: { calendarIntegration: true },
    });

    return reply.status(201).send({ data: service });
  });

  // 3. GET /api/v1/workspaces/:workspaceId/services/:id
  app.get("/api/v1/workspaces/:workspaceId/services/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.read");
    if (!membership) return;

    const service = await prisma.service.findFirst({
      where: { id, workspaceId, archivedAt: null },
      include: { calendarIntegration: true },
    });

    if (!service) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Service not found." },
      });
    }

    return reply.send({ data: service });
  });

  // 4. PATCH /api/v1/workspaces/:workspaceId/services/:id
  app.patch("/api/v1/workspaces/:workspaceId/services/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.update");
    if (!membership) return;

    const body = updateServiceSchema.parse(req.body);

    const existing = await prisma.service.findFirst({
      where: { id, workspaceId, archivedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Service not found." },
      });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        durationMinutes: body.durationMinutes,
        bufferBeforeMinutes: body.bufferBeforeMinutes,
        bufferAfterMinutes: body.bufferAfterMinutes,
        priceText: body.priceText,
        active: body.active,
        calendarIntegrationId: body.calendarIntegrationId,
      },
      include: { calendarIntegration: true },
    });

    return reply.send({ data: updated });
  });

  // 5. DELETE /api/v1/workspaces/:workspaceId/services/:id (soft archive)
  app.delete("/api/v1/workspaces/:workspaceId/services/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.archive");
    if (!membership) return;

    const existing = await prisma.service.findFirst({
      where: { id, workspaceId, archivedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Service not found." },
      });
    }

    await prisma.service.update({
      where: { id },
      data: { archivedAt: new Date(), active: false },
    });

    return reply.send({ success: true });
  });

  // 6. GET /api/v1/workspaces/:workspaceId/appointment-policy
  app.get("/api/v1/workspaces/:workspaceId/appointment-policy", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.read");
    if (!membership) return;

    let policy = await prisma.appointmentPolicy.findUnique({
      where: { workspaceId },
    });

    if (!policy) {
      policy = await prisma.appointmentPolicy.create({
        data: { workspaceId },
      });
    }

    return reply.send({ data: policy });
  });

  // 7. PUT /api/v1/workspaces/:workspaceId/appointment-policy
  app.put("/api/v1/workspaces/:workspaceId/appointment-policy", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "services.update");
    if (!membership) return;

    const body = updateAppointmentPolicySchema.parse(req.body);

    const policy = await prisma.appointmentPolicy.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        minimumLeadTimeMinutes: body.minimumLeadTimeMinutes ?? 60,
        maximumAdvanceDays: body.maximumAdvanceDays ?? 90,
        cancellationCutoffMinutes: body.cancellationCutoffMinutes ?? 1440,
        rescheduleCutoffMinutes: body.rescheduleCutoffMinutes ?? 1440,
        allowSameDay: body.allowSameDay ?? true,
      },
      update: {
        minimumLeadTimeMinutes: body.minimumLeadTimeMinutes,
        maximumAdvanceDays: body.maximumAdvanceDays,
        cancellationCutoffMinutes: body.cancellationCutoffMinutes,
        rescheduleCutoffMinutes: body.rescheduleCutoffMinutes,
        allowSameDay: body.allowSameDay,
      },
    });

    return reply.send({ data: policy });
  });
}
