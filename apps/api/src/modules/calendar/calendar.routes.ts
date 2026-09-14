import { FastifyInstance } from "fastify";
import { prisma, CalendarProviderType, CalendarIntegrationStatus } from "@receptionai/db";
import { selectCalendarSchema } from "@receptionai/validation";
import { authenticateSession, requireWorkspaceAccess } from "../../middleware/auth";
import { googleOAuthService } from "./services/google-oauth.service";
import { calendarReconciliationService } from "../appointments/services/calendar-reconciliation.service";

export async function calendarRoutes(app: FastifyInstance) {
  // 1. Google OAuth Callback (Public endpoint from Google Redirect)
  app.get("/api/v1/integrations/google-calendar/callback", async (req, reply) => {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const webUrl = process.env.WEB_URL || "http://localhost:3000";

    if (error || !code || !state) {
      return reply.redirect(
        `${webUrl}/settings/scheduling?error=${encodeURIComponent(
          error || "Google authorization was cancelled or failed."
        )}`
      );
    }

    try {
      // Verify state
      const statePayload = googleOAuthService.verifyState(state);
      const { workspaceId, userId } = statePayload;

      // Exchange code
      const tokens = await googleOAuthService.exchangeCodeForTokens(code);

      // Encrypt tokens
      const encryptedCredentials = googleOAuthService.encryptCredentials({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt.toISOString(),
        scope: tokens.scope,
      });

      // Find primary calendar
      let externalCalendarId = "primary";
      try {
        const calendars = await googleOAuthService.listUserCalendars(tokens.accessToken);
        const primary = calendars.find((c) => c.primary) || calendars[0];
        if (primary) externalCalendarId = primary.id;
      } catch {
        // Default to "primary"
      }

      // Upsert integration
      const integration = await prisma.calendarIntegration.upsert({
        where: {
          id: `gcal_${workspaceId}`,
        },
        create: {
          id: `gcal_${workspaceId}`,
          workspaceId,
          provider: CalendarProviderType.GOOGLE_CALENDAR,
          name: "Google Calendar",
          status: CalendarIntegrationStatus.CONNECTED,
          externalCalendarId,
          encryptedCredentials,
          tokenExpiresAt: tokens.tokenExpiresAt,
          createdByUserId: userId,
        },
        update: {
          status: CalendarIntegrationStatus.CONNECTED,
          encryptedCredentials,
          tokenExpiresAt: tokens.tokenExpiresAt,
          externalCalendarId,
          disconnectedAt: null,
        },
      });

      return reply.redirect(`${webUrl}/settings/scheduling?connected=${integration.id}`);
    } catch (err: any) {
      return reply.redirect(
        `${webUrl}/settings/scheduling?error=${encodeURIComponent(err.message)}`
      );
    }
  });

  // Authenticated workspace routes
  app.register(async (authenticatedApp) => {
    authenticatedApp.addHook("preHandler", authenticateSession);

    // 2. GET /api/v1/workspaces/:workspaceId/calendar-integrations
    authenticatedApp.get(
      "/api/v1/workspaces/:workspaceId/calendar-integrations",
      async (req, reply) => {
        const { workspaceId } = req.params as { workspaceId: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.read"
        );
        if (!membership) return;

        const integrations = await prisma.calendarIntegration.findMany({
          where: { workspaceId },
          select: {
            id: true,
            provider: true,
            name: true,
            status: true,
            externalCalendarId: true,
            externalAccountId: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { services: true, appointments: true },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        return reply.send({ data: integrations });
      }
    );

    // 3. POST /api/v1/workspaces/:workspaceId/calendar-integrations/internal-demo
    authenticatedApp.post(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/internal-demo",
      async (req, reply) => {
        const { workspaceId } = req.params as { workspaceId: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.manage"
        );
        if (!membership) return;

        const existing = await prisma.calendarIntegration.findFirst({
          where: { workspaceId, provider: CalendarProviderType.INTERNAL_DEMO },
        });

        if (existing) {
          const updated = await prisma.calendarIntegration.update({
            where: { id: existing.id },
            data: { status: CalendarIntegrationStatus.CONNECTED, disconnectedAt: null },
          });
          return reply.send({ data: updated });
        }

        const integration = await prisma.calendarIntegration.create({
          data: {
            workspaceId,
            provider: CalendarProviderType.INTERNAL_DEMO,
            name: "Internal Demo Calendar",
            status: CalendarIntegrationStatus.CONNECTED,
            externalCalendarId: "primary_demo_calendar",
            createdByUserId: (req as any).user?.id,
          },
        });

        return reply.status(201).send({ data: integration });
      }
    );

    // 4. GET /api/v1/workspaces/:workspaceId/calendar-integrations/google/auth-url
    authenticatedApp.get(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/google/auth-url",
      async (req, reply) => {
        const { workspaceId } = req.params as { workspaceId: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.manage"
        );
        if (!membership) return;

        const { url, state } = googleOAuthService.generateAuthUrl({
          workspaceId,
          userId: (req as any).user?.id || "user",
        });

        return reply.send({ data: { url, state } });
      }
    );

    // 5. GET /api/v1/workspaces/:workspaceId/calendar-integrations/:id/calendars
    authenticatedApp.get(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/:id/calendars",
      async (req, reply) => {
        const { workspaceId, id } = req.params as { workspaceId: string; id: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.read"
        );
        if (!membership) return;

        const integration = await prisma.calendarIntegration.findFirst({
          where: { id, workspaceId, provider: CalendarProviderType.GOOGLE_CALENDAR },
        });

        if (!integration || !integration.encryptedCredentials) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: "Google Calendar integration not found." },
          });
        }

        try {
          const creds = googleOAuthService.decryptCredentials(integration.encryptedCredentials);
          const calendars = await googleOAuthService.listUserCalendars(creds.accessToken);
          return reply.send({ data: calendars });
        } catch (err: any) {
          return reply.status(400).send({
            error: { code: "GOOGLE_API_ERROR", message: err.message },
          });
        }
      }
    );

    // 6. POST /api/v1/workspaces/:workspaceId/calendar-integrations/:id/select-calendar
    authenticatedApp.post(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/:id/select-calendar",
      async (req, reply) => {
        const { workspaceId, id } = req.params as { workspaceId: string; id: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.manage"
        );
        if (!membership) return;

        const body = selectCalendarSchema.parse(req.body);

        const updated = await prisma.calendarIntegration.update({
          where: { id },
          data: { externalCalendarId: body.calendarId },
        });

        return reply.send({ data: updated });
      }
    );

    // 7. POST /api/v1/workspaces/:workspaceId/calendar-integrations/:id/disconnect
    authenticatedApp.post(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/:id/disconnect",
      async (req, reply) => {
        const { workspaceId, id } = req.params as { workspaceId: string; id: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.manage"
        );
        if (!membership) return;

        const updated = await prisma.calendarIntegration.update({
          where: { id },
          data: {
            status: CalendarIntegrationStatus.DISCONNECTED,
            disconnectedAt: new Date(),
          },
        });

        return reply.send({ data: updated });
      }
    );

    // 8. POST /api/v1/workspaces/:workspaceId/calendar-integrations/reconcile
    authenticatedApp.post(
      "/api/v1/workspaces/:workspaceId/calendar-integrations/reconcile",
      async (req, reply) => {
        const { workspaceId } = req.params as { workspaceId: string };
        const membership = await requireWorkspaceAccess(
          req,
          reply,
          workspaceId,
          "calendar_integrations.manage"
        );
        if (!membership) return;

        const result = await calendarReconciliationService.reconcileWorkspace(workspaceId);
        return reply.send({ data: result });
      }
    );
  });
}
