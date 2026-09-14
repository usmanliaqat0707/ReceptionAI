import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  createLeadRestSchema,
  updateLeadRestSchema,
  queryLeadsRestSchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function leadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // GET /api/v1/workspaces/:workspaceId/leads
  app.get("/api/v1/workspaces/:workspaceId/leads", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "leads.read");
    if (!membership) return;

    const query = queryLeadsRestSchema.parse(req.query);
    const where: any = {
      workspaceId,
      archivedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.contactId) {
      where.contactId = query.contactId;
    }
    if (query.receptionistId) {
      where.receptionistId = query.receptionistId;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
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
              roleTitle: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return reply.send({
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // POST /api/v1/workspaces/:workspaceId/leads
  app.post("/api/v1/workspaces/:workspaceId/leads", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "leads.create");
    if (!membership) return;

    const body = createLeadRestSchema.parse(req.body);

    // Verify contact belongs to same workspace
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, workspaceId, archivedAt: null },
    });

    if (!contact) {
      return reply.status(404).send({
        error: { code: "CONTACT_NOT_FOUND", message: "Contact not found in this workspace" },
      });
    }

    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        contactId: body.contactId,
        receptionistId: body.receptionistId || null,
        status: body.status || "NEW",
        source: body.source || "MANUAL",
        intent: body.intent,
        qualification: body.qualification || null,
        notes: body.notes || null,
        assignedUserId: body.assignedUserId || null,
        estimatedValue: body.estimatedValue || null,
      },
      include: {
        contact: true,
        receptionist: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "lead.created",
        resourceType: "lead",
        resourceId: lead.id,
      },
    });

    return reply.status(201).send({ data: lead });
  });

  // GET /api/v1/workspaces/:workspaceId/leads/:leadId
  app.get("/api/v1/workspaces/:workspaceId/leads/:leadId", async (req, reply) => {
    const { workspaceId, leadId } = req.params as {
      workspaceId: string;
      leadId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "leads.read");
    if (!membership) return;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId, archivedAt: null },
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
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!lead) {
      return reply.status(404).send({
        error: { code: "LEAD_NOT_FOUND", message: "Lead not found" },
      });
    }

    return reply.send({ data: lead });
  });

  // PATCH /api/v1/workspaces/:workspaceId/leads/:leadId
  app.patch("/api/v1/workspaces/:workspaceId/leads/:leadId", async (req, reply) => {
    const { workspaceId, leadId } = req.params as {
      workspaceId: string;
      leadId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "leads.update");
    if (!membership) return;

    const body = updateLeadRestSchema.parse(req.body);
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId, archivedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: "LEAD_NOT_FOUND", message: "Lead not found" },
      });
    }

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.intent !== undefined && { intent: body.intent }),
        ...(body.qualification !== undefined && { qualification: body.qualification }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.assignedUserId !== undefined && { assignedUserId: body.assignedUserId }),
        ...(body.estimatedValue !== undefined && { estimatedValue: body.estimatedValue }),
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "lead.updated",
        resourceType: "lead",
        resourceId: leadId,
      },
    });

    return reply.send({ data: updated });
  });

  // POST /api/v1/workspaces/:workspaceId/leads/:leadId/archive
  app.post("/api/v1/workspaces/:workspaceId/leads/:leadId/archive", async (req, reply) => {
    const { workspaceId, leadId } = req.params as {
      workspaceId: string;
      leadId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "leads.archive");
    if (!membership) return;

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId, archivedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: "LEAD_NOT_FOUND", message: "Lead not found" },
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { archivedAt: new Date(), status: "ARCHIVED" },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "lead.archived",
        resourceType: "lead",
        resourceId: leadId,
      },
    });

    return reply.send({ success: true, message: "Lead archived successfully" });
  });
}
