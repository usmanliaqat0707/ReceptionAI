import { prisma } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  getBusinessHoursToolSchema,
  GetBusinessHoursToolInput,
} from "@receptionai/validation";

export const getBusinessHoursTool: ToolDefinition<GetBusinessHoursToolInput> = {
  name: "get_business_hours",
  description:
    "Retrieve authoritative operating schedule and open/closed status for today or a specific date. Use when caller asks if the business is open or what hours the office operates.",
  capability: "ANSWER_QUESTIONS",
  sideEffect: "NONE",
  requiresIdempotency: false,
  requiresConfirmation: false,
  inputSchema: getBusinessHoursToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: GetBusinessHoursToolInput
  ): Promise<NormalizedToolResult> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      include: {
        businessHours: true,
        specialHours: true,
      },
    });

    if (!workspace) {
      return {
        success: false,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace could not be found.",
        },
      };
    }

    const timezone = workspace.timezone || "America/New_York";
    let targetDate = new Date();

    if (input.date) {
      const parsed = new Date(`${input.date}T12:00:00Z`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    // Determine target day of week in workspace timezone
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
    const dayName = dayOfWeekFormatter.format(targetDate);
    const dayNumber = dayMap[dayName] ?? 1;

    // Check special hours override first
    const dateStrFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const formattedDate = dateStrFormatter.format(targetDate); // YYYY-MM-DD

    const specialMatch = workspace.specialHours.find(
      (s) => s.date.toISOString().slice(0, 10) === formattedDate
    );

    if (specialMatch) {
      return {
        success: true,
        data: {
          timezone,
          date: formattedDate,
          day: dayName,
          status: specialMatch.closed ? "CLOSED" : "OPEN",
          openTime: specialMatch.openTime || null,
          closeTime: specialMatch.closeTime || null,
          description: specialMatch.note || "Special holiday/custom schedule",
          specialHoursApplied: true,
        },
      };
    }

    const hourMatch = workspace.businessHours.find((h) => h.dayOfWeek === dayNumber);

    if (!hourMatch || !hourMatch.enabled) {
      return {
        success: true,
        data: {
          timezone,
          date: formattedDate,
          day: dayName,
          status: "CLOSED",
          openTime: null,
          closeTime: null,
          specialHoursApplied: false,
        },
      };
    }

    return {
      success: true,
      data: {
        timezone,
        date: formattedDate,
        day: dayName,
        status: "OPEN",
        openTime: hourMatch.openTime,
        closeTime: hourMatch.closeTime,
        specialHoursApplied: false,
      },
    };
  },
};
