import { FastifyRequest, FastifyReply } from "fastify";
import { prisma, User, Session, WorkspaceMembership, Workspace } from "@receptionai/db";
import { hashToken, hasPermission } from "@receptionai/security";
import { Permission, SESSION_COOKIE_NAME } from "@receptionai/config";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    session?: Session;
    membership?: WorkspaceMembership & { workspace: Workspace };
  }
}

export async function authenticateSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Extract token from httpOnly cookie or Bearer header
  const cookieToken = request.cookies[SESSION_COOKIE_NAME];
  const authHeader = request.headers.authorization;
  const rawToken = cookieToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!rawToken) {
    reply.status(401).send({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required. Please sign in.",
        requestId: request.id,
      },
    });
    return;
  }

  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt !== null) {
    reply.status(401).send({
      error: {
        code: "SESSION_REVOKED",
        message: "Your session has expired or been revoked. Please sign in again.",
        requestId: request.id,
      },
    });
    return;
  }

  if (session.expiresAt < new Date()) {
    reply.status(401).send({
      error: {
        code: "SESSION_EXPIRED",
        message: "Session expired. Please sign in again.",
        requestId: request.id,
      },
    });
    return;
  }

  if (session.user.status === "DISABLED") {
    reply.status(403).send({
      error: {
        code: "USER_DISABLED",
        message: "Your user account has been disabled. Please contact support.",
        requestId: request.id,
      },
    });
    return;
  }

  // Update lastUsedAt asynchronously
  prisma.session
    .update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  request.user = session.user;
  request.session = session;
}

export async function requireWorkspaceAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
  requiredPermission?: Permission
): Promise<(WorkspaceMembership & { workspace: Workspace }) | null> {
  if (!request.user) {
    reply.status(401).send({
      error: {
        code: "UNAUTHENTICATED",
        message: "User authentication required.",
        requestId: request.id,
      },
    });
    return null;
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: request.user.id,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "Access denied. You are not a member of this workspace.",
        requestId: request.id,
      },
    });
    return null;
  }

  if (membership.status !== "ACTIVE") {
    reply.status(403).send({
      error: {
        code: "MEMBERSHIP_INACTIVE",
        message: "Your membership in this workspace is currently disabled or pending.",
        requestId: request.id,
      },
    });
    return null;
  }

  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    reply.status(403).send({
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message: `Action requires '${requiredPermission}' permission.`,
        requestId: request.id,
      },
    });
    return null;
  }

  request.membership = membership;
  return membership;
}
