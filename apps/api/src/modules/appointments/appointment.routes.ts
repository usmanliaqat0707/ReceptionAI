import { FastifyInstance } from "fastify";
import { prisma, ActorType } from "@receptionai/db";
import {
  createAppointmentRestSchema,
  rescheduleAppointmentRestSchema,
  cancelAppointmentRestSchema,
  queryAppointmentsRestSchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { availabilityService } from "./services/availability.service";
import {
  appointmentDomainService,
  AppointmentDomainService,
} from "./services/appointment-domain.service";
import { slotTokenService } from "./services/slot-token.service";

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. GET /api/v1/workspaces/:workspaceId/appointments
  app.get("/api/v1/workspaces/:workspaceId/appointments", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.read");
    if (!membership) return;

    const query = queryAppointmentsRestSchema.parse(req.query);
    const where: any = { workspaceId };

    if (query.status) where.status = query.status;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.contactId) where.contactId = query.contactId;
    if (query.receptionistId) where.receptionistId = query.receptionistId;
    if (query.startDate) where.startAt = { gte: new Date(query.startDate) };
    if (query.endDate) {
      where.startAt = { ...(where.startAt || {}), lte: new Date(query.endDate) };
    }

    const skip = (query.page - 1) * query.limit;
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { startAt: "desc" },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          service: {
            select: { id: true, name: true, durationMinutes: true, priceText: true },
          },
          calendarIntegration: {
            select: { id: true, name: true, provider: true },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return reply.send({
      data: appointments,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  });

  // 2. POST /api/v1/workspaces/:workspaceId/appointments (Manual booking by staff/user)
  app.post("/api/v1/workspaces/:workspaceId/appointments", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.create");
    if (!membership) return;

    const body = createAppointmentRestSchema.parse(req.body);

    // Resolve service
    const service = await prisma.service.findFirst({
      where: { id: body.serviceId, workspaceId, active: true, archivedAt: null },
    });
    if (!service) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Service not found or inactive." },
      });
    }

    // Resolve integration
    const integrationId =
      body.calendarIntegrationId || service.calendarIntegrationId;
    let integration = integrationId
      ? await prisma.calendarIntegration.findFirst({
          where: { id: integrationId, workspaceId, status: "CONNECTED" },
        })
      : await prisma.calendarIntegration.findFirst({
          where: { workspaceId, status: "CONNECTED" },
        });

    if (!integration) {
      return reply.status(400).send({
        error: {
          code: "CALENDAR_UNAVAILABLE",
          message: "No connected calendar integration found for booking.",
        },
      });
    }

    const startAt = new Date(body.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);

    // Generate signed slot token for internal validation
    const slotId = slotTokenService.generateSlotToken({
      workspaceId,
      serviceId: service.id,
      calendarIntegrationId: integration.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    // Auto-create and auto-confirm confirmation for direct staff/user booking
    const computedHash = AppointmentDomainService.computePayloadHash({
      contactId: body.contactId,
      serviceId: service.id,
      slotId,
    });

    const conf = await prisma.conversationConfirmation.create({
      data: {
        workspaceId,
        testSessionId: "manual_dashboard_session",
        action: "appointment.book",
        target: slotId,
        payloadHash: computedHash,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const result = await appointmentDomainService.bookAppointment({
      workspaceId,
      contactId: body.contactId,
      serviceId: service.id,
      slotId,
      confirmationId: conf.id,
      actorUserId: (req as any).user?.id,
      actorType: ActorType.USER,
      notes: body.notes,
      receptionistId: body.receptionistId,
    });

    return reply.status(201).send({ data: result.appointment });
  });

  // 3. GET /api/v1/workspaces/:workspaceId/appointments/:id
  app.get("/api/v1/workspaces/:workspaceId/appointments/:id", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.read");
    if (!membership) return;

    try {
      const appt = await appointmentDomainService.getAppointment(workspaceId, id);
      return reply.send({ data: appt });
    } catch (err: any) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: err.message || "Appointment not found." },
      });
    }
  });

  // 4. PATCH /api/v1/workspaces/:workspaceId/appointments/:id/reschedule
  app.patch(
    "/api/v1/workspaces/:workspaceId/appointments/:id/reschedule",
    async (req, reply) => {
      const { workspaceId, id } = req.params as { workspaceId: string; id: string };
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        workspaceId,
        "appointments.update"
      );
      if (!membership) return;

      const body = rescheduleAppointmentRestSchema.parse(req.body);
      const appt = await prisma.appointment.findFirst({
        where: { id, workspaceId },
        include: { service: true },
      });

      if (!appt) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "Appointment not found." },
        });
      }

      const newStartAt = new Date(body.startAt);
      const durationMs = (appt.service?.durationMinutes || 30) * 60 * 1000;
      const newEndAt = new Date(newStartAt.getTime() + durationMs);

      const slotId = slotTokenService.generateSlotToken({
        workspaceId,
        serviceId: appt.serviceId,
        calendarIntegrationId: appt.calendarIntegrationId,
        startAt: newStartAt.toISOString(),
        endAt: newEndAt.toISOString(),
      });

      const computedHash = AppointmentDomainService.computePayloadHash({
        appointmentId: id,
        slotId,
      });

      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: "manual_dashboard_session",
          action: "appointment.reschedule",
          target: id,
          payloadHash: computedHash,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const result = await appointmentDomainService.rescheduleAppointment({
        workspaceId,
        appointmentId: id,
        slotId,
        confirmationId: conf.id,
        actorUserId: (req as any).user?.id,
        actorType: ActorType.USER,
        reason: body.reason,
      });

      return reply.send({ data: result.appointment });
    }
  );

  // 5. POST /api/v1/workspaces/:workspaceId/appointments/:id/cancel
  app.post("/api/v1/workspaces/:workspaceId/appointments/:id/cancel", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.cancel");
    if (!membership) return;

    const body = cancelAppointmentRestSchema.parse(req.body || {});

    const computedHash = AppointmentDomainService.computePayloadHash({
      appointmentId: id,
    });

    const conf = await prisma.conversationConfirmation.create({
      data: {
        workspaceId,
        testSessionId: "manual_dashboard_session",
        action: "appointment.cancel",
        target: id,
        payloadHash: computedHash,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const result = await appointmentDomainService.cancelAppointment({
      workspaceId,
      appointmentId: id,
      confirmationId: conf.id,
      actorUserId: (req as any).user?.id,
      actorType: ActorType.USER,
      reason: body.reason,
    });

    return reply.send({ data: result.appointment });
  });

  // 6. GET /api/v1/workspaces/:workspaceId/availability
  app.get("/api/v1/workspaces/:workspaceId/availability", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.read");
    if (!membership) return;

    const query = req.query as {
      serviceId?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      timePreference?: "MORNING" | "AFTERNOON" | "EVENING" | "ANYTIME";
    };

    if (!query.serviceId) {
      return reply.status(400).send({
        error: { code: "SERVICE_ID_REQUIRED", message: "serviceId query parameter is required." },
      });
    }

    try {
      const availability = await availabilityService.getAvailability({
        workspaceId,
        serviceId: query.serviceId,
        date: query.date,
        startDate: query.startDate,
        endDate: query.endDate,
        timePreference: query.timePreference,
      });

      return reply.send({ data: availability });
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: "AVAILABILITY_ERROR", message: err.message },
      });
    }
  });

  // 7. POST /api/v1/workspaces/:workspaceId/confirmations/:id/confirm
  // Used to mark a pending confirmation as CONFIRMED when caller verbally confirms
  app.post("/api/v1/workspaces/:workspaceId/confirmations/:id/confirm", async (req, reply) => {
    const { workspaceId, id } = req.params as { workspaceId: string; id: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "appointments.update");
    if (!membership) return;

    const conf = await prisma.conversationConfirmation.findFirst({
      where: { id, workspaceId },
    });

    if (!conf) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Confirmation record not found." },
      });
    }

    if (conf.expiresAt < new Date()) {
      return reply.status(400).send({
        error: { code: "EXPIRED", message: "Confirmation request has expired." },
      });
    }

    const updated = await prisma.conversationConfirmation.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    return reply.send({ data: updated });
  });
}
