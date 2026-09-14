import { FastifyInstance } from "fastify";
import { prisma, ActorType } from "@receptionai/db";
import {
  createTransferDestinationSchema,
  updateTransferDestinationSchema,
} from "@receptionai/validation";
import { normalizeE164, maskPhoneNumber } from "@receptionai/security";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";

export async function transferDestinationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. List Transfer Destinations for Workspace
  app.get<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId/transfer-destinations",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "transfer_destinations.read"
      );
      if (!membership) return;

      const destinations = await prisma.transferDestination.findMany({
        where: {
          workspaceId: req.params.workspaceId,
          status: { not: "ARCHIVED" },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        data: destinations.map((d) => ({
          ...d,
          maskedDestination: d.type === "PHONE" ? maskPhoneNumber(d.destination) : d.destination,
        })),
      });
    }
  );

  // 2. Create Transfer Destination
  app.post<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId/transfer-destinations",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "transfer_destinations.manage"
      );
      if (!membership) return;

      const validated = createTransferDestinationSchema.parse(req.body);

      // Validate & normalize E.164 phone numbers if PHONE type
      let normalizedDestination = validated.destination;
      if (validated.type === "PHONE") {
        try {
          normalizedDestination = normalizeE164(validated.destination);
        } catch (err: any) {
          return reply.status(400).send({
            error: {
              code: "INVALID_PHONE_NUMBER",
              message: err.message || "Invalid E.164 phone number format.",
              requestId: req.id,
            },
          });
        }
      }

      const destination = await prisma.transferDestination.create({
        data: {
          workspaceId: req.params.workspaceId,
          name: validated.name,
          type: validated.type,
          destination: normalizedDestination,
        },
      });

      // Audit trail
      await prisma.auditLog.create({
        data: {
          workspaceId: req.params.workspaceId,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action: "transfer_destination.created",
          resourceType: "transfer_destination",
          resourceId: destination.id,
          metadata: {
            name: destination.name,
            type: destination.type,
            maskedDestination:
              destination.type === "PHONE"
                ? maskPhoneNumber(destination.destination)
                : destination.destination,
          },
        },
      });

      return reply.status(201).send({
        data: {
          ...destination,
          maskedDestination:
            destination.type === "PHONE"
              ? maskPhoneNumber(destination.destination)
              : destination.destination,
        },
      });
    }
  );

  // 3. Update Transfer Destination
  app.patch<{ Params: { workspaceId: string; destinationId: string } }>(
    "/api/v1/workspaces/:workspaceId/transfer-destinations/:destinationId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "transfer_destinations.manage"
      );
      if (!membership) return;

      const existing = await prisma.transferDestination.findFirst({
        where: {
          id: req.params.destinationId,
          workspaceId: req.params.workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: "TRANSFER_DESTINATION_NOT_FOUND",
            message: "Transfer destination not found in this workspace.",
            requestId: req.id,
          },
        });
      }

      const validated = updateTransferDestinationSchema.parse(req.body);
      let normalizedDestination = validated.destination;
      if (normalizedDestination && existing.type === "PHONE") {
        try {
          normalizedDestination = normalizeE164(normalizedDestination);
        } catch (err: any) {
          return reply.status(400).send({
            error: {
              code: "INVALID_PHONE_NUMBER",
              message: err.message,
              requestId: req.id,
            },
          });
        }
      }

      const updated = await prisma.transferDestination.update({
        where: { id: existing.id },
        data: {
          name: validated.name ?? undefined,
          destination: normalizedDestination ?? undefined,
          status: validated.status ?? undefined,
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: req.params.workspaceId,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action: "transfer_destination.updated",
          resourceType: "transfer_destination",
          resourceId: updated.id,
          metadata: {
            name: updated.name,
            status: updated.status,
          },
        },
      });

      return reply.send({
        data: {
          ...updated,
          maskedDestination:
            updated.type === "PHONE" ? maskPhoneNumber(updated.destination) : updated.destination,
        },
      });
    }
  );

  // 4. Archive/Disable Transfer Destination (soft delete)
  app.delete<{ Params: { workspaceId: string; destinationId: string } }>(
    "/api/v1/workspaces/:workspaceId/transfer-destinations/:destinationId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "transfer_destinations.manage"
      );
      if (!membership) return;

      const existing = await prisma.transferDestination.findFirst({
        where: {
          id: req.params.destinationId,
          workspaceId: req.params.workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: "TRANSFER_DESTINATION_NOT_FOUND",
            message: "Transfer destination not found in this workspace.",
            requestId: req.id,
          },
        });
      }

      const updated = await prisma.transferDestination.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED" },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: req.params.workspaceId,
          actorUserId: req.user!.id,
          actorType: ActorType.USER,
          action: "transfer_destination.archived",
          resourceType: "transfer_destination",
          resourceId: updated.id,
        },
      });

      return reply.send({
        data: { message: "Transfer destination archived successfully.", id: updated.id },
      });
    }
  );
}
