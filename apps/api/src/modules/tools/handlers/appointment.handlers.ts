import { prisma } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  findServiceToolSchema,
  FindServiceToolInput,
  checkAvailabilityToolSchema,
  CheckAvailabilityToolInput,
  getAppointmentToolSchema,
  GetAppointmentToolInput,
  bookAppointmentToolSchema,
  BookAppointmentToolInput,
  rescheduleAppointmentToolSchema,
  RescheduleAppointmentToolInput,
  cancelAppointmentToolSchema,
  CancelAppointmentToolInput,
} from "@receptionai/validation";
import { availabilityService } from "../../appointments/services/availability.service";
import { appointmentDomainService } from "../../appointments/services/appointment-domain.service";

// 1. find_service
export const findServiceTool: ToolDefinition<FindServiceToolInput> = {
  name: "find_service",
  description:
    "Find active bookable services and their durations/prices for this business. Use when caller asks what services are offered or wants to schedule an appointment.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "READ",
  requiresIdempotency: false,
  requiresConfirmation: false,
  inputSchema: findServiceToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: FindServiceToolInput
  ): Promise<NormalizedToolResult> {
    const services = await prisma.service.findMany({
      where: {
        workspaceId: context.workspaceId,
        active: true,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceText: true,
      },
      orderBy: { name: "asc" },
    });

    let matched = services;
    if (input.query) {
      const q = input.query.toLowerCase().trim();
      matched = services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q))
      );
    }

    return {
      success: true,
      data: {
        totalFound: matched.length,
        services: matched,
      },
    };
  },
};

// 2. check_availability
export const checkAvailabilityTool: ToolDefinition<CheckAvailabilityToolInput> = {
  name: "check_availability",
  description:
    "Check available appointment slots for a specific service. Returns server-authenticated slotIds. Always present options to caller before booking.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "READ",
  requiresIdempotency: false,
  requiresConfirmation: false,
  inputSchema: checkAvailabilityToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: CheckAvailabilityToolInput
  ): Promise<NormalizedToolResult> {
    try {
      const result = await availabilityService.getAvailability({
        workspaceId: context.workspaceId,
        serviceId: input.serviceId,
        date: input.date,
        startDate: input.startDate,
        endDate: input.endDate,
        timePreference: input.timePreference,
      });

      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "AVAILABILITY_ERROR",
          message: err.message || "Failed to check calendar availability.",
        },
      };
    }
  },
};

// 3. get_appointment
export const getAppointmentTool: ToolDefinition<GetAppointmentToolInput> = {
  name: "get_appointment",
  description:
    "Retrieve details and status for an existing appointment. Use when caller asks to look up, verify, or discuss their appointment.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "READ",
  requiresIdempotency: false,
  requiresConfirmation: false,
  inputSchema: getAppointmentToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: GetAppointmentToolInput
  ): Promise<NormalizedToolResult> {
    try {
      const appt = await appointmentDomainService.getAppointment(
        context.workspaceId,
        input.appointmentId,
        input.contactId
      );

      return {
        success: true,
        data: {
          id: appt.id,
          title: appt.title,
          status: appt.status,
          startAt: appt.startAt.toISOString(),
          endAt: appt.endAt.toISOString(),
          timezone: appt.timezone,
          serviceName: appt.service?.name,
          contactName: `${appt.contact?.firstName} ${appt.contact?.lastName || ""}`.trim(),
          contactPhone: appt.contact?.phone,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "APPOINTMENT_NOT_FOUND",
          message: err.message || "Appointment not found.",
        },
      };
    }
  },
};

