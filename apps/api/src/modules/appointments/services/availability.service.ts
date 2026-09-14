import { prisma } from "@receptionai/db";
import {
  MAX_AVAILABILITY_SEARCH_DAYS,
  MAX_AVAILABILITY_SLOTS_RETURNED,
  DEFAULT_MINIMUM_LEAD_TIME_MINUTES,
  DEFAULT_MAXIMUM_ADVANCE_DAYS,
} from "@receptionai/config";
import { CalendarProviderFactory } from "../../calendar/calendar-provider.factory";
import { slotTokenService } from "./slot-token.service";

export interface CheckAvailabilityParams {
  workspaceId: string;
  serviceId: string;
  date?: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  timePreference?: "MORNING" | "AFTERNOON" | "EVENING" | "ANYTIME";
}

export interface ComputedSlot {
  slotId: string;
  startAt: string; // ISO UTC string
  endAt: string;   // ISO UTC string
  formattedTime: string;
}

export interface AvailabilityEngineResult {
  timezone: string;
  serviceName: string;
  durationMinutes: number;
  slots: ComputedSlot[];
}

export class AvailabilityService {
  /**
   * Computes authoritative availability by intersecting:
   * 1. Service duration & buffers
   * 2. Workspace business hours & special hours overrides
   * 3. Appointment policy (lead times & advance limits)
   * 4. External calendar provider busy ranges
   * 5. Internal confirmed appointments
   */
  async getAvailability(params: CheckAvailabilityParams): Promise<AvailabilityEngineResult> {
    const { workspaceId, serviceId, timePreference = "ANYTIME" } = params;

    // 1. Fetch Service
    const service = await prisma.service.findFirst({
      where: { id: serviceId, workspaceId, active: true, archivedAt: null },
    });

    if (!service) {
      throw new Error("SERVICE_NOT_FOUND: Service not found or inactive.");
    }

    // 2. Fetch Workspace, Hours & Policy
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        businessHours: true,
        specialHours: true,
        appointmentPolicy: true,
        calendarIntegrations: {
          where: { status: "CONNECTED" },
        },
      },
    });

    if (!workspace) {
      throw new Error("WORKSPACE_NOT_FOUND: Workspace not found.");
    }

    const timezone = workspace.timezone || "America/New_York";

    // 3. Resolve Calendar Integration
    let calendarIntegration = workspace.calendarIntegrations.find(
      (c) => c.id === service.calendarIntegrationId
    );

    if (!calendarIntegration) {
      // Default to first connected integration in workspace
      calendarIntegration = workspace.calendarIntegrations[0];
    }

    if (!calendarIntegration) {
      throw new Error(
        "CALENDAR_PROVIDER_UNAVAILABLE: No connected calendar integration found for this workspace."
      );
    }

    // 4. Determine Date Search Horizon
    const policy = workspace.appointmentPolicy;
    const minLeadTimeMs =
      (policy?.minimumLeadTimeMinutes ?? DEFAULT_MINIMUM_LEAD_TIME_MINUTES) * 60 * 1000;
    const maxAdvanceDays =
      policy?.maximumAdvanceDays ?? DEFAULT_MAXIMUM_ADVANCE_DAYS;

    const now = new Date();
    const minStartAllowed = new Date(now.getTime() + minLeadTimeMs);
    const maxEndAllowed = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);

    let startSearchDate = params.date
      ? new Date(`${params.date}T00:00:00Z`)
      : params.startDate
        ? new Date(`${params.startDate}T00:00:00Z`)
        : now;

    let endSearchDate = params.date
      ? new Date(`${params.date}T23:59:59Z`)
      : params.endDate
        ? new Date(`${params.endDate}T23:59:59Z`)
        : new Date(startSearchDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    // Bound max search window
    const maxHorizonMs = MAX_AVAILABILITY_SEARCH_DAYS * 24 * 60 * 60 * 1000;
    if (endSearchDate.getTime() - startSearchDate.getTime() > maxHorizonMs) {
      endSearchDate = new Date(startSearchDate.getTime() + maxHorizonMs);
    }

    // 5. Fetch Provider Free/Busy
    const provider = CalendarProviderFactory.getProvider(calendarIntegration.provider);
    const providerBusy = await provider.getAvailability({
      workspaceId,
      calendarIntegrationId: calendarIntegration.id,
      externalCalendarId: calendarIntegration.externalCalendarId,
      startDate: startSearchDate,
      endDate: endSearchDate,
      timezone,
    });

    // 6. Fetch Internal DB Appointments
    const internalAppts = await prisma.appointment.findMany({
      where: {
        workspaceId,
        calendarIntegrationId: calendarIntegration.id,
        status: { in: ["CONFIRMED", "PENDING"] },
        startAt: { lt: endSearchDate },
        endAt: { gt: startSearchDate },
      },
      select: { startAt: true, endAt: true },
    });

    // Merge busy intervals
    const busyIntervals = [
      ...providerBusy.busyRanges,
      ...internalAppts.map((a) => ({ start: a.startAt, end: a.endAt })),
    ];

    // 7. Iterate through each day in search range
    const availableSlots: ComputedSlot[] = [];
    const stepMinutes = Math.min(30, service.durationMinutes);
    const durationMs = service.durationMinutes * 60 * 1000;
    const bufferBeforeMs = (service.bufferBeforeMinutes || 0) * 60 * 1000;
    const bufferAfterMs = (service.bufferAfterMinutes || 0) * 60 * 1000;

    // Helper for date formatting in workspace timezone
    const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const dayOfWeekFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });

    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    let currentDayIter = new Date(startSearchDate);

    while (
      currentDayIter <= endSearchDate &&
      availableSlots.length < MAX_AVAILABILITY_SLOTS_RETURNED
    ) {
      const currentDayYmd = ymdFormatter.format(currentDayIter);
      const dayName = dayOfWeekFormatter.format(currentDayIter);
      const dayNumber = dayMap[dayName] ?? 1;

      // Check special hours override first
      const special = workspace.specialHours.find(
        (s) => ymdFormatter.format(s.date) === currentDayYmd
      );

      let isDayOpen = false;
      let openTimeStr = "09:00";
      let closeTimeStr = "17:00";

      if (special) {
        if (!special.closed && special.openTime && special.closeTime) {
          isDayOpen = true;
          openTimeStr = special.openTime;
          closeTimeStr = special.closeTime;
        }
      } else {
        const regularHour = workspace.businessHours.find((h) => h.dayOfWeek === dayNumber);
        if (regularHour && regularHour.enabled) {
          isDayOpen = true;
          openTimeStr = regularHour.openTime;
          closeTimeStr = regularHour.closeTime;
        }
      }

      if (isDayOpen) {
        const [openH, openM] = openTimeStr.split(":").map(Number);
        const [closeH, closeM] = closeTimeStr.split(":").map(Number);

        // Construct day start and end in UTC matching workspace local hours
        // Estimate local midnight in UTC
        const testMidnightUtc = new Date(`${currentDayYmd}T00:00:00Z`);
        const localParts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          hour12: false,
        }).formatToParts(testMidnightUtc);
        const localH = Number(localParts.find((p) => p.type === "hour")?.value || "0");
        const tzOffsetHours = (24 - localH) % 24;

        const dayOpenUtc = new Date(
          Date.UTC(
            Number(currentDayYmd.slice(0, 4)),
            Number(currentDayYmd.slice(5, 7)) - 1,
            Number(currentDayYmd.slice(8, 10)),
            openH + tzOffsetHours,
            openM
          )
        );

        const dayCloseUtc = new Date(
          Date.UTC(
            Number(currentDayYmd.slice(0, 4)),
            Number(currentDayYmd.slice(5, 7)) - 1,
            Number(currentDayYmd.slice(8, 10)),
            closeH + tzOffsetHours,
            closeM
          )
        );

        let slotCursor = new Date(dayOpenUtc);

        while (
          slotCursor.getTime() + bufferBeforeMs + durationMs + bufferAfterMs <=
            dayCloseUtc.getTime() &&
          availableSlots.length < MAX_AVAILABILITY_SLOTS_RETURNED
        ) {
          const serviceStart = new Date(slotCursor.getTime() + bufferBeforeMs);
          const serviceEnd = new Date(serviceStart.getTime() + durationMs);
          const blockEnd = new Date(serviceEnd.getTime() + bufferAfterMs);

          // Check lead time and advance limits
          if (serviceStart >= minStartAllowed && serviceEnd <= maxEndAllowed) {
            // Check conflicts with provider busy or existing appointments
            const hasConflict = busyIntervals.some(
              (busy) => serviceStart < busy.end && blockEnd > busy.start
            );

            if (!hasConflict) {
              // Check timePreference filter in workspace local time
              const hourFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                hour: "numeric",
                hour12: false,
              });
              const slotHour = Number(hourFormatter.format(serviceStart));

              let preferenceMatches = true;
              if (timePreference === "MORNING" && slotHour >= 12) {
                preferenceMatches = false;
              } else if (
                timePreference === "AFTERNOON" &&
                (slotHour < 12 || slotHour >= 17)
              ) {
                preferenceMatches = false;
              } else if (timePreference === "EVENING" && slotHour < 17) {
                preferenceMatches = false;
              }

              if (preferenceMatches) {
                const slotToken = slotTokenService.generateSlotToken({
                  workspaceId,
                  serviceId,
                  calendarIntegrationId: calendarIntegration.id,
                  startAt: serviceStart.toISOString(),
                  endAt: serviceEnd.toISOString(),
                });

                const formattedTime = new Intl.DateTimeFormat("en-US", {
                  timeZone: timezone,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(serviceStart);

                availableSlots.push({
                  slotId: slotToken,
                  startAt: serviceStart.toISOString(),
                  endAt: serviceEnd.toISOString(),
                  formattedTime,
                });
              }
            }
          }

          slotCursor = new Date(slotCursor.getTime() + stepMinutes * 60 * 1000);
        }
      }

      // Increment day by 24h
      currentDayIter = new Date(currentDayIter.getTime() + 24 * 60 * 60 * 1000);
    }

    return {
      timezone,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      slots: availableSlots,
    };
  }
}

export const availabilityService = new AvailabilityService();
