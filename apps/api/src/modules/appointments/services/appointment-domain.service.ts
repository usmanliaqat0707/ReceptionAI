import crypto from "crypto";
import {
  prisma,
  AppointmentStatus,
  AppointmentSource,
  ActorType,
  AppointmentOperationType,
  AppointmentOperationStatus,
  AppointmentChangeType,
} from "@receptionai/db";
import { CalendarProviderFactory } from "../../calendar/calendar-provider.factory";
import { slotTokenService } from "./slot-token.service";
import { CommunicationDeliveryService } from "../../communications/services/communication-delivery.service";

// In-process concurrency locks for critical scheduling sections
const slotLocks = new Map<string, Promise<void>>();

async function acquireSlotLock(lockKey: string): Promise<() => void> {
  while (slotLocks.has(lockKey)) {
    await slotLocks.get(lockKey);
  }

  let releaseLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = () => {
      slotLocks.delete(lockKey);
      resolve();
    };
  });

  slotLocks.set(lockKey, lockPromise);
  return releaseLock;
}

export interface BookAppointmentInput {
  workspaceId: string;
  contactId: string;
  serviceId: string;
  slotId: string;
  confirmationId?: string;
  receptionistId?: string;
  testSessionId?: string;
  toolExecutionId?: string;
  actorUserId?: string;
  actorType?: ActorType;
  notes?: string;
}

export interface RescheduleAppointmentInput {
  workspaceId: string;
  appointmentId: string;
  slotId: string;
  confirmationId?: string;
  testSessionId?: string;
  actorUserId?: string;
  actorType?: ActorType;
  reason?: string;
}

export interface CancelAppointmentInput {
  workspaceId: string;
  appointmentId: string;
  confirmationId?: string;
  testSessionId?: string;
  actorUserId?: string;
  actorType?: ActorType;
  reason?: string;
}

