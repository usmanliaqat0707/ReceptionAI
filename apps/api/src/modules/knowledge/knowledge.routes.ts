import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  createKnowledgeSourceSchema,
  updateKnowledgeSourceSchema,
  assignReceptionistKnowledgeSourcesSchema,
} from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { knowledgeIngestion } from "./services/knowledge-ingestion.service";
import { websiteCrawler } from "./services/crawler.service";
import { objectStorage } from "./services/storage.service";
import crypto from "crypto";

export async function knowledgeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // 1. GET /api/v1/workspaces/:workspaceId/knowledge/sources
  app.get("/api/v1/workspaces/:workspaceId/knowledge/sources", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.read");
    if (!membership) return;

    const query = req.query as { status?: string; type?: string; search?: string; receptionistId?: string };
    const where: any = {
      workspaceId,
      archivedAt: null,
    };

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: "insensitive" };
    }

    if (query.receptionistId) {
      where.receptionists = {
        some: { receptionistId: query.receptionistId },
      };
    }

    const sources = await prisma.knowledgeSource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { documents: true, chunks: true, receptionists: true },
        },
        receptionists: {
          include: {
            receptionist: {
              select: { id: true, name: true, roleTitle: true },
            },
          },
        },
      },
    });

    return reply.send({
      data: sources.map((s) => ({
        id: s.id,
        workspaceId: s.workspaceId,
        type: s.type,
        name: s.name,
        description: s.description,
        status: s.status,
        sourceUrl: s.sourceUrl,
        storageKey: s.storageKey,
        embeddingModel: s.embeddingModel,
        lastIndexedAt: s.lastIndexedAt,
        lastSuccessfulIndexedAt: s.lastSuccessfulIndexedAt,
        errorCode: s.errorCode,
        errorMessageSafe: s.errorMessageSafe,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        documentCount: s._count.documents,
        chunkCount: s._count.chunks,
        receptionistCount: s._count.receptionists,
        assignedReceptionists: s.receptionists.map((r) => r.receptionist),
      })),
    });
  });

  // 2. POST /api/v1/workspaces/:workspaceId/knowledge/sources
  app.post("/api/v1/workspaces/:workspaceId/knowledge/sources", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.create");
    if (!membership) return;

    const input = createKnowledgeSourceSchema.parse(req.body);

    // Enforce single index per website domain per workspace
    if (input.type === "WEBSITE" && input.sourceUrl) {
      const normalizedInput = websiteCrawler.normalizeUrl(input.sourceUrl);
      let inputHost = "";
      try {
        inputHost = new URL(normalizedInput).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        inputHost = normalizedInput.toLowerCase();
      }

      const existingSources = await prisma.knowledgeSource.findMany({
        where: {
          workspaceId,
          type: "WEBSITE",
          archivedAt: null,
        },
      });

      const existing = existingSources.find((s) => {
        if (!s.sourceUrl) return false;
        try {
          const sHost = new URL(websiteCrawler.normalizeUrl(s.sourceUrl)).hostname
            .replace(/^www\./, "")
            .toLowerCase();
          return sHost === inputHost;
        } catch {
          return false;
        }
      });

      if (existing) {
        // Update existing source and trigger re-index
        const updated = await prisma.knowledgeSource.update({
          where: { id: existing.id },
          data: {
            name: input.name || existing.name,
            sourceUrl: normalizedInput,
            configuration: (input.configuration || existing.configuration || {}) as any,
            status: "PENDING",
            errorCode: null,
            errorMessageSafe: null,
            updatedByUserId: membership.userId,
          },
        });

        await prisma.auditLog.create({
          data: {
            workspaceId,
            actorUserId: membership.userId,
            action: "knowledge.source_reindexed",
            resourceType: "knowledge_source",
            resourceId: existing.id,
            metadata: {
              sourceName: updated.name,
              sourceType: updated.type,
              reason: "website_source_deduplicated_reindex",
            },
          },
        });

        if (process.env.NODE_ENV === "test") {
          try {
            await knowledgeIngestion.ingestSource(workspaceId, existing.id);
          } catch (err: any) {
            console.warn(`Test ingestion error on deduplicated update: ${err.message}`);
          }
        } else {
          knowledgeIngestion.ingestSource(workspaceId, existing.id).catch((err) => {
            console.error(`Background reindexing failed for ${existing.id}:`, err);
          });
        }

        const reloaded = await prisma.knowledgeSource.findUnique({
          where: { id: existing.id },
        });

        return reply.status(200).send({ data: reloaded || updated });
      }
    }

    const source = await prisma.knowledgeSource.create({
      data: {
        workspaceId,
        type: input.type,
        name: input.name,
        description: input.description,
        sourceUrl: input.sourceUrl,
        storageKey: input.storageKey,
        configuration: input.configuration || {},
        createdByUserId: membership.userId,
        status: "PENDING",
      },
    });

    // Record audit event
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: membership.userId,
        action: "knowledge.source_created",
        resourceType: "knowledge_source",
        resourceId: source.id,
        metadata: {
          sourceName: source.name,
          sourceType: source.type,
        },
      },
    });

    // Kick off ingestion pipeline asynchronously (or wait in dev/test)
    if (process.env.NODE_ENV === "test") {
      try {
        await knowledgeIngestion.ingestSource(workspaceId, source.id);
      } catch (err: any) {
        console.warn(`Test ingestion error on create: ${err.message}`);
      }
    } else {
      knowledgeIngestion.ingestSource(workspaceId, source.id).catch((err) => {
        console.error(`Background ingestion failed for ${source.id}:`, err);
      });
    }

    const reloaded = await prisma.knowledgeSource.findUnique({
      where: { id: source.id },
    });

    return reply.status(201).send({ data: reloaded || source });
  });

  // 3. GET /api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId
  app.get("/api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId", async (req, reply) => {
    const { workspaceId, sourceId } = req.params as { workspaceId: string; sourceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.read");
    if (!membership) return;

    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, workspaceId, archivedAt: null },
      include: {
        _count: {
          select: { documents: true, chunks: true, receptionists: true },
        },
        receptionists: {
          include: {
            receptionist: {
              select: { id: true, name: true, roleTitle: true },
            },
          },
        },
        generations: {
          orderBy: { generation: "desc" },
          take: 5,
        },
      },
    });

    if (!source) {
      return reply.status(404).send({
        error: {
          code: "KNOWLEDGE_SOURCE_NOT_FOUND",
          message: `Knowledge source '${sourceId}' not found.`,
        },
      });
    }

    return reply.send({ data: source });
  });

  // 4. PATCH /api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId
  app.patch("/api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId", async (req, reply) => {
    const { workspaceId, sourceId } = req.params as { workspaceId: string; sourceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.update");
    if (!membership) return;

    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, workspaceId, archivedAt: null },
    });

    if (!source) {
      return reply.status(404).send({
        error: {
          code: "KNOWLEDGE_SOURCE_NOT_FOUND",
          message: `Knowledge source '${sourceId}' not found.`,
        },
      });
    }

    const input = updateKnowledgeSourceSchema.parse(req.body);
    const updated = await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        name: input.name ?? source.name,
        description: input.description !== undefined ? input.description : source.description,
        configuration: input.configuration !== undefined ? (input.configuration as any) : source.configuration,
        updatedByUserId: membership.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: membership.userId,
        action: "knowledge.source_updated",
        resourceType: "knowledge_source",
        resourceId: source.id,
      },
    });

    return reply.send({ data: updated });
  });

  // 5. POST /api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/reindex
  app.post("/api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/reindex", async (req, reply) => {
    const { workspaceId, sourceId } = req.params as { workspaceId: string; sourceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.reindex");
    if (!membership) return;

    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, workspaceId, archivedAt: null },
    });

    if (!source) {
      return reply.status(404).send({
        error: {
          code: "KNOWLEDGE_SOURCE_NOT_FOUND",
          message: `Knowledge source '${sourceId}' not found.`,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: membership.userId,
        action: "knowledge.reindex_requested",
        resourceType: "knowledge_source",
        resourceId: source.id,
      },
    });

    if (process.env.NODE_ENV === "test") {
      try {
        await knowledgeIngestion.ingestSource(workspaceId, sourceId);
      } catch (err: any) {
        console.warn(`Reindex error: ${err.message}`);
      }
    } else {
      knowledgeIngestion.ingestSource(workspaceId, sourceId).catch((err) => {
        console.error(`Reindex execution failed for ${sourceId}:`, err);
      });
    }

    return reply.send({
      data: {
        status: "PROCESSING",
        message: "Reindexing queued successfully.",
      },
    });
  });

  // 6. POST /api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/archive
  app.post("/api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/archive", async (req, reply) => {
    const { workspaceId, sourceId } = req.params as { workspaceId: string; sourceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.archive");
    if (!membership) return;

    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, workspaceId, archivedAt: null },
    });

    if (!source) {
      return reply.status(404).send({
        error: {
          code: "KNOWLEDGE_SOURCE_NOT_FOUND",
          message: `Knowledge source '${sourceId}' not found.`,
        },
      });
    }

    // Immediately archive and exclude from retrieval
    const archived = await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        updatedByUserId: membership.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: membership.userId,
        action: "knowledge.source_archived",
        resourceType: "knowledge_source",
        resourceId: source.id,
      },
    });

    return reply.send({ data: archived });
  });

  // 7. GET /api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/documents
  app.get("/api/v1/workspaces/:workspaceId/knowledge/sources/:sourceId/documents", async (req, reply) => {
    const { workspaceId, sourceId } = req.params as { workspaceId: string; sourceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.read");
    if (!membership) return;

    const documents = await prisma.knowledgeDocument.findMany({
      where: { sourceId, workspaceId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return reply.send({
      data: documents.map((d) => ({
        id: d.id,
        title: d.title,
        externalUrl: d.externalUrl,
        mimeType: d.mimeType,
        status: d.status,
        metadata: d.metadata,
        indexedAt: d.indexedAt,
        chunkCount: d._count.chunks,
      })),
    });
  });

  // 8. POST /api/v1/workspaces/:workspaceId/knowledge/sources/upload
  app.post("/api/v1/workspaces/:workspaceId/knowledge/sources/upload", async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.create");
    if (!membership) return;

    const body = req.body as {
      filename: string;
      contentType: string;
      base64Data: string;
      sourceName?: string;
    };

    if (!body.filename || !body.base64Data) {
      return reply.status(400).send({
        error: {
          code: "KNOWLEDGE_UPLOAD_INVALID",
          message: "Filename and base64Data are required.",
        },
      });
    }

    const buffer = Buffer.from(body.base64Data, "base64");
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.status(400).send({
        error: {
          code: "KNOWLEDGE_UPLOAD_TOO_LARGE",
          message: "Uploaded file cannot exceed 10MB.",
        },
      });
    }

    // Determine type
    const ext = body.filename.split(".").pop()?.toLowerCase();
    let sourceType: any = "TXT";
    if (ext === "pdf") sourceType = "PDF";
    else if (ext === "docx") sourceType = "DOCX";
    else if (ext === "md" || ext === "markdown") sourceType = "MARKDOWN";

    const storageKey = `workspaces/${workspaceId}/knowledge/${crypto.randomBytes(16).toString("hex")}_${body.filename}`;
    await objectStorage.put(storageKey, buffer, body.contentType || "application/octet-stream");

    // Create KnowledgeSource
    const source = await prisma.knowledgeSource.create({
      data: {
        workspaceId,
        type: sourceType,
        name: body.sourceName || body.filename.replace(/\.[^/.]+$/, ""),
        storageKey,
        status: "PENDING",
        createdByUserId: membership.userId,
      },
    });

    if (process.env.NODE_ENV === "test") {
      try {
        await knowledgeIngestion.ingestSource(workspaceId, source.id);
      } catch (err: any) {
        console.warn(`Upload test ingestion: ${err.message}`);
      }
    } else {
      knowledgeIngestion.ingestSource(workspaceId, source.id).catch((err) => {
        console.error(`Upload ingestion failed:`, err);
      });
    }

    const reloaded = await prisma.knowledgeSource.findUnique({ where: { id: source.id } });
    return reply.status(201).send({ data: reloaded || source });
  });

  // 9. GET /api/v1/workspaces/:workspaceId/receptionists/:receptionistId/knowledge-sources
  app.get(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/knowledge-sources",
    async (req, reply) => {
      const { workspaceId, receptionistId } = req.params as {
        workspaceId: string;
        receptionistId: string;
      };
      const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.read");
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: receptionistId, workspaceId },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: `Receptionist '${receptionistId}' not found.`,
          },
        });
      }

      const assignments = await prisma.receptionistKnowledgeSource.findMany({
        where: { receptionistId },
        include: {
          knowledgeSource: true,
        },
      });

      return reply.send({
        data: assignments.map((a) => a.knowledgeSource),
      });
    }
  );

  // 10. PUT /api/v1/workspaces/:workspaceId/receptionists/:receptionistId/knowledge-sources
  app.put(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/knowledge-sources",
    async (req, reply) => {
      const { workspaceId, receptionistId } = req.params as {
        workspaceId: string;
        receptionistId: string;
      };
      const membership = await requireWorkspaceAccess(req, reply, workspaceId, "knowledge.assign");
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: receptionistId, workspaceId },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: `Receptionist '${receptionistId}' not found.`,
          },
        });
      }

      const input = assignReceptionistKnowledgeSourcesSchema.parse(req.body);

      // Verify all knowledgeSourceIds belong to the same workspace!
      if (input.knowledgeSourceIds.length > 0) {
        const matchingSources = await prisma.knowledgeSource.findMany({
          where: {
            id: { in: input.knowledgeSourceIds },
            workspaceId,
            archivedAt: null,
          },
        });

        if (matchingSources.length !== input.knowledgeSourceIds.length) {
          return reply.status(400).send({
            error: {
              code: "KNOWLEDGE_ASSIGNMENT_CROSS_TENANT_REJECTED",
              message: "One or more knowledge sources do not exist or belong to another workspace.",
            },
          });
        }
      }

      // Transactionally replace receptionist assignments
      await prisma.$transaction(async (tx) => {
        await tx.receptionistKnowledgeSource.deleteMany({
          where: { receptionistId },
        });

        if (input.knowledgeSourceIds.length > 0) {
          await tx.receptionistKnowledgeSource.createMany({
            data: input.knowledgeSourceIds.map((sourceId) => ({
              receptionistId,
              knowledgeSourceId: sourceId,
            })),
          });
        }
      });

      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: membership.userId,
          action: "knowledge.assigned_to_receptionist",
          resourceType: "receptionist",
          resourceId: receptionistId,
          metadata: {
            assignedSourceCount: input.knowledgeSourceIds.length,
            assignedSourceIds: input.knowledgeSourceIds,
          },
        },
      });

      const updatedAssignments = await prisma.receptionistKnowledgeSource.findMany({
        where: { receptionistId },
        include: { knowledgeSource: true },
      });

      return reply.send({
        data: updatedAssignments.map((a) => a.knowledgeSource),
      });
    }
  );
}
