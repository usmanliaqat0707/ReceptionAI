import { prisma } from "@receptionai/db";
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

export class InternalDemoCalendarProvider implements CalendarProvider {
  readonly providerType = "INTERNAL_DEMO" as const;

  async getAvailability(input: AvailabilityRequest): Promise<AvailabilityResult> {
    // Query existing confirmed or pending appointments for this integration in PostgreSQL
    const existing = await prisma.appointment.findMany({
      where: {
        workspaceId: input.workspaceId,
        calendarIntegrationId: input.calendarIntegrationId,
        status: { in: ["CONFIRMED", "PENDING"] },
        startAt: { lt: input.endDate },
        endAt: { gt: input.startDate },
      },
      select: {
        startAt: true,
        endAt: true,
      },
      orderBy: { startAt: "asc" },
    });

    return {
      busyRanges: existing.map((appt) => ({
        start: appt.startAt,
        end: appt.endAt,
      })),
    };
  }

  async createAppointment(input: CreateAppointmentRequest): Promise<ExternalAppointment> {
    // Generate deterministic demo event ID
    const externalEventId = `demo_evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      externalEventId,
      externalCalendarId: input.externalCalendarId || "primary_demo_calendar",
      startAt: input.startAt,
      endAt: input.endAt,
      status: "CONFIRMED",
      htmlLink: `https://app.receptionai.local/demo-calendar/${externalEventId}`,
    };
  }

  async updateAppointment(input: UpdateAppointmentRequest): Promise<ExternalAppointment> {
    return {
      externalEventId: input.externalEventId,
      externalCalendarId: input.externalCalendarId || "primary_demo_calendar",
      startAt: input.startAt,
      endAt: input.endAt,
      status: "CONFIRMED",
      htmlLink: `https://app.receptionai.local/demo-calendar/${input.externalEventId}`,
    };
  }

  async cancelAppointment(input: CancelAppointmentRequest): Promise<ExternalCancellationResult> {
    return {
      success: true,
      externalEventId: input.externalEventId,
    };
  }

  async getAppointment(input: GetAppointmentRequest): Promise<ExternalAppointment | null> {
    const appt = await prisma.appointment.findFirst({
      where: {
        workspaceId: input.workspaceId,
        calendarIntegrationId: input.calendarIntegrationId,
        externalEventId: input.externalEventId,
      },
    });

    if (!appt) return null;

    return {
      externalEventId: appt.externalEventId || input.externalEventId,
      externalCalendarId: appt.externalCalendarId || "primary_demo_calendar",
      startAt: appt.startAt,
      endAt: appt.endAt,
      status: appt.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
    };
  }
}
