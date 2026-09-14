import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  createContactRestSchema,
  updateContactRestSchema,
  queryContactsRestSchema,
  normalizePhoneNumber,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function contactRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // GET /api/v1/workspaces/:workspaceId/contacts
  app.get("/api/v1/workspaces/:workspaceId/contacts", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "contacts.read");
    if (!membership) return;

    const query = queryContactsRestSchema.parse(req.query);
    const where: any = {
      workspaceId,
      archivedAt: null,
    };

    if (query.source) {
      where.source = query.source;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { firstName: { contains: s, mode: "insensitive" } },
        { lastName: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { phone: { contains: s } },
        { company: { contains: s, mode: "insensitive" } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { leads: true, messages: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return reply.send({
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // POST /api/v1/workspaces/:workspaceId/contacts
  app.post("/api/v1/workspaces/:workspaceId/contacts", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "contacts.create");
    if (!membership) return;

    const body = createContactRestSchema.parse(req.body);
    const normalizedPhone = normalizePhoneNumber(body.phone);
    const normalizedEmail = body.email ? body.email.trim().toLowerCase() : null;

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        firstName: body.firstName,
        lastName: body.lastName || null,
        phone: body.phone || null,
        normalizedPhone,
        email: body.email || null,
        normalizedEmail,
        company: body.company || null,
        notes: body.notes || null,
        source: body.source || "MANUAL",
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "contact.created",
        resourceType: "contact",
        resourceId: contact.id,
      },
    });

    return reply.status(201).send({ data: contact });
  });

  // GET /api/v1/workspaces/:workspaceId/contacts/:contactId
  app.get("/api/v1/workspaces/:workspaceId/contacts/:contactId", async (req, reply) => {
    const { workspaceId, contactId } = req.params as {
      workspaceId: string;
      contactId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "contacts.read");
    if (!membership) return;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId, archivedAt: null },
      include: {
        leads: {
          orderBy: { createdAt: "desc" },
          include: {
            receptionist: { select: { id: true, name: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          include: {
            receptionist: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!contact) {
      return reply.status(404).send({
        error: { code: "CONTACT_NOT_FOUND", message: "Contact not found" },
      });
    }

    return reply.send({ data: contact });
  });

  // PATCH /api/v1/workspaces/:workspaceId/contacts/:contactId
  app.patch("/api/v1/workspaces/:workspaceId/contacts/:contactId", async (req, reply) => {
    const { workspaceId, contactId } = req.params as {
      workspaceId: string;
      contactId: string;
    };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "contacts.update");
    if (!membership) return;

    const body = updateContactRestSchema.parse(req.body);
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId, archivedAt: null },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: "CONTACT_NOT_FOUND", message: "Contact not found" },
      });
    }

    const updateData: any = {};
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.phone !== undefined) {
      updateData.phone = body.phone;
      updateData.normalizedPhone = normalizePhoneNumber(body.phone);
    }
    if (body.email !== undefined) {
      updateData.email = body.email;
      updateData.normalizedEmail = body.email ? body.email.trim().toLowerCase() : null;
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "contact.updated",
        resourceType: "contact",
        resourceId: contactId,
      },
    });

    return reply.send({ data: updated });
  });

  // POST /api/v1/workspaces/:workspaceId/contacts/:contactId/archive
  app.post(
    "/api/v1/workspaces/:workspaceId/contacts/:contactId/archive",
    async (req, reply) => {
      const { workspaceId, contactId } = req.params as {
        workspaceId: string;
        contactId: string;
      };
      const membership = await requireWorkspaceAccess(req, reply, workspaceId, "contacts.archive");
      if (!membership) return;

      const existing = await prisma.contact.findFirst({
        where: { id: contactId, workspaceId, archivedAt: null },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: "CONTACT_NOT_FOUND", message: "Contact not found" },
        });
      }

      await prisma.contact.update({
        where: { id: contactId },
        data: { archivedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorType: "USER",
          actorUserId: req.user!.id,
          action: "contact.archived",
          resourceType: "contact",
          resourceId: contactId,
        },
      });

      return reply.send({ success: true, message: "Contact archived successfully" });
    }
  );
}
