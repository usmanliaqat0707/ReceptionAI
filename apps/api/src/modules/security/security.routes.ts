import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import { hashPassword, verifyPassword } from "@receptionai/security";
import { changePasswordSchema } from "@receptionai/validation";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { authenticateSession } from "../../middleware/auth";

export async function securityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. List Active Sessions
  app.get("/api/v1/security/sessions", async (req, reply) => {
    const userId = req.user!.id;
    const currentSessionId = req.session!.id;

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    return reply.send({
      data: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === currentSessionId,
      })),
    });
  });

  // 2. Revoke Specific Session
  app.delete<{ Params: { sessionId: string } }>(
    "/api/v1/security/sessions/:sessionId",
    async (req, reply) => {
      const userId = req.user!.id;

      const session = await prisma.session.findFirst({
        where: { id: req.params.sessionId, userId },
      });

      if (!session) {
        return reply.status(404).send({
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Session not found.",
            requestId: req.id,
          },
        });
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      // If user revoked current session, clear cookie
      if (session.id === req.session!.id) {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
      }

      return reply.send({ data: { success: true } });
    }
  );

  // 3. Revoke All Other Sessions
  app.post("/api/v1/security/sessions/revoke-others", async (req, reply) => {
    const userId = req.user!.id;
    const currentSessionId = req.session!.id;

    const result = await prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return reply.send({
      data: {
        success: true,
        revokedCount: result.count,
      },
    });
  });

  // 4. Change Password
  app.post("/api/v1/security/change-password", async (req, reply) => {
    const validated = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({
        error: { code: "USER_NOT_FOUND", message: "User not found.", requestId: req.id },
      });
    }

    const isValid = await verifyPassword(validated.currentPassword, user.passwordHash);
    if (!isValid) {
      return reply.status(400).send({
        error: {
          code: "INVALID_CURRENT_PASSWORD",
          message: "Current password does not match.",
          requestId: req.id,
        },
      });
    }

    const newPasswordHash = await hashPassword(validated.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      // Revoke all other sessions for security
      prisma.session.updateMany({
        where: { userId, id: { not: req.session!.id }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return reply.send({
      data: {
        message: "Password changed successfully. All other sessions have been logged out.",
      },
    });
  });
}
