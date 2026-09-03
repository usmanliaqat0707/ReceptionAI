import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function auditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. Get Workspace Audit Logs (Bounded pagination)
  app.get<{
    Params: { workspaceId: string };
    Querystring: { page?: string; limit?: string };
  }>("/api/v1/workspaces/:workspaceId/audit-logs", async (req, reply) => {
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      req.params.workspaceId,
      "audit.read"
    );
    if (!membership) return;

    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({
        where: { workspaceId: req.params.workspaceId },
      }),
      prisma.auditLog.findMany({
        where: { workspaceId: req.params.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return reply.send({
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          actor: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
          actorType: log.actorType,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });
}
