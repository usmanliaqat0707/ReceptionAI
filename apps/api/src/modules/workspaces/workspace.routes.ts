import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma, ActorType } from "@receptionai/db";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@receptionai/validation";
import { ROLE_PERMISSIONS } from "@receptionai/config";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. List User Workspaces
  app.get("/api/v1/workspaces", async (req, reply) => {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({
      data: memberships.map((m) => ({
        ...m.workspace,
        role: m.role,
      })),
    });
  });

  // 2. Create Workspace (Atomic Transaction)
  app.post("/api/v1/workspaces", async (req, reply) => {
    const validated = createWorkspaceSchema.parse(req.body);
    const userId = req.user!.id;

    // Generate safe normalized slug
    let baseSlug = validated.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "workspace";

    // Check for collision and append random suffix if needed
    const existing = await prisma.workspace.findUnique({ where: { slug: baseSlug } });
    const slug = existing ? `${baseSlug}-${crypto.randomBytes(3).toString("hex")}` : baseSlug;

    // Atomic transaction: workspace + owner membership + audit log
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: validated.name,
          slug,
          industry: validated.industry,
          timezone: validated.timezone,
        },
      });

      const membership = await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: userId,
          actorType: ActorType.USER,
          action: "workspace.created",
          resourceType: "workspace",
          resourceId: workspace.id,
          metadata: {
            name: workspace.name,
            slug: workspace.slug,
            timezone: workspace.timezone,
          },
        },
      });

      return { workspace, membership };
    });

    return reply.status(201).send({
      data: {
        workspace: result.workspace,
        membership: result.membership,
      },
    });
  });

  // 3. Get Workspace Details
  app.get<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "workspace.read"
      );
      if (!membership) return;

      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.workspaceId },
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

      return reply.send({
        data: {
          workspace,
          membership: {
            id: membership.id,
            role: membership.role,
            status: membership.status,
          },
          permissions: ROLE_PERMISSIONS[membership.role] || [],
        },
      });
    }
  );

  // 4. Update Workspace
  app.patch<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "workspace.manage"
      );
      if (!membership) return;

      const validated = updateWorkspaceSchema.parse(req.body);

      // Mass assignment protection: whitelist fields explicitly
      const workspace = await prisma.workspace.update({
        where: { id: req.params.workspaceId },
        data: {
          name: validated.name,
          industry: validated.industry,
          timezone: validated.timezone,
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action: "workspace.updated",
          resourceType: "workspace",
          resourceId: workspace.id,
          metadata: validated,
        },
      });

      return reply.send({ data: { workspace } });
    }
  );
}
