import { FastifyInstance } from "fastify";
import { prisma, ActorType } from "@receptionai/db";
import { generateSecureToken, hashToken, canManageTargetRole } from "@receptionai/security";
import { inviteMemberSchema, updateMemberRoleSchema } from "@receptionai/validation";
import { INVITATION_EXPIRY_DAYS } from "@receptionai/config";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { mailProvider } from "../../lib/mail";

export async function membershipRoutes(app: FastifyInstance) {
  // 1. Accept Invitation (Public route with authenticated user)
  app.post<{ Params: { token: string } }>(
    "/api/v1/invitations/:token/accept",
    { preHandler: [authenticateSession] },
    async (req, reply) => {
      const tokenHash = hashToken(req.params.token);

      const invitation = await prisma.workspaceInvitation.findUnique({
        where: { tokenHash },
        include: { workspace: true },
      });

      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
        return reply.status(400).send({
          error: {
            code: "INVALID_OR_EXPIRED_INVITATION",
            message: "This invitation link is invalid or has expired.",
            requestId: req.id,
          },
        });
      }

      const userId = req.user!.id;

      // Check if user is already a member
      const existingMembership = await prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
      });

      if (existingMembership) {
        return reply.status(409).send({
          error: {
            code: "ALREADY_MEMBER",
            message: "You are already a member of this workspace.",
            requestId: req.id,
          },
        });
      }

      // Atomic transaction
      await prisma.$transaction(async (tx) => {
        await tx.workspaceMembership.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
            status: "ACTIVE",
          },
        });

        await tx.workspaceInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedByUserId: userId,
            acceptedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: invitation.workspaceId,
            actorUserId: userId,
            actorType: ActorType.USER,
            action: "member.joined",
            resourceType: "workspace_membership",
            resourceId: userId,
            metadata: { role: invitation.role, email: req.user!.email },
          },
        });
      });

      return reply.send({
        data: {
          success: true,
          workspace: {
            id: invitation.workspace.id,
            name: invitation.workspace.name,
            slug: invitation.workspace.slug,
          },
        },
      });
    }
  );

  // Remaining routes require authenticated session
  app.register(async (authedApp) => {
    authedApp.addHook("preHandler", authenticateSession);

    // 2. List Members & Invitations
    authedApp.get<{ Params: { workspaceId: string } }>(
      "/api/v1/workspaces/:workspaceId/members",
      async (req, reply) => {
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          req.params.workspaceId,
          "members.read"
        );
        if (!membership) return;

        const members = await prisma.workspaceMembership.findMany({
          where: { workspaceId: req.params.workspaceId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const invitations = await prisma.workspaceInvitation.findMany({
          where: {
            workspaceId: req.params.workspaceId,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          data: {
            members: members.map((m) => ({
              id: m.id,
              userId: m.userId,
              name: m.user.name,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.role,
              status: m.status,
              createdAt: m.createdAt,
            })),
            invitations,
          },
        });
      }
    );

    // 3. Invite Member
    authedApp.post<{ Params: { workspaceId: string } }>(
      "/api/v1/workspaces/:workspaceId/invitations",
      async (req, reply) => {
        const actorMembership = await requireWorkspaceAccess(
          req,
          reply,
          req.params.workspaceId,
          "members.manage"
        );
        if (!actorMembership) return;

        const validated = inviteMemberSchema.parse(req.body);

        // Enforce role hierarchy: only Owner can invite an Owner
        if (!canManageTargetRole(actorMembership.role, "VIEWER", validated.role)) {
          return reply.status(403).send({
            error: {
              code: "FORBIDDEN",
              message: `You do not have permission to invite members with the '${validated.role}' role.`,
              requestId: req.id,
            },
          });
        }

        // Check if user is already a member
        const existingMember = await prisma.workspaceMembership.findFirst({
          where: {
            workspaceId: req.params.workspaceId,
            user: { email: validated.email },
          },
        });

        if (existingMember) {
          return reply.status(409).send({
            error: {
              code: "ALREADY_MEMBER",
              message: "User is already a member of this workspace.",
              requestId: req.id,
            },
          });
        }

        const rawToken = generateSecureToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

        const invitation = await prisma.workspaceInvitation.create({
          data: {
            workspaceId: req.params.workspaceId,
            email: validated.email,
            role: validated.role,
            tokenHash,
            expiresAt,
            invitedByUserId: req.user!.id,
          },
        });

        await prisma.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "member.invited",
            resourceType: "workspace_invitation",
            resourceId: invitation.id,
            metadata: { email: validated.email, role: validated.role },
          },
        });

        const inviteUrl = `${process.env.WEB_URL || "http://localhost:3000"}/signup?invitation=${rawToken}`;
        await mailProvider.sendMail({
          to: validated.email,
          subject: `You have been invited to join ${actorMembership.workspace.name} on ReceptionAI`,
          text: `You have been invited as a ${validated.role}.\n\nAccept your invitation here:\n${inviteUrl}\n\nLink expires in ${INVITATION_EXPIRY_DAYS} days.`,
        });

        return reply.status(201).send({
          data: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
          },
        });
      }
    );

    // 4. Update Member (Role / Status)
    authedApp.patch<{ Params: { workspaceId: string; memberId: string } }>(
      "/api/v1/workspaces/:workspaceId/members/:memberId",
      async (req, reply) => {
        const actorMembership = await requireWorkspaceAccess(
          req,
          reply,
          req.params.workspaceId,
          "members.manage"
        );
        if (!actorMembership) return;

        const targetMember = await prisma.workspaceMembership.findFirst({
          where: {
            id: req.params.memberId,
            workspaceId: req.params.workspaceId,
          },
          include: { user: true },
        });

        if (!targetMember) {
          return reply.status(404).send({
            error: {
              code: "MEMBER_NOT_FOUND",
              message: "Workspace member not found.",
              requestId: req.id,
            },
          });
        }

        const validated = updateMemberRoleSchema.parse(req.body);

        // Check role hierarchy
        if (!canManageTargetRole(actorMembership.role, targetMember.role, validated.role)) {
          return reply.status(403).send({
            error: {
              code: "FORBIDDEN",
              message: "You cannot modify a member with equal or higher role.",
              requestId: req.id,
            },
          });
        }

        // Owner Safeguard: Cannot demote or disable the last remaining Owner!
        if (
          targetMember.role === "OWNER" &&
          ((validated.role && validated.role !== "OWNER") || validated.status === "DISABLED")
        ) {
          const ownerCount = await prisma.workspaceMembership.count({
            where: {
              workspaceId: req.params.workspaceId,
              role: "OWNER",
              status: "ACTIVE",
            },
          });

          if (ownerCount <= 1) {
            return reply.status(400).send({
              error: {
                code: "CANNOT_DEMOTE_LAST_OWNER",
                message:
                  "A workspace must have at least one active Owner. Transfer ownership before demoting.",
                requestId: req.id,
              },
            });
          }
        }

        const updated = await prisma.workspaceMembership.update({
          where: { id: targetMember.id },
          data: {
            role: validated.role,
            status: validated.status,
          },
        });

        await prisma.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: validated.role ? "member.role_changed" : "member.status_changed",
            resourceType: "workspace_membership",
            resourceId: targetMember.id,
            metadata: {
              targetUserId: targetMember.userId,
              targetEmail: targetMember.user.email,
              oldRole: targetMember.role,
              newRole: updated.role,
              status: updated.status,
            },
          },
        });

        return reply.send({ data: { member: updated } });
      }
    );

    // 5. Remove Member
    authedApp.delete<{ Params: { workspaceId: string; memberId: string } }>(
      "/api/v1/workspaces/:workspaceId/members/:memberId",
      async (req, reply) => {
        const actorMembership = await requireWorkspaceAccess(
          req,
          reply,
          req.params.workspaceId,
          "members.manage"
        );
        if (!actorMembership) return;

        const targetMember = await prisma.workspaceMembership.findFirst({
          where: {
            id: req.params.memberId,
            workspaceId: req.params.workspaceId,
          },
          include: { user: true },
        });

        if (!targetMember) {
          return reply.status(404).send({
            error: {
              code: "MEMBER_NOT_FOUND",
              message: "Workspace member not found.",
              requestId: req.id,
            },
          });
        }

        if (!canManageTargetRole(actorMembership.role, targetMember.role)) {
          return reply.status(403).send({
            error: {
              code: "FORBIDDEN",
              message: "You cannot remove a member with equal or higher role.",
              requestId: req.id,
            },
          });
        }

        // Owner Safeguard: Cannot remove the last remaining Owner!
        if (targetMember.role === "OWNER") {
          const ownerCount = await prisma.workspaceMembership.count({
            where: {
              workspaceId: req.params.workspaceId,
              role: "OWNER",
              status: "ACTIVE",
            },
          });

          if (ownerCount <= 1) {
            return reply.status(400).send({
              error: {
                code: "CANNOT_REMOVE_LAST_OWNER",
                message: "Cannot remove the only remaining active Owner of the workspace.",
                requestId: req.id,
              },
            });
          }
        }

        await prisma.workspaceMembership.delete({
          where: { id: targetMember.id },
        });

        await prisma.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "member.removed",
            resourceType: "workspace_membership",
            resourceId: targetMember.id,
            metadata: {
              removedUserId: targetMember.userId,
              removedEmail: targetMember.user.email,
              role: targetMember.role,
            },
          },
        });

        return reply.send({ data: { success: true } });
      }
    );
  });
}
