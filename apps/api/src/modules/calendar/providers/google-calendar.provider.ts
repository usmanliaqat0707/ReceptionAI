import { prisma, CalendarIntegrationStatus } from "@receptionai/db";
import {
  CalendarProvider,
  AvailabilityRequest,
  AvailabilityResult,
  CreateAppointmentRequest,
  ExternalAppointment,
  UpdateAppointmentRequest,
  CancelAppointmentRequest,
  ExternalCancellationResult,
  GetAppointmentRequest,
} from "../calendar.interface";
import { googleOAuthService } from "../services/google-oauth.service";

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerType = "GOOGLE_CALENDAR" as const;

  private async getValidAccessToken(
    workspaceId: string,
    integrationId: string
  ): Promise<{ accessToken: string; externalCalendarId: string }> {
    const integration = await prisma.calendarIntegration.findFirst({
      where: { id: integrationId, workspaceId },
    });

    if (!integration || !integration.encryptedCredentials) {
      throw new Error("CALENDAR_PROVIDER_UNAVAILABLE: Calendar integration or credentials not found.");
    }

    if (integration.status === "DISCONNECTED") {
      throw new Error("CALENDAR_PROVIDER_UNAVAILABLE: Calendar integration is disconnected.");
    }

    if (integration.status === "REAUTH_REQUIRED") {
      throw new Error("CALENDAR_AUTH_REQUIRED: Google Calendar authorization expired. Reconnect required.");
    }

    const creds = googleOAuthService.decryptCredentials(integration.encryptedCredentials);
    const expiresAt = new Date(creds.tokenExpiresAt).getTime();
    let accessToken = creds.accessToken;

    // Refresh if within 2 minutes of expiry
    if (Date.now() >= expiresAt - 120 * 1000) {
      if (!creds.refreshToken) {
        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: { status: CalendarIntegrationStatus.REAUTH_REQUIRED },
        });
        throw new Error("CALENDAR_AUTH_REQUIRED: Missing refresh token. Reauthorization required.");
      }

      try {
        const refreshed = await googleOAuthService.refreshAccessToken(creds.refreshToken);
        accessToken = refreshed.accessToken;

        const updatedCreds = {
          ...creds,
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.tokenExpiresAt.toISOString(),
        };

        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: {
            encryptedCredentials: googleOAuthService.encryptCredentials(updatedCreds),
            tokenExpiresAt: refreshed.tokenExpiresAt,
            status: CalendarIntegrationStatus.CONNECTED,
          },
        });
      } catch (err: any) {
        await prisma.calendarIntegration.update({
          where: { id: integration.id },
          data: { status: CalendarIntegrationStatus.REAUTH_REQUIRED },
        });
        throw new Error(`CALENDAR_AUTH_REQUIRED: Failed to refresh Google token: ${err.message}`);
      }
    }

    const calendarId = integration.externalCalendarId || "primary";
    return { accessToken, externalCalendarId: calendarId };
  }

  async getAvailability(input: AvailabilityRequest): Promise<AvailabilityResult> {
    const { accessToken, externalCalendarId } = await this.getValidAccessToken(
      input.workspaceId,
      input.calendarIntegrationId
    );

    const targetCalId = input.externalCalendarId || externalCalendarId;

    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: input.startDate.toISOString(),
        timeMax: input.endDate.toISOString(),
        timeZone: input.timezone,
        items: [{ id: targetCalId }],
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("CALENDAR_AUTH_REQUIRED: Unauthorized Google Calendar request.");
      }
      if (res.status === 429) {
        throw new Error("CALENDAR_RATE_LIMITED: Google Calendar API rate limit exceeded.");
      }
      const errText = await res.text();
      throw new Error(`CALENDAR_PROVIDER_UNAVAILABLE: Google FreeBusy failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const calendarData = data.calendars?.[targetCalId];
    const busyItems = calendarData?.busy || [];

    return {
      busyRanges: busyItems.map((b: any) => ({
        start: new Date(b.start),
        end: new Date(b.end),
      })),
    };
  }

  async createAppointment(input: CreateAppointmentRequest): Promise<ExternalAppointment> {
    const { accessToken, externalCalendarId } = await this.getValidAccessToken(
      input.workspaceId,
      input.calendarIntegrationId
    );

    const targetCalId = input.externalCalendarId || externalCalendarId;

    const description = [
      `ReceptionAI Appointment ID: ${input.appointmentId}`,
      `Service: ${input.serviceName}`,
      input.contactPhone ? `Contact Phone: ${input.contactPhone}` : null,
      input.contactEmail ? `Contact Email: ${input.contactEmail}` : null,
      input.notes ? `Notes: ${input.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const eventPayload = {
      summary: `${input.serviceName} — ${input.contactName}`,
      description,
      start: {
        dateTime: input.startAt.toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.endAt.toISOString(),
        timeZone: input.timezone,
      },
      extendedProperties: {
        private: {
          receptionai_appointment_id: input.appointmentId,
          workspace_id: input.workspaceId,
        },
      },
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("CALENDAR_AUTH_REQUIRED: Unauthorized Google Calendar request.");
      }
      const errText = await res.text();
      throw new Error(`APPOINTMENT_CREATE_FAILED: Google Event create failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;

    return {
      externalEventId: data.id,
      externalCalendarId: targetCalId,
      startAt: new Date(data.start.dateTime || data.start.date),
      endAt: new Date(data.end.dateTime || data.end.date),
      status: "CONFIRMED",
      htmlLink: data.htmlLink,
    };
  }

  async updateAppointment(input: UpdateAppointmentRequest): Promise<ExternalAppointment> {
    const { accessToken, externalCalendarId } = await this.getValidAccessToken(
      input.workspaceId,
      input.calendarIntegrationId
    );

    const targetCalId = input.externalCalendarId || externalCalendarId;

    const patchPayload: any = {
      start: {
        dateTime: input.startAt.toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.endAt.toISOString(),
        timeZone: input.timezone,
      },
    };

    if (input.title) patchPayload.summary = input.title;
    if (input.notes) patchPayload.description = input.notes;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        targetCalId
      )}/events/${encodeURIComponent(input.externalEventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchPayload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`APPOINTMENT_RESCHEDULE_FAILED: Google Event update failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;

    return {
      externalEventId: data.id,
      externalCalendarId: targetCalId,
      startAt: new Date(data.start.dateTime || data.start.date),
      endAt: new Date(data.end.dateTime || data.end.date),
      status: "CONFIRMED",
      htmlLink: data.htmlLink,
    };
  }

  async cancelAppointment(input: CancelAppointmentRequest): Promise<ExternalCancellationResult> {
    const { accessToken, externalCalendarId } = await this.getValidAccessToken(
      input.workspaceId,
      input.calendarIntegrationId
    );

    const targetCalId = input.externalCalendarId || externalCalendarId;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        targetCalId
      )}/events/${encodeURIComponent(input.externalEventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 404/410 means already deleted on Google, which is safe to treat as cancelled
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const errText = await res.text();
      throw new Error(`APPOINTMENT_CANCEL_FAILED: Google Event delete failed (${res.status}): ${errText}`);
    }

    return {
      success: true,
      externalEventId: input.externalEventId,
    };
  }

  async getAppointment(input: GetAppointmentRequest): Promise<ExternalAppointment | null> {
    const { accessToken, externalCalendarId } = await this.getValidAccessToken(
      input.workspaceId,
      input.calendarIntegrationId
    );

    const targetCalId = input.externalCalendarId || externalCalendarId;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        targetCalId
      )}/events/${encodeURIComponent(input.externalEventId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (res.status === 404 || res.status === 410) {
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Event get failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return {
      externalEventId: data.id,
      externalCalendarId: targetCalId,
      startAt: new Date(data.start.dateTime || data.start.date),
      endAt: new Date(data.end.dateTime || data.end.date),
      status: data.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
      htmlLink: data.htmlLink,
    };
  }
}
