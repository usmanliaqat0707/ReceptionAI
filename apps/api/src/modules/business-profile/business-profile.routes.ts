import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import { updateBusinessProfileRestSchema } from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function businessProfileRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // GET /api/v1/workspaces/:workspaceId/business-profile
  app.get("/api/v1/workspaces/:workspaceId/business-profile", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "business_profile.read");
    if (!membership) return;

    const profile = await prisma.businessProfile.findUnique({
      where: { workspaceId },
    });

    if (!profile) {
      // Return workspace fallback if not yet initialized
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) {
        return reply.status(404).send({
          error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" },
        });
      }
      return reply.send({
        data: {
          workspaceId,
          businessName: workspace.name,
          legalName: workspace.name,
          description: null,
          phone: null,
          email: null,
          website: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          country: "US",
          timezone: workspace.timezone,
        },
      });
    }

    return reply.send({ data: profile });
  });

  // PATCH /api/v1/workspaces/:workspaceId/business-profile
  app.patch("/api/v1/workspaces/:workspaceId/business-profile", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "business_profile.manage");
    if (!membership) return;

    const body = updateBusinessProfileRestSchema.parse(req.body);

    const profile = await prisma.businessProfile.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        businessName: body.businessName || "ReceptionAI Business",
        legalName: body.legalName || null,
        description: body.description || null,
        phone: body.phone || null,
        email: body.email || null,
        website: body.website || null,
        addressLine1: body.addressLine1 || null,
        addressLine2: body.addressLine2 || null,
        city: body.city || null,
        region: body.region || null,
        postalCode: body.postalCode || null,
        country: body.country || "US",
        timezone: body.timezone || "America/New_York",
      },
      update: {
        ...(body.businessName !== undefined && { businessName: body.businessName }),
        ...(body.legalName !== undefined && { legalName: body.legalName }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.addressLine1 !== undefined && { addressLine1: body.addressLine1 }),
        ...(body.addressLine2 !== undefined && { addressLine2: body.addressLine2 }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.region !== undefined && { region: body.region }),
        ...(body.postalCode !== undefined && { postalCode: body.postalCode }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorType: "USER",
        actorUserId: req.user!.id,
        action: "business_profile.updated",
        resourceType: "business_profile",
        resourceId: profile.id,
      },
    });

    return reply.send({ data: profile });
  });
}