export class AppointmentDomainService {
  /**
   * Generates a deterministic SHA-256 payload hash for confirmation binding.
   */
  static computePayloadHash(payload: Record<string, any>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Books a new appointment with external provider and transactional local record.
   */
  async bookAppointment(input: BookAppointmentInput) {
    const {
      workspaceId,
      contactId,
      serviceId,
      slotId,
      confirmationId,
      receptionistId,
      testSessionId,
      actorUserId,
      actorType = ActorType.AI_RECEPTIONIST,
      notes,
    } = input;

    // 1. Verify Contact exists in workspace
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId, archivedAt: null },
    });
    if (!contact) {
      throw new Error("CONTACT_NOT_FOUND: Contact record not found in workspace.");
    }

    // 2. Verify Service exists in workspace
    const service = await prisma.service.findFirst({
      where: { id: serviceId, workspaceId, active: true, archivedAt: null },
    });
    if (!service) {
      throw new Error("SERVICE_NOT_FOUND: Service not found or is currently inactive.");
    }

    // 3. Verify Slot Token
    const slotPayload = slotTokenService.verifySlotToken(slotId);
    if (slotPayload.workspaceId !== workspaceId) {
      throw new Error("SLOT_INVALID: Slot belongs to another workspace.");
    }
    if (slotPayload.serviceId !== serviceId) {
      throw new Error("SLOT_INVALID: Slot token service does not match requested service.");
    }

    // 4. Verify Explicit Caller Confirmation (Mandatory Trust Boundary)
    const expectedPayloadHash = AppointmentDomainService.computePayloadHash({
      contactId,
      serviceId,
      slotId,
    });

    if (!confirmationId) {
      // Create pending confirmation record
      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSessionId || "test_session_manual",
          action: "appointment.book",
          target: slotId,
          payloadHash: expectedPayloadHash,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 min TTL
        },
      });

      return {
        confirmationRequired: true,
        confirmationId: conf.id,
        summary: `Appointment for ${service.name} on ${new Date(slotPayload.startAt).toLocaleString()}`,
        notice: "Explicit caller confirmation is required before booking can execute.",
      };
    }

    const conf = await prisma.conversationConfirmation.findUnique({
      where: { id: confirmationId },
    });

    if (!conf || conf.workspaceId !== workspaceId) {
      throw new Error("APPOINTMENT_CONFIRMATION_REQUIRED: Invalid confirmation ID.");
    }
    if (conf.status !== "CONFIRMED") {
      throw new Error(
        `APPOINTMENT_CONFIRMATION_REQUIRED: Confirmation status is '${conf.status}', expected 'CONFIRMED'.`
      );
    }
    if (conf.expiresAt < new Date()) {
      throw new Error("APPOINTMENT_CONFIRMATION_EXPIRED: Confirmation token has expired.");
    }
    if (conf.consumedAt) {
      throw new Error("APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation token has already been consumed (replay prevented).");
    }
    if (conf.payloadHash !== expectedPayloadHash) {
      throw new Error(
        "APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation payload hash mismatch. Actions cannot be swapped."
      );
    }

    // 5. Acquire Concurrency Lock on slot start/end
    const lockKey = `${slotPayload.calendarIntegrationId}:${slotPayload.startAt}:${slotPayload.endAt}`;
    const releaseLock = await acquireSlotLock(lockKey);

    const appointmentId = `appt_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const startAt = new Date(slotPayload.startAt);
    const endAt = new Date(slotPayload.endAt);

    try {
      // 6. Revalidate slot availability against database to prevent double-booking races
      const conflict = await prisma.appointment.findFirst({
        where: {
          workspaceId,
          calendarIntegrationId: slotPayload.calendarIntegrationId,
          status: { in: ["CONFIRMED", "PENDING"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });

      if (conflict) {
        throw new Error("SLOT_NO_LONGER_AVAILABLE: Slot was booked by another caller.");
      }

      // 7. Load Calendar Integration
      const integration = await prisma.calendarIntegration.findUnique({
        where: { id: slotPayload.calendarIntegrationId },
      });
      if (!integration || integration.status === "DISCONNECTED") {
        throw new Error("CALENDAR_PROVIDER_UNAVAILABLE: Calendar integration is not active.");
      }

      // 8. Create Appointment Operation Tracker (Saga)
      const idempotencyKey = input.toolExecutionId || `book_${appointmentId}`;
      const operation = await prisma.appointmentOperation.create({
        data: {
          workspaceId,
          testSessionId,
          toolExecutionId: input.toolExecutionId,
          type: AppointmentOperationType.CREATE,
          status: AppointmentOperationStatus.PENDING_PROVIDER,
          appointmentId,
          idempotencyKey,
        },
      });

      // 9. Invoke External Calendar Provider
      const provider = CalendarProviderFactory.getProvider(integration.provider);
      const contactFullName = `${contact.firstName} ${contact.lastName || ""}`.trim();

      const externalResult = await provider.createAppointment({
        workspaceId,
        calendarIntegrationId: integration.id,
        externalCalendarId: integration.externalCalendarId,
        title: `${service.name} — ${contactFullName}`,
        startAt,
        endAt,
        timezone: "America/New_York",
        notes,
        contactName: contactFullName,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        serviceName: service.name,
        appointmentId,
      });

      await prisma.appointmentOperation.update({
        where: { id: operation.id },
        data: {
          status: AppointmentOperationStatus.PROVIDER_SUCCEEDED,
          externalEventId: externalResult.externalEventId,
        },
      });

      // 10. Persist Local Appointment & Consume Confirmation Transactionally
      try {
        const appointment = await prisma.$transaction(async (tx) => {
          const appt = await tx.appointment.create({
            data: {
              id: appointmentId,
              workspaceId,
              contactId: contact.id,
              serviceId: service.id,
              calendarIntegrationId: integration.id,
              receptionistId,
              testSessionId,
              externalCalendarId: externalResult.externalCalendarId || integration.externalCalendarId,
              externalEventId: externalResult.externalEventId,
              startAt,
              endAt,
              timezone: "America/New_York",
              status: AppointmentStatus.CONFIRMED,
              title: `${service.name} — ${contactFullName}`,
              notes,
              source:
                actorType === ActorType.USER
                  ? AppointmentSource.MANUAL
                  : AppointmentSource.VOICE_RECEPTIONIST,
              createdByActorType: actorType,
              createdByUserId: actorUserId,
            },
            include: {
              contact: true,
              service: true,
              calendarIntegration: true,
            },
          });

          // Record change history
          await tx.appointmentChange.create({
            data: {
              workspaceId,
              appointmentId: appt.id,
              type: AppointmentChangeType.CREATED,
              newStartAt: startAt,
              newEndAt: endAt,
              actorType,
              testSessionId,
              userId: actorUserId,
              notes: "Initial appointment booking.",
            },
          });

          // Atomically consume confirmation token
          await tx.conversationConfirmation.update({
            where: { id: conf.id },
            data: {
              status: "CONSUMED",
              consumedAt: new Date(),
            },
          });

          await tx.appointmentOperation.update({
            where: { id: operation.id },
            data: { status: AppointmentOperationStatus.LOCAL_SUCCEEDED },
          });

          return appt;
        });

        // Enqueue confirmation communications asynchronously into outbox
        try {
          const appointmentDateFormatted = new Intl.DateTimeFormat("en-US", {
            timeZone: appointment.timezone || "America/New_York",
            weekday: "short",
            month: "short",
            day: "numeric",
          }).format(new Date(appointment.startAt));

          const appointmentTimeFormatted = new Intl.DateTimeFormat("en-US", {
            timeZone: appointment.timezone || "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(appointment.startAt));

          const variables = {
            customer_first_name: appointment.contact?.firstName || contact.firstName,
            service_name: appointment.service?.name || service.name,
            appointment_date: appointmentDateFormatted,
            appointment_time: appointmentTimeFormatted,
            timezone: appointment.timezone || "America/New_York",
          };

          if (contact.phone || contact.normalizedPhone) {
            await CommunicationDeliveryService.enqueue({
              workspaceId,
              channel: "SMS",
              purpose: "APPOINTMENT_CONFIRMATION",
              contactId: contact.id,
              sourceType: "APPOINTMENT",
              sourceId: appointment.id,
              appointmentId: appointment.id,
              receptionistId,
              testSessionId,
              idempotencyKey: `appointment-confirmation:${appointment.id}:${appointment.version || 1}:sms`,
              variables,
            }).catch((e: any) => console.warn("SMS confirmation enqueue failed:", e.message));
          }

          if (contact.email || contact.normalizedEmail) {
            await CommunicationDeliveryService.enqueue({
              workspaceId,
              channel: "EMAIL",
              purpose: "APPOINTMENT_CONFIRMATION",
              contactId: contact.id,
              sourceType: "APPOINTMENT",
              sourceId: appointment.id,
              appointmentId: appointment.id,
              receptionistId,
              testSessionId,
              idempotencyKey: `appointment-confirmation:${appointment.id}:${appointment.version || 1}:email`,
              variables,
            }).catch((e: any) => console.warn("Email confirmation enqueue failed:", e.message));
          }

          if (process.env.NODE_ENV === "test") {
            await CommunicationDeliveryService.processOutbox(workspaceId).catch(() => {});
          }
        } catch (commErr: any) {
          console.warn("Non-fatal communication enqueue error:", commErr.message);
        }

        return {
          confirmationRequired: false,
          appointment,
        };
      } catch (dbErr: any) {
        // External provider succeeded but local DB failed: compensation required
        await prisma.appointmentOperation.update({
          where: { id: operation.id },
          data: {
            status: AppointmentOperationStatus.COMPENSATION_REQUIRED,
            errorMessageSafe: dbErr.message,
          },
        });
        throw dbErr;
      }
    } finally {
      releaseLock();
    }
  }

  /**
   * Reschedules an existing appointment to a new slot.
   */
  async rescheduleAppointment(input: RescheduleAppointmentInput) {
    const {
      workspaceId,
      appointmentId,
      slotId,
      confirmationId,
      testSessionId,
      actorUserId,
      actorType = ActorType.AI_RECEPTIONIST,
      reason,
    } = input;

    // 1. Fetch Existing Appointment
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, workspaceId },
      include: { service: true, calendarIntegration: true, contact: true },
    });

    if (!appt) {
      throw new Error("APPOINTMENT_NOT_FOUND: Appointment not found.");
    }
    if (appt.status === AppointmentStatus.CANCELLED) {
      throw new Error("APPOINTMENT_ALREADY_CANCELLED: Cannot reschedule a cancelled appointment.");
    }

    // 2. Verify Slot Token
    const slotPayload = slotTokenService.verifySlotToken(slotId);
    if (slotPayload.workspaceId !== workspaceId) {
      throw new Error("SLOT_INVALID: Slot belongs to another workspace.");
    }

    // 3. Verify Explicit Confirmation
    const expectedPayloadHash = AppointmentDomainService.computePayloadHash({
      appointmentId,
      slotId,
    });

    if (!confirmationId) {
      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSessionId || "test_session_manual",
          action: "appointment.reschedule",
          target: appointmentId,
          payloadHash: expectedPayloadHash,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 3 * 60 * 1000),
        },
      });

      return {
        confirmationRequired: true,
        confirmationId: conf.id,
        summary: `Reschedule ${appt.title} to ${new Date(slotPayload.startAt).toLocaleString()}`,
        notice: "Explicit caller confirmation is required before rescheduling.",
      };
    }

    const conf = await prisma.conversationConfirmation.findUnique({
      where: { id: confirmationId },
    });

    if (!conf || conf.workspaceId !== workspaceId || conf.status !== "CONFIRMED") {
      throw new Error("APPOINTMENT_CONFIRMATION_REQUIRED: Invalid or unconfirmed confirmation ID.");
    }
    if (conf.expiresAt < new Date()) {
      throw new Error("APPOINTMENT_CONFIRMATION_EXPIRED: Confirmation token expired.");
    }
    if (conf.consumedAt) {
      throw new Error("APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation token already consumed.");
    }
    if (conf.payloadHash !== expectedPayloadHash) {
      throw new Error("APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation payload mismatch.");
    }

    // 4. Concurrency lock
    const lockKey = `${slotPayload.calendarIntegrationId}:${slotPayload.startAt}:${slotPayload.endAt}`;
    const releaseLock = await acquireSlotLock(lockKey);

    const newStartAt = new Date(slotPayload.startAt);
    const newEndAt = new Date(slotPayload.endAt);

    try {
      const conflict = await prisma.appointment.findFirst({
        where: {
          workspaceId,
          calendarIntegrationId: slotPayload.calendarIntegrationId,
          status: { in: ["CONFIRMED", "PENDING"] },
          id: { not: appointmentId },
          startAt: { lt: newEndAt },
          endAt: { gt: newStartAt },
        },
      });

      if (conflict) {
        throw new Error("SLOT_NO_LONGER_AVAILABLE: Slot was booked by another caller.");
      }

      // 5. Update External Provider Event if external event exists
      if (appt.calendarIntegration && appt.externalEventId) {
        const provider = CalendarProviderFactory.getProvider(appt.calendarIntegration.provider);
        await provider.updateAppointment({
          workspaceId,
          calendarIntegrationId: appt.calendarIntegrationId,
          externalCalendarId: appt.externalCalendarId,
          externalEventId: appt.externalEventId,
          startAt: newStartAt,
          endAt: newEndAt,
          timezone: appt.timezone,
        });
      }

      // 6. Update Local Appointment & Consume Token
      const updated = await prisma.$transaction(async (tx) => {
        const updatedAppt = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            startAt: newStartAt,
            endAt: newEndAt,
            status: AppointmentStatus.RESCHEDULED,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          include: { contact: true, service: true, calendarIntegration: true },
        });

        await tx.appointmentChange.create({
          data: {
            workspaceId,
            appointmentId,
            type: AppointmentChangeType.RESCHEDULED,
            oldStartAt: appt.startAt,
            oldEndAt: appt.endAt,
            newStartAt,
            newEndAt,
            actorType,
            testSessionId,
            userId: actorUserId,
            notes: reason || "Appointment rescheduled.",
          },
        });

        await tx.conversationConfirmation.update({
          where: { id: conf.id },
          data: { status: "CONSUMED", consumedAt: new Date() },
        });

        return updatedAppt;
      });

      // Enqueue reschedule communications asynchronously
      try {
        const appointmentDateFormatted = new Intl.DateTimeFormat("en-US", {
          timeZone: updated.timezone || "America/New_York",
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(new Date(updated.startAt));

        const appointmentTimeFormatted = new Intl.DateTimeFormat("en-US", {
          timeZone: updated.timezone || "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(updated.startAt));

        const variables = {
          customer_first_name: updated.contact?.firstName || "Valued Customer",
          service_name: updated.service?.name || "Appointment",
          appointment_date: appointmentDateFormatted,
          appointment_time: appointmentTimeFormatted,
          timezone: updated.timezone || "America/New_York",
        };

        if (updated.contact?.phone || updated.contact?.normalizedPhone) {
          await CommunicationDeliveryService.enqueue({
            workspaceId,
            channel: "SMS",
            purpose: "APPOINTMENT_RESCHEDULE",
            contactId: updated.contact.id,
            sourceType: "APPOINTMENT",
            sourceId: updated.id,
            appointmentId: updated.id,
            testSessionId,
            idempotencyKey: `appointment-reschedule:${updated.id}:${updated.version}:sms`,
            variables,
          }).catch((e: any) => console.warn("SMS reschedule enqueue failed:", e.message));
        }

        if (updated.contact?.email || updated.contact?.normalizedEmail) {
          await CommunicationDeliveryService.enqueue({
            workspaceId,
            channel: "EMAIL",
            purpose: "APPOINTMENT_RESCHEDULE",
            contactId: updated.contact.id,
            sourceType: "APPOINTMENT",
            sourceId: updated.id,
            appointmentId: updated.id,
            testSessionId,
            idempotencyKey: `appointment-reschedule:${updated.id}:${updated.version}:email`,
            variables,
          }).catch((e: any) => console.warn("Email reschedule enqueue failed:", e.message));
        }

        if (process.env.NODE_ENV === "test") {
          await CommunicationDeliveryService.processOutbox(workspaceId).catch(() => {});
        }
      } catch (commErr: any) {
        console.warn("Non-fatal communication enqueue error on reschedule:", commErr.message);
      }

      return {
        confirmationRequired: false,
        appointment: updated,
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Cancels an existing appointment.
   */
  async cancelAppointment(input: CancelAppointmentInput) {
    const {
      workspaceId,
      appointmentId,
      confirmationId,
      testSessionId,
      actorUserId,
      actorType = ActorType.AI_RECEPTIONIST,
      reason,
    } = input;

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, workspaceId },
      include: { service: true, calendarIntegration: true },
    });

    if (!appt) {
      throw new Error("APPOINTMENT_NOT_FOUND: Appointment not found.");
    }

    // Idempotent cancellation: if already cancelled, return existing state safely
    if (appt.status === AppointmentStatus.CANCELLED) {
      return {
        confirmationRequired: false,
        appointment: appt,
        alreadyCancelled: true,
      };
    }

    const expectedPayloadHash = AppointmentDomainService.computePayloadHash({
      appointmentId,
    });

    if (!confirmationId) {
      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSessionId || "test_session_manual",
          action: "appointment.cancel",
          target: appointmentId,
          payloadHash: expectedPayloadHash,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 3 * 60 * 1000),
        },
      });

      return {
        confirmationRequired: true,
        confirmationId: conf.id,
        summary: `Cancel ${appt.title} on ${appt.startAt.toLocaleString()}`,
        notice: "Explicit caller confirmation is required before cancellation.",
      };
    }

    const conf = await prisma.conversationConfirmation.findUnique({
      where: { id: confirmationId },
    });

    if (!conf || conf.workspaceId !== workspaceId || conf.status !== "CONFIRMED") {
      throw new Error("APPOINTMENT_CONFIRMATION_REQUIRED: Invalid or unconfirmed confirmation ID.");
    }
    if (conf.expiresAt < new Date()) {
      throw new Error("APPOINTMENT_CONFIRMATION_EXPIRED: Confirmation token expired.");
    }
    if (conf.consumedAt) {
      throw new Error("APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation token already consumed.");
    }
    if (conf.payloadHash !== expectedPayloadHash) {
      throw new Error("APPOINTMENT_CONFIRMATION_MISMATCH: Confirmation payload mismatch.");
    }

    // Cancel on external calendar provider
    if (appt.calendarIntegration && appt.externalEventId) {
      const provider = CalendarProviderFactory.getProvider(appt.calendarIntegration.provider);
      await provider.cancelAppointment({
        workspaceId,
        calendarIntegrationId: appt.calendarIntegrationId,
        externalCalendarId: appt.externalCalendarId,
        externalEventId: appt.externalEventId,
        reason,
      });
    }

    // Update local state and record history
    const cancelled = await prisma.$transaction(async (tx) => {
      const updatedAppt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
        include: { contact: true, service: true, calendarIntegration: true },
      });

      await tx.appointmentChange.create({
        data: {
          workspaceId,
          appointmentId,
          type: AppointmentChangeType.CANCELLED,
          oldStartAt: appt.startAt,
          oldEndAt: appt.endAt,
          actorType,
          testSessionId,
          userId: actorUserId,
          notes: reason || "Appointment cancelled.",
        },
      });

      await tx.conversationConfirmation.update({
        where: { id: conf.id },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });

      return updatedAppt;
    });

    // Enqueue cancellation communications asynchronously
    try {
      const appointmentDateFormatted = new Intl.DateTimeFormat("en-US", {
        timeZone: cancelled.timezone || "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(cancelled.startAt));

      const appointmentTimeFormatted = new Intl.DateTimeFormat("en-US", {
        timeZone: cancelled.timezone || "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(cancelled.startAt));

      const variables = {
        customer_first_name: cancelled.contact?.firstName || "Valued Customer",
        service_name: cancelled.service?.name || "Appointment",
        appointment_date: appointmentDateFormatted,
        appointment_time: appointmentTimeFormatted,
        timezone: cancelled.timezone || "America/New_York",
      };

      if (cancelled.contact?.phone || cancelled.contact?.normalizedPhone) {
        await CommunicationDeliveryService.enqueue({
          workspaceId,
          channel: "SMS",
          purpose: "APPOINTMENT_CANCELLATION",
          contactId: cancelled.contact.id,
          sourceType: "APPOINTMENT",
          sourceId: cancelled.id,
          appointmentId: cancelled.id,
          testSessionId,
          idempotencyKey: `appointment-cancellation:${cancelled.id}:${cancelled.version}:sms`,
          variables,
        }).catch((e: any) => console.warn("SMS cancellation enqueue failed:", e.message));
      }

      if (cancelled.contact?.email || cancelled.contact?.normalizedEmail) {
        await CommunicationDeliveryService.enqueue({
          workspaceId,
          channel: "EMAIL",
          purpose: "APPOINTMENT_CANCELLATION",
          contactId: cancelled.contact.id,
          sourceType: "APPOINTMENT",
          sourceId: cancelled.id,
          appointmentId: cancelled.id,
          testSessionId,
          idempotencyKey: `appointment-cancellation:${cancelled.id}:${cancelled.version}:email`,
          variables,
        }).catch((e: any) => console.warn("Email cancellation enqueue failed:", e.message));
      }

      if (process.env.NODE_ENV === "test") {
        await CommunicationDeliveryService.processOutbox(workspaceId).catch(() => {});
      }
    } catch (commErr: any) {
      console.warn("Non-fatal communication enqueue error on cancel:", commErr.message);
    }

    return {
      confirmationRequired: false,
      appointment: cancelled,
    };
  }

  /**
   * Safe lookup for appointments by ID or contact.
   */
  async getAppointment(workspaceId: string, appointmentId: string, contactId?: string) {
    const where: any = { id: appointmentId, workspaceId };
    if (contactId) {
      where.contactId = contactId;
    }

    const appt = await prisma.appointment.findFirst({
      where,
      include: {
        contact: true,
        service: true,
        calendarIntegration: true,
        changes: { orderBy: { createdAt: "desc" } },
        communications: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!appt) {
      throw new Error("APPOINTMENT_NOT_FOUND: Appointment not found.");
    }

    return appt;
  }
}

export const appointmentDomainService = new AppointmentDomainService();
