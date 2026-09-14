import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { prisma, ActorType } from "@receptionai/db";
import {
  createReceptionistSchema,
  duplicateReceptionistSchema,
  assignTransferDestinationsSchema,
} from "@receptionai/validation";
import { maskPhoneNumber } from "@receptionai/security";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { ReceptionistPolicyService } from "./services/receptionist-policy.service";
import { ReceptionistRuntimeConfigService } from "./services/receptionist-runtime-config.service";
import { RECEPTIONIST_TEMPLATES } from "./services/templates";

export async function receptionistRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateSession);

  // Helper: Generate workspace-scoped unique slug
  async function generateUniqueSlug(workspaceId: string, baseName: string): Promise<string> {
    let slug = baseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) slug = "receptionist";

    const existing = await prisma.receptionist.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug,
        },
      },
    });

    if (!existing) return slug;
    return `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  }

  // 1. List Receptionists
  app.get<{
    Params: { workspaceId: string };
    Querystring: { status?: string; language?: string; industry?: string; search?: string };
  }>("/api/v1/workspaces/:workspaceId/receptionists", async (req, reply) => {
    const membership = await requireWorkspaceAccess(
      req,
      reply,
      req.params.workspaceId,
      "receptionists.read"
    );
    if (!membership) return;

    const { status, language, industry, search } = req.query;

    const where: any = {
      workspaceId: req.params.workspaceId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    } else if (!status) {
      // Default: exclude ARCHIVED unless explicitly requested
      where.status = { not: "ARCHIVED" };
    }

    if (language) where.primaryLanguage = language;
    if (industry) where.industry = industry;
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { roleTitle: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const receptionists = await prisma.receptionist.findMany({
      where,
      include: {
        transferDestinations: {
          include: { transferDestination: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = receptionists.map((r) => {
      const readiness = ReceptionistPolicyService.evaluateReadiness(r, r.transferDestinations);
      const runtimeReadiness = ReceptionistPolicyService.getRuntimeReadiness(r);
      return {
        id: r.id,
        workspaceId: r.workspaceId,
        name: r.name,
        slug: r.slug,
        roleTitle: r.roleTitle,
        industry: r.industry,
        primaryLanguage: r.primaryLanguage,
        status: r.status,
        readinessScore: readiness.score,
        isComplete: readiness.isComplete,
        runtimeReadiness,
        configurationVersion: r.configurationVersion,
        greeting: r.greeting,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return reply.send({ data });
  });

  // 2. Create Receptionist (from Template or Blank)
  app.post<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.create"
      );
      if (!membership) return;

      const validated = createReceptionistSchema.parse(req.body);
      const slug = await generateUniqueSlug(req.params.workspaceId, validated.name);

      // Apply template defaults if template identifier is provided
      let templateConfig = validated.template ? RECEPTIONIST_TEMPLATES[validated.template] : null;

      const newReceptionist = await prisma.$transaction(async (tx) => {
        const receptionist = await tx.receptionist.create({
          data: {
            workspaceId: req.params.workspaceId,
            name: validated.name,
            slug,
            roleTitle:
              validated.roleTitle || templateConfig?.roleTitle || "Front Desk Receptionist",
            industry: validated.industry || templateConfig?.industry || "GENERAL",
            primaryLanguage:
              validated.primaryLanguage || templateConfig?.primaryLanguage || "en-US",
            description: templateConfig?.description || null,
            status: "DRAFT",
            greeting: templateConfig?.greeting || null,
            afterHoursGreeting: templateConfig?.afterHoursGreeting || null,
            instructions: templateConfig?.instructions || null,
            voiceConfig: templateConfig?.voiceConfig || {
              speakingStyle: "professional",
              speakingRate: "normal",
              responsePacing: "balanced",
            },
            personalityConfig: templateConfig?.personalityConfig || {
              traits: ["PROFESSIONAL", "FRIENDLY"],
            },
            objectiveConfig: templateConfig?.objectiveConfig || {
              objectives: ["ANSWER_QUESTIONS", "TAKE_MESSAGES"],
            },
            behaviorConfig: templateConfig?.behaviorConfig || {
              responseLength: "balanced",
              askOneQuestionAtATime: true,
              confirmCriticalDetails: true,
              allowCallerInterruptions: true,
              silenceHandling: "PROMPT_ONCE",
              silenceTimeoutSeconds: 8,
              unknownAnswerBehavior: "take_message",
            },
            afterHoursConfig: templateConfig?.afterHoursConfig || {
              mode: "TAKE_MESSAGE",
              useCustomGreeting: false,
            },
            escalationConfig: templateConfig?.escalationConfig || {
              onHumanRequest: true,
              onEmergency: true,
              onRepeatedFailure: true,
              onUnsupportedRequest: false,
            },
            configurationVersion: 1,
            createdByUserId: req.user!.id,
            updatedByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.created",
            resourceType: "receptionist",
            resourceId: receptionist.id,
            metadata: {
              name: receptionist.name,
              slug: receptionist.slug,
              roleTitle: receptionist.roleTitle,
              template: validated.template || "blank",
            },
          },
        });

        return receptionist;
      });

      return reply.status(201).send({ data: newReceptionist });
    }
  );

  // 3. Get Single Receptionist Details
  app.get<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.read"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: {
          id: req.params.receptionistId,
          workspaceId: req.params.workspaceId,
        },
        include: {
          transferDestinations: {
            include: { transferDestination: true },
            orderBy: { priority: "asc" },
          },
          createdByUser: { select: { id: true, name: true, email: true } },
          updatedByUser: { select: { id: true, name: true, email: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found in this workspace.",
            requestId: req.id,
          },
        });
      }

      const readiness = ReceptionistPolicyService.evaluateReadiness(
        receptionist,
        receptionist.transferDestinations
      );
      const runtimeReadiness = ReceptionistPolicyService.getRuntimeReadiness(receptionist);

      return reply.send({
        data: {
          ...receptionist,
          readiness,
          runtimeReadiness,
          transferDestinations: receptionist.transferDestinations.map((td) => ({
            ...td,
            maskedDestination:
              td.transferDestination?.type === "PHONE"
                ? maskPhoneNumber(td.transferDestination.destination)
                : td.transferDestination?.destination || "",
          })),
        },
      });
    }
  );

  // 4. Update Receptionist Configuration (with Optimistic Concurrency Check)
  app.patch<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.update"
      );
      if (!membership) return;

      const existing = await prisma.receptionist.findFirst({
        where: {
          id: req.params.receptionistId,
          workspaceId: req.params.workspaceId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found in this workspace.",
            requestId: req.id,
          },
        });
      }

      if (existing.status === "ARCHIVED") {
        return reply.status(400).send({
          error: {
            code: "RECEPTIONIST_ARCHIVED",
            message: "Archived receptionists cannot be modified.",
            requestId: req.id,
          },
        });
      }

      const body = req.body as Record<string, any>;
      const expectedVersion = body.expectedVersion;

      // Optimistic concurrency control
      if (
        typeof expectedVersion === "number" &&
        existing.configurationVersion !== expectedVersion
      ) {
        return reply.status(409).send({
          error: {
            code: "CONFIGURATION_VERSION_CONFLICT",
            message: `This receptionist configuration was modified by another user. Current version is ${existing.configurationVersion}, but expected version was ${expectedVersion}. Please reload the latest changes.`,
            details: [
              { field: "currentVersion", message: String(existing.configurationVersion) },
              { field: "expectedVersion", message: String(expectedVersion) },
            ],
            requestId: req.id,
          },
        });
      }

      // Explicitly map allowed configuration fields
      const updateData: any = {
        updatedByUserId: req.user!.id,
      };

      const changedSections: string[] = [];

      if (body.name !== undefined && body.name !== existing.name) {
        updateData.name = body.name.trim();
        changedSections.push("identity");
      }
      if (body.roleTitle !== undefined && body.roleTitle !== existing.roleTitle) {
        updateData.roleTitle = body.roleTitle.trim();
        changedSections.push("identity");
      }
      if (body.description !== undefined && body.description !== existing.description) {
        updateData.description = body.description ? body.description.trim() : null;
        changedSections.push("identity");
      }
      if (body.industry !== undefined && body.industry !== existing.industry) {
        updateData.industry = body.industry;
        changedSections.push("identity");
      }
      if (body.primaryLanguage !== undefined && body.primaryLanguage !== existing.primaryLanguage) {
        updateData.primaryLanguage = body.primaryLanguage;
        changedSections.push("identity");
      }

      if (body.greeting !== undefined && body.greeting !== existing.greeting) {
        updateData.greeting = body.greeting ? body.greeting.trim() : null;
        changedSections.push("greeting");
      }
      if (
        body.afterHoursGreeting !== undefined &&
        body.afterHoursGreeting !== existing.afterHoursGreeting
      ) {
        updateData.afterHoursGreeting = body.afterHoursGreeting
          ? body.afterHoursGreeting.trim()
          : null;
        changedSections.push("greeting");
      }

      if (body.instructions !== undefined && body.instructions !== existing.instructions) {
        updateData.instructions = body.instructions;
        changedSections.push("instructions");
      }

      if (body.voiceConfig !== undefined) {
        updateData.voiceConfig = body.voiceConfig;
        changedSections.push("voice");
      }
      if (body.personalityConfig !== undefined) {
        updateData.personalityConfig = body.personalityConfig;
        changedSections.push("personality");
      }
      if (body.objectiveConfig !== undefined) {
        updateData.objectiveConfig = body.objectiveConfig;
        changedSections.push("objectives");
      }
      if (body.behaviorConfig !== undefined) {
        updateData.behaviorConfig = body.behaviorConfig;
        changedSections.push("behavior");
      }
      if (body.businessHoursStrategy !== undefined) {
        updateData.businessHoursStrategy = body.businessHoursStrategy;
        changedSections.push("businessHours");
      }
      if (body.customHours !== undefined) {
        updateData.customHours = body.customHours;
        changedSections.push("businessHours");
      }
      if (body.afterHoursConfig !== undefined) {
        updateData.afterHoursConfig = body.afterHoursConfig;
        changedSections.push("afterHours");
      }
      if (body.escalationConfig !== undefined) {
        updateData.escalationConfig = body.escalationConfig;
        changedSections.push("escalation");
      }

      // Only increment configurationVersion if actual configuration content changed
      const uniqueChangedSections = Array.from(new Set(changedSections));
      if (uniqueChangedSections.length > 0) {
        updateData.configurationVersion = existing.configurationVersion + 1;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.receptionist.update({
          where: { id: existing.id },
          data: updateData,
        });

        if (uniqueChangedSections.length > 0) {
          await tx.auditLog.create({
            data: {
              workspaceId: req.params.workspaceId,
              actorUserId: req.user!.id,
              actorType: ActorType.USER,
              action: "receptionist.updated",
              resourceType: "receptionist",
              resourceId: existing.id,
              metadata: {
                changedSections: uniqueChangedSections,
                oldVersion: existing.configurationVersion,
                newVersion: result.configurationVersion,
              },
            },
          });
        }

        return result;
      });

      return reply.send({
        data: updated,
        meta: {
          changedSections: uniqueChangedSections,
          versionIncremented: uniqueChangedSections.length > 0,
        },
      });
    }
  );

  // 5. Transition to TESTING
  app.post<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/testing",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.lifecycle"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
        include: {
          transferDestinations: { include: { transferDestination: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      if (!ReceptionistPolicyService.canTransitionStatus(receptionist.status, "TESTING")) {
        return reply.status(400).send({
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: `Cannot transition receptionist from ${receptionist.status} to TESTING.`,
            requestId: req.id,
          },
        });
      }

      const readiness = ReceptionistPolicyService.evaluateReadiness(
        receptionist,
        receptionist.transferDestinations
      );

      if (!readiness.canEnterTesting) {
        return reply.status(400).send({
          error: {
            code: "RECEPTIONIST_NOT_READY",
            message:
              "Configuration is incomplete. Please resolve all blocking issues before moving to Testing.",
            details: readiness.blockingIssues.map((i) => ({ field: i.field, message: i.message })),
            requestId: req.id,
          },
        });
      }

      const snapshot = ReceptionistPolicyService.createConfigurationSnapshot(
        receptionist,
        receptionist.transferDestinations
      );

      const updated = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionist.update({
          where: { id: receptionist.id },
          data: {
            status: "TESTING",
            updatedByUserId: req.user!.id,
          },
        });

        // Store immutable configuration version snapshot
        await tx.receptionistConfigurationVersion.upsert({
          where: {
            receptionistId_version: {
              receptionistId: rec.id,
              version: rec.configurationVersion,
            },
          },
          update: {
            snapshot,
            triggerStatus: "TESTING",
          },
          create: {
            workspaceId: req.params.workspaceId,
            receptionistId: rec.id,
            version: rec.configurationVersion,
            snapshot,
            triggerStatus: "TESTING",
            createdByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.status_changed",
            resourceType: "receptionist",
            resourceId: rec.id,
            metadata: {
              oldStatus: receptionist.status,
              newStatus: "TESTING",
              configurationVersion: rec.configurationVersion,
            },
          },
        });

        return rec;
      });

      return reply.send({
        data: updated,
        message: "Receptionist successfully transitioned to Testing.",
      });
    }
  );

  // 6. Transition to ACTIVE
  app.post<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/activate",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.lifecycle"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
        include: {
          transferDestinations: { include: { transferDestination: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      if (!ReceptionistPolicyService.canTransitionStatus(receptionist.status, "ACTIVE")) {
        return reply.status(400).send({
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: `Cannot transition receptionist from ${receptionist.status} to ACTIVE.`,
            requestId: req.id,
          },
        });
      }

      const readiness = ReceptionistPolicyService.evaluateReadiness(
        receptionist,
        receptionist.transferDestinations
      );

      if (!readiness.canActivate) {
        return reply.status(400).send({
          error: {
            code: "RECEPTIONIST_NOT_READY",
            message:
              "Configuration is incomplete. Please resolve all blocking issues before activating.",
            details: readiness.blockingIssues.map((i) => ({ field: i.field, message: i.message })),
            requestId: req.id,
          },
        });
      }

      const snapshot = ReceptionistPolicyService.createConfigurationSnapshot(
        receptionist,
        receptionist.transferDestinations
      );

      const updated = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionist.update({
          where: { id: receptionist.id },
          data: {
            status: "ACTIVE",
            updatedByUserId: req.user!.id,
          },
        });

        // Store immutable configuration version snapshot
        await tx.receptionistConfigurationVersion.upsert({
          where: {
            receptionistId_version: {
              receptionistId: rec.id,
              version: rec.configurationVersion,
            },
          },
          update: {
            snapshot,
            triggerStatus: "ACTIVE",
          },
          create: {
            workspaceId: req.params.workspaceId,
            receptionistId: rec.id,
            version: rec.configurationVersion,
            snapshot,
            triggerStatus: "ACTIVE",
            createdByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.status_changed",
            resourceType: "receptionist",
            resourceId: rec.id,
            metadata: {
              oldStatus: receptionist.status,
              newStatus: "ACTIVE",
              configurationVersion: rec.configurationVersion,
            },
          },
        });

        return rec;
      });

      return reply.send({
        data: updated,
        message:
          "Receptionist configuration marked as Active. Note: Realtime voice runtime is not connected in Phase 2.",
      });
    }
  );

  // 7. Transition to PAUSED
  app.post<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/pause",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.lifecycle"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      if (!ReceptionistPolicyService.canTransitionStatus(receptionist.status, "PAUSED")) {
        return reply.status(400).send({
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: `Cannot transition receptionist from ${receptionist.status} to PAUSED.`,
            requestId: req.id,
          },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionist.update({
          where: { id: receptionist.id },
          data: {
            status: "PAUSED",
            updatedByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.status_changed",
            resourceType: "receptionist",
            resourceId: rec.id,
            metadata: {
              oldStatus: receptionist.status,
              newStatus: "PAUSED",
            },
          },
        });

        return rec;
      });

      return reply.send({
        data: updated,
        message: "Receptionist paused successfully.",
      });
    }
  );

  // 8. Archive Receptionist
  app.post<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/archive",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.archive"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      if (receptionist.status === "ARCHIVED") {
        return reply.send({
          data: receptionist,
          message: "Receptionist is already archived.",
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const rec = await tx.receptionist.update({
          where: { id: receptionist.id },
          data: {
            status: "ARCHIVED",
            archivedAt: new Date(),
            updatedByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.archived",
            resourceType: "receptionist",
            resourceId: rec.id,
            metadata: {
              oldStatus: receptionist.status,
              newStatus: "ARCHIVED",
            },
          },
        });

        return rec;
      });

      return reply.send({
        data: updated,
        message: "Receptionist archived successfully.",
      });
    }
  );

  // 9. Duplicate Receptionist
  app.post<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/duplicate",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.create"
      );
      if (!membership) return;

      const source = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
        include: {
          transferDestinations: true,
        },
      });

      if (!source) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "Source receptionist not found.",
            requestId: req.id,
          },
        });
      }

      const validated = duplicateReceptionistSchema.parse(req.body || {});
      const duplicateName = validated.name || `${source.name} (Copy)`;
      const newSlug = await generateUniqueSlug(req.params.workspaceId, duplicateName);

      const duplicated = await prisma.$transaction(async (tx) => {
        const created = await tx.receptionist.create({
          data: {
            workspaceId: req.params.workspaceId,
            name: duplicateName,
            slug: newSlug,
            roleTitle: source.roleTitle,
            industry: source.industry,
            primaryLanguage: source.primaryLanguage,
            description: source.description,
            status: "DRAFT", // Always reset to DRAFT
            greeting: source.greeting,
            afterHoursGreeting: source.afterHoursGreeting,
            instructions: source.instructions,
            voiceConfig: source.voiceConfig ?? undefined,
            personalityConfig: source.personalityConfig ?? undefined,
            objectiveConfig: source.objectiveConfig ?? undefined,
            behaviorConfig: source.behaviorConfig ?? undefined,
            businessHoursStrategy: source.businessHoursStrategy,
            customHours: source.customHours ?? undefined,
            afterHoursConfig: source.afterHoursConfig ?? undefined,
            escalationConfig: source.escalationConfig ?? undefined,
            configurationVersion: 1, // Reset version to 1
            createdByUserId: req.user!.id,
            updatedByUserId: req.user!.id,
          },
        });

        // Copy transfer assignments
        if (source.transferDestinations.length > 0) {
          await tx.receptionistTransferDestination.createMany({
            data: source.transferDestinations.map((td) => ({
              receptionistId: created.id,
              transferDestinationId: td.transferDestinationId,
              priority: td.priority,
              purpose: td.purpose,
              enabled: td.enabled,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.duplicated",
            resourceType: "receptionist",
            resourceId: created.id,
            metadata: {
              sourceReceptionistId: source.id,
              sourceName: source.name,
              newName: created.name,
              newSlug: created.slug,
            },
          },
        });

        return created;
      });

      return reply.status(201).send({ data: duplicated });
    }
  );

  // 10. Get Readiness Evaluation
  app.get<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/readiness",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.read"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
        include: {
          transferDestinations: { include: { transferDestination: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      const readiness = ReceptionistPolicyService.evaluateReadiness(
        receptionist,
        receptionist.transferDestinations
      );
      const runtimeReadiness = ReceptionistPolicyService.getRuntimeReadiness(receptionist);

      return reply.send({
        data: {
          ...readiness,
          runtimeReadiness,
        },
      });
    }
  );

  // 11. Get Runtime Configuration Preview (Phase 3 Contract)
  app.get<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/runtime-config",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.read"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
        include: {
          transferDestinations: { include: { transferDestination: true } },
        },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      const runtimeConfig = ReceptionistRuntimeConfigService.buildReceptionistRuntimeConfig(
        receptionist,
        receptionist.transferDestinations
      );

      return reply.send({ data: runtimeConfig });
    }
  );

  // 12. List Configuration Version Snapshots
  app.get<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/versions",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.read"
      );
      if (!membership) return;

      const versions = await prisma.receptionistConfigurationVersion.findMany({
        where: {
          receptionistId: req.params.receptionistId,
          workspaceId: req.params.workspaceId,
        },
        include: {
          createdByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { version: "desc" },
      });

      return reply.send({ data: versions });
    }
  );

  // 13. Assign Transfer Destinations to Receptionist
  app.put<{ Params: { workspaceId: string; receptionistId: string } }>(
    "/api/v1/workspaces/:workspaceId/receptionists/:receptionistId/transfer-destinations",
    async (req, reply) => {
      const membership = await requireWorkspaceAccess(
        req,
        reply,
        req.params.workspaceId,
        "receptionists.update"
      );
      if (!membership) return;

      const receptionist = await prisma.receptionist.findFirst({
        where: { id: req.params.receptionistId, workspaceId: req.params.workspaceId },
      });

      if (!receptionist) {
        return reply.status(404).send({
          error: {
            code: "RECEPTIONIST_NOT_FOUND",
            message: "AI receptionist not found.",
            requestId: req.id,
          },
        });
      }

      const validated = assignTransferDestinationsSchema.parse(req.body);

      // Verify cross-workspace protection: all assigned destination IDs MUST belong to the current workspace
      const destinationIds = validated.destinations.map((d) => d.transferDestinationId);
      if (destinationIds.length > 0) {
        const workspaceDestinations = await prisma.transferDestination.findMany({
          where: {
            id: { in: destinationIds },
            workspaceId: req.params.workspaceId,
          },
          select: { id: true },
        });

        if (workspaceDestinations.length !== destinationIds.length) {
          return reply.status(400).send({
            error: {
              code: "CROSS_WORKSPACE_REFERENCE",
              message:
                "One or more transfer destinations do not exist or belong to a different workspace.",
              requestId: req.id,
            },
          });
        }
      }

      // Replace transfer assignments in transaction
      await prisma.$transaction(async (tx) => {
        await tx.receptionistTransferDestination.deleteMany({
          where: { receptionistId: receptionist.id },
        });

        if (validated.destinations.length > 0) {
          await tx.receptionistTransferDestination.createMany({
            data: validated.destinations.map((d) => ({
              receptionistId: receptionist.id,
              transferDestinationId: d.transferDestinationId,
              priority: d.priority,
              purpose: d.purpose as any,
              enabled: d.enabled,
            })),
          });
        }

        await tx.receptionist.update({
          where: { id: receptionist.id },
          data: {
            configurationVersion: receptionist.configurationVersion + 1,
            updatedByUserId: req.user!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: req.params.workspaceId,
            actorUserId: req.user!.id,
            actorType: ActorType.USER,
            action: "receptionist.transfers_updated",
            resourceType: "receptionist",
            resourceId: receptionist.id,
            metadata: {
              assignedCount: validated.destinations.length,
              newVersion: receptionist.configurationVersion + 1,
            },
          },
        });
      });

      const updatedDestinations = await prisma.receptionistTransferDestination.findMany({
        where: { receptionistId: receptionist.id },
        include: { transferDestination: true },
        orderBy: { priority: "asc" },
      });

      return reply.send({
        data: updatedDestinations.map((td) => ({
          ...td,
          maskedDestination:
            td.transferDestination?.type === "PHONE"
              ? maskPhoneNumber(td.transferDestination.destination)
              : td.transferDestination?.destination || "",
        })),
        message: "Transfer destinations updated successfully.",
      });
    }
  );
}
