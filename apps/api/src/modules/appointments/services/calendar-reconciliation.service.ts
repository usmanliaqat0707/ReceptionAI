import { prisma, AppointmentStatus, AppointmentOperationStatus } from "@receptionai/db";
import { CalendarProviderFactory } from "../../calendar/calendar-provider.factory";

export interface ReconciliationResult {
  inspectedCount: number;
  compensatedCount: number;
  syncedCancellations: number;
}

export class CalendarReconciliationService {
  /**
   * Reconciles appointments against external calendar provider.
   */
  async reconcileWorkspace(workspaceId: string): Promise<ReconciliationResult> {
    let compensatedCount = 0;
    let syncedCancellations = 0;

    // 1. Process COMPENSATION_REQUIRED operations
    const failedOps = await prisma.appointmentOperation.findMany({
      where: {
        workspaceId,
        status: AppointmentOperationStatus.COMPENSATION_REQUIRED,
      },
      take: 20,
    });

    for (const op of failedOps) {
      if (op.externalEventId && op.appointmentId) {
        const appt = await prisma.appointment.findUnique({
          where: { id: op.appointmentId },
          include: { calendarIntegration: true },
        });

        if (appt && appt.calendarIntegration) {
          try {
            const provider = CalendarProviderFactory.getProvider(
              appt.calendarIntegration.provider
            );
            await provider.cancelAppointment({
              workspaceId,
              calendarIntegrationId: appt.calendarIntegrationId,
              externalCalendarId: appt.externalCalendarId,
              externalEventId: op.externalEventId,
              reason: "Automated compensation for interrupted booking transaction",
            });
            await prisma.appointmentOperation.update({
              where: { id: op.id },
              data: { status: AppointmentOperationStatus.FAILED },
            });
            compensatedCount++;
          } catch {
            // Leave for next retry
          }
        }
      }
    }

    // 2. Check active appointments in Google Calendar that were externally deleted
    const activeGoogleAppts = await prisma.appointment.findMany({
      where: {
        workspaceId,
        status: AppointmentStatus.CONFIRMED,
        externalEventId: { not: null },
        calendarIntegration: {
          provider: "GOOGLE_CALENDAR",
          status: "CONNECTED",
        },
      },
      include: { calendarIntegration: true },
      take: 50,
    });

    for (const appt of activeGoogleAppts) {
      if (appt.calendarIntegration && appt.externalEventId) {
        try {
          const provider = CalendarProviderFactory.getProvider(
            appt.calendarIntegration.provider
          );
          const ext = await provider.getAppointment({
            workspaceId,
            calendarIntegrationId: appt.calendarIntegrationId,
            externalCalendarId: appt.externalCalendarId,
            externalEventId: appt.externalEventId,
          });

          if (!ext || ext.status === "CANCELLED") {
            await prisma.appointment.update({
              where: { id: appt.id },
              data: {
                status: AppointmentStatus.CANCELLED,
                cancelledAt: new Date(),
              },
            });
            syncedCancellations++;
          }
        } catch {
          // Provider error or rate limit, ignore for this cycle
        }
      }
    }

    return {
      inspectedCount: failedOps.length + activeGoogleAppts.length,
      compensatedCount,
      syncedCancellations,
    };
  }
}

export const calendarReconciliationService = new CalendarReconciliationService();