// 4. book_appointment
export const bookAppointmentTool: ToolDefinition<BookAppointmentToolInput> = {
  name: "book_appointment",
  description:
    "Book an appointment for a caller. Requires server-issued confirmationId with caller confirmation.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: true,
  inputSchema: bookAppointmentToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: BookAppointmentToolInput
  ): Promise<NormalizedToolResult> {
    try {
      const res = await appointmentDomainService.bookAppointment({
        workspaceId: context.workspaceId,
        contactId: input.contactId,
        serviceId: input.serviceId,
        slotId: input.slotId,
        confirmationId: input.confirmationId,
        testSessionId: context.testSessionId,
        toolExecutionId: context.toolCallId,
        receptionistId: context.receptionistId,
      });

      if (res.confirmationRequired) {
        return {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: `Booking requires explicit caller confirmation. Confirmation ID: ${res.confirmationId}. Ask caller: "${res.summary}". After caller confirms, call book_appointment again with confirmationId.`,
            details: {
              confirmationId: res.confirmationId,
              summary: res.summary,
            },
          },
        };
      }

      const appt = res.appointment!;
      return {
        success: true,
        data: {
          appointmentId: appt.id,
          title: appt.title,
          startAt: appt.startAt.toISOString(),
          endAt: appt.endAt.toISOString(),
          status: appt.status,
          message: "Appointment booked successfully.",
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: err.message?.startsWith("SLOT_NO_LONGER_AVAILABLE")
            ? "SLOT_NO_LONGER_AVAILABLE"
            : "BOOKING_FAILED",
          message: err.message || "Failed to book appointment.",
        },
      };
    }
  },
};

// 5. reschedule_appointment
export const rescheduleAppointmentTool: ToolDefinition<RescheduleAppointmentToolInput> = {
  name: "reschedule_appointment",
  description:
    "Reschedule an existing appointment to a new slotId. Requires server-issued confirmationId with caller confirmation.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: true,
  inputSchema: rescheduleAppointmentToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: RescheduleAppointmentToolInput
  ): Promise<NormalizedToolResult> {
    try {
      const res = await appointmentDomainService.rescheduleAppointment({
        workspaceId: context.workspaceId,
        appointmentId: input.appointmentId,
        slotId: input.slotId,
        confirmationId: input.confirmationId,
        testSessionId: context.testSessionId,
      });

      if (res.confirmationRequired) {
        return {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: `Rescheduling requires explicit caller confirmation. Confirmation ID: ${res.confirmationId}. Ask caller: "${res.summary}". After caller confirms, call reschedule_appointment again with confirmationId.`,
            details: {
              confirmationId: res.confirmationId,
              summary: res.summary,
            },
          },
        };
      }

      const appt = res.appointment!;
      return {
        success: true,
        data: {
          appointmentId: appt.id,
          title: appt.title,
          startAt: appt.startAt.toISOString(),
          endAt: appt.endAt.toISOString(),
          status: appt.status,
          message: "Appointment rescheduled successfully.",
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: err.message?.startsWith("SLOT_NO_LONGER_AVAILABLE")
            ? "SLOT_NO_LONGER_AVAILABLE"
            : "RESCHEDULE_FAILED",
          message: err.message || "Failed to reschedule appointment.",
        },
      };
    }
  },
};

// 6. cancel_appointment
export const cancelAppointmentTool: ToolDefinition<CancelAppointmentToolInput> = {
  name: "cancel_appointment",
  description:
    "Cancel an existing appointment. Requires server-issued confirmationId with caller confirmation.",
  capability: "SCHEDULE_APPOINTMENTS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: true,
  inputSchema: cancelAppointmentToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: CancelAppointmentToolInput
  ): Promise<NormalizedToolResult> {
    try {
      const res = await appointmentDomainService.cancelAppointment({
        workspaceId: context.workspaceId,
        appointmentId: input.appointmentId,
        reason: input.reason,
        confirmationId: input.confirmationId,
        testSessionId: context.testSessionId,
      });

      if (res.confirmationRequired) {
        return {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: `Cancellation requires explicit caller confirmation. Confirmation ID: ${res.confirmationId}. Ask caller: "${res.summary}". After caller confirms, call cancel_appointment again with confirmationId.`,
            details: {
              confirmationId: res.confirmationId,
              summary: res.summary,
            },
          },
        };
      }

      const appt = res.appointment!;
      return {
        success: true,
        data: {
          appointmentId: appt.id,
          title: appt.title,
          status: appt.status,
          alreadyCancelled: (res as any).alreadyCancelled || false,
          message: "Appointment cancelled successfully.",
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "CANCEL_FAILED",
          message: err.message || "Failed to cancel appointment.",
        },
      };
    }
  },
};
