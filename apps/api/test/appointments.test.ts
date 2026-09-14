import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildApp } from "../src/app";
import {
  prisma,
  WorkspaceRole,
  RealtimeTestSessionStatus,
  CalendarProviderType,
  CalendarIntegrationStatus,
  AppointmentStatus,
  ActorType,
} from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { ToolGatewayService } from "../src/modules/tools/services/tool-gateway.service";
import { slotTokenService } from "../src/modules/appointments/services/slot-token.service";
import { availabilityService } from "../src/modules/appointments/services/availability.service";
import { appointmentDomainService } from "../src/modules/appointments/services/appointment-domain.service";
import { CalendarProviderFactory } from "../src/modules/calendar/calendar-provider.factory";
import { CalendarProvider } from "../src/modules/calendar/calendar.interface";

describe("Phase 6 Calendar & Appointment Domain Tests", () => {
  const app = buildApp();

  let workspaceId: string;
  let ownerCookie: string;
  let ownerUser: any;
  let testSession: any;
  let receptionist: any;
  let integration: any;
  let service: any;
  let contact: any;

  beforeAll(async () => {
    // 1. Clean DB
    await prisma.appointmentChange.deleteMany();
    await prisma.appointmentOperation.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.conversationConfirmation.deleteMany();
    await prisma.receptionistToolExecution.deleteMany();
    await prisma.service.deleteMany();
    await prisma.calendarIntegration.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.realtimeTestSession.deleteMany();
    await prisma.receptionist.deleteMany();
    await prisma.workspaceMembership.deleteMany();
    await prisma.businessHour.deleteMany();
    await prisma.appointmentPolicy.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await hashPassword("password123");

    // 2. Create Workspace
    const ws = await prisma.workspace.create({
      data: {
        name: "Metro Dental Clinic",
        slug: "metro-dental",
        timezone: "America/New_York",
        industry: "Dental",
      },
    });
    workspaceId = ws.id;

    // 3. Create Operating Hours (Mon-Fri 09:00 - 17:00)
    for (let day = 0; day <= 6; day++) {
      await prisma.businessHour.create({
        data: {
          workspaceId,
          dayOfWeek: day,
          openTime: "09:00",
          closeTime: "17:00",
          enabled: day >= 1 && day <= 5, // Mon-Fri
        },
      });
    }

    // 4. Create Owner User
    ownerUser = await prisma.user.create({
      data: {
        email: "doctor@metrodental.local",
        passwordHash,
        name: "Dr. Sarah Smith",
      },
    });

    await prisma.workspaceMembership.create({
      data: {
        workspaceId,
        userId: ownerUser.id,
        role: WorkspaceRole.OWNER,
      },
    });

    const sessionToken = generateSecureToken();
    await prisma.session.create({
      data: {
        userId: ownerUser.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    ownerCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;

    // 5. Create Calendar Integration (Internal Demo)
    integration = await prisma.calendarIntegration.create({
      data: {
        workspaceId,
        provider: CalendarProviderType.INTERNAL_DEMO,
        name: "Metro Demo Calendar",
        status: CalendarIntegrationStatus.CONNECTED,
        externalCalendarId: "primary_demo_calendar",
        createdByUserId: ownerUser.id,
      },
    });

    // 6. Create Service
    service = await prisma.service.create({
      data: {
        workspaceId,
        name: "Routine Dental Cleaning",
        description: "Standard hygiene teeth cleaning and inspection",
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 10,
        priceText: "$120",
        active: true,
        calendarIntegrationId: integration.id,
      },
    });

    // 7. Create Contact
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        firstName: "Michael",
        lastName: "Johnson",
        phone: "+15555550199",
        normalizedPhone: "+15555550199",
        email: "michael@example.com",
      },
    });

    // 8. Create AI Receptionist with SCHEDULE_APPOINTMENTS objective
    receptionist = await prisma.receptionist.create({
      data: {
        workspaceId,
        name: "Ava",
        slug: "ava-metro",
        roleTitle: "Dental Office Receptionist",
        industry: "Dental",
        greeting: "Hello, thank you for calling Metro Dental. How can I assist you?",
        objectiveConfig: {
          objectives: ["SCHEDULE_APPOINTMENTS", "ANSWER_QUESTIONS"],
        },
        createdByUserId: ownerUser.id,
      },
    });

    // 9. Create Realtime Test Session
    testSession = await prisma.realtimeTestSession.create({
      data: {
        workspaceId,
        receptionistId: receptionist.id,
        status: RealtimeTestSessionStatus.CONNECTED,
        configurationVersion: 1,
        createdByUserId: ownerUser.id,
      },
    });
  });

  describe("1. Authoritative Availability & Slot Tokens", () => {
    it("computes authoritative discrete availability slots and signs opaque tokens", async () => {
      const result = await availabilityService.getAvailability({
        workspaceId,
        serviceId: service.id,
        date: "2026-10-15", // A future date
      });

      expect(result.timezone).toBe("America/New_York");
      expect(result.serviceName).toBe("Routine Dental Cleaning");
      expect(result.durationMinutes).toBe(30);
      expect(result.slots.length).toBeGreaterThan(0);

      const firstSlot = result.slots[0];
      expect(firstSlot.slotId).toMatch(/^slot_/);
      expect(firstSlot.formattedTime).toBeDefined();

      // Verify token decrypts properly
      const decoded = slotTokenService.verifySlotToken(firstSlot.slotId);
      expect(decoded.workspaceId).toBe(workspaceId);
      expect(decoded.serviceId).toBe(service.id);
      expect(decoded.calendarIntegrationId).toBe(integration.id);
    });

    it("rejects tampered slot tokens", () => {
      const validToken = slotTokenService.generateSlotToken({
        workspaceId,
        serviceId: service.id,
        calendarIntegrationId: integration.id,
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
      });

      const tamperedToken = validToken.slice(0, -4) + "XXXX";
      expect(() => slotTokenService.verifySlotToken(tamperedToken)).toThrow(
        /SLOT_INVALID/
      );
    });

    it("rejects expired slot tokens", () => {
      const expiredToken = slotTokenService.generateSlotToken(
        {
          workspaceId,
          serviceId: service.id,
          calendarIntegrationId: integration.id,
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
        },
        -1 // Expired 1 minute ago
      );

      expect(() => slotTokenService.verifySlotToken(expiredToken)).toThrow(
        /SLOT_EXPIRED/
      );
    });
  });

  describe("2. Confirmation Security Model & Replay Prevention", () => {
    let slotId: string;

    beforeAll(async () => {
      const res = await availabilityService.getAvailability({
        workspaceId,
        serviceId: service.id,
        date: "2026-10-20",
      });
      slotId = res.slots[0].slotId;
    });

    it("returns CONFIRMATION_REQUIRED when tool is called without confirmationId", async () => {
      const gatewayRes = await ToolGatewayService.execute({
        sessionId: testSession.id,
        toolCallId: "call_test_1",
        toolName: "book_appointment",
        arguments: {
          contactId: contact.id,
          serviceId: service.id,
          slotId,
        },
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(gatewayRes.success).toBe(false);
      if (!gatewayRes.success) {
        expect(gatewayRes.error.code).toBe("CONFIRMATION_REQUIRED");
        expect(gatewayRes.error.details?.confirmationId).toBeDefined();
        expect(gatewayRes.error.details?.summary).toContain("Routine Dental Cleaning");
      }
    });

    it("rejects model-asserted callerConfirmed: true when confirmationId is omitted", async () => {
      const gatewayRes = await ToolGatewayService.execute({
        sessionId: testSession.id,
        toolCallId: "call_test_2",
        toolName: "book_appointment",
        arguments: {
          contactId: contact.id,
          serviceId: service.id,
          slotId,
          callerConfirmed: true, // Model attempts self-certification
        },
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(gatewayRes.success).toBe(false);
      if (!gatewayRes.success) {
        expect(gatewayRes.error.code).toBe("MODEL_CONFIRMATION_REJECTED");
      }
    });

    it("rejects booking if confirmation payload hash does not match (payload swapping attack)", async () => {
      // Generate confirmation for Slot A
      const confRes = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: contact.id,
        serviceId: service.id,
        slotId,
        testSessionId: testSession.id,
      });

      const confId = confRes.confirmationId!;
      // Mark confirmed
      await prisma.conversationConfirmation.update({
        where: { id: confId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      // Generate a DIFFERENT slot B
      const diffSlotId = slotTokenService.generateSlotToken({
        workspaceId,
        serviceId: service.id,
        calendarIntegrationId: integration.id,
        startAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 48.5 * 60 * 60 * 1000).toISOString(),
      });

      // Attempt to use confirmation for Slot A on Slot B
      await expect(
        appointmentDomainService.bookAppointment({
          workspaceId,
          contactId: contact.id,
          serviceId: service.id,
          slotId: diffSlotId,
          confirmationId: confId,
          testSessionId: testSession.id,
        })
      ).rejects.toThrow(/APPOINTMENT_CONFIRMATION_MISMATCH/);
    });

    it("successfully executes booking with valid confirmation and consumes token (replay prevention)", async () => {
      // 1. Initiate confirmation
      const confRes = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: contact.id,
        serviceId: service.id,
        slotId,
        testSessionId: testSession.id,
      });

      const confId = confRes.confirmationId!;

      // 2. Caller confirms (simulate verbal caller confirmation)
      await prisma.conversationConfirmation.update({
        where: { id: confId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      // 3. Execution succeeds
      const bookRes = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: contact.id,
        serviceId: service.id,
        slotId,
        confirmationId: confId,
        testSessionId: testSession.id,
      });

      expect(bookRes.confirmationRequired).toBe(false);
      expect(bookRes.appointment).toBeDefined();
      expect(bookRes.appointment?.status).toBe(AppointmentStatus.CONFIRMED);

      // Verify confirmation is consumed
      const updatedConf = await prisma.conversationConfirmation.findUnique({
        where: { id: confId },
      });
      expect(updatedConf?.status).toBe("CONSUMED");
      expect(updatedConf?.consumedAt).not.toBeNull();

      // 4. Replay attempt: Reusing the same consumed confirmation MUST fail
      await expect(
        appointmentDomainService.bookAppointment({
          workspaceId,
          contactId: contact.id,
          serviceId: service.id,
          slotId,
          confirmationId: confId,
          testSessionId: testSession.id,
        })
      ).rejects.toThrow(/CONSUMED|already been consumed/);
    });
  });

  describe("3. Concurrency & Double-Booking Prevention (Mandatory Race Test)", () => {
    it("prevents double-booking when two callers attempt to book the exact same slot concurrently", async () => {
      // Create a specific isolated slot
      const raceStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const raceEnd = new Date(raceStart.getTime() + 30 * 60 * 1000);

      const sharedSlotId = slotTokenService.generateSlotToken({
        workspaceId,
        serviceId: service.id,
        calendarIntegrationId: integration.id,
        startAt: raceStart.toISOString(),
        endAt: raceEnd.toISOString(),
      });

      // Create two independent callers with pre-approved confirmations for the same slot
      const caller1 = await prisma.contact.create({
        data: {
          workspaceId,
          firstName: "Alice",
          lastName: "Walker",
          phone: "+15555550201",
        },
      });

      const caller2 = await prisma.contact.create({
        data: {
          workspaceId,
          firstName: "Bob",
          lastName: "Miller",
          phone: "+15555550202",
        },
      });

      const hash1 = appointmentDomainService.constructor as any;
      const conf1 = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSession.id,
          action: "appointment.book",
          target: sharedSlotId,
          payloadHash: (appointmentDomainService.constructor as any).computePayloadHash({
            contactId: caller1.id,
            serviceId: service.id,
            slotId: sharedSlotId,
          }),
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const conf2 = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSession.id,
          action: "appointment.book",
          target: sharedSlotId,
          payloadHash: (appointmentDomainService.constructor as any).computePayloadHash({
            contactId: caller2.id,
            serviceId: service.id,
            slotId: sharedSlotId,
          }),
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // Execute both booking attempts concurrently!
      const results = await Promise.allSettled([
        appointmentDomainService.bookAppointment({
          workspaceId,
          contactId: caller1.id,
          serviceId: service.id,
          slotId: sharedSlotId,
          confirmationId: conf1.id,
          testSessionId: testSession.id,
        }),
        appointmentDomainService.bookAppointment({
          workspaceId,
          contactId: caller2.id,
          serviceId: service.id,
          slotId: sharedSlotId,
          confirmationId: conf2.id,
          testSessionId: testSession.id,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly ONE succeeds!
      expect(fulfilled.length).toBe(1);
      // The other is rejected with SLOT_NO_LONGER_AVAILABLE
      expect(rejected.length).toBe(1);

      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedError.message).toMatch(/SLOT_NO_LONGER_AVAILABLE/);
    });
  });

  describe("4. Rescheduling & Idempotent Cancellation", () => {
    let bookedAppointment: any;

    beforeAll(async () => {
      const res = await availabilityService.getAvailability({
        workspaceId,
        serviceId: service.id,
        date: "2026-09-15",
      });

      const slot = res.slots[0];
      const hash = (appointmentDomainService.constructor as any).computePayloadHash({
        contactId: contact.id,
        serviceId: service.id,
        slotId: slot.slotId,
      });

      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSession.id,
          action: "appointment.book",
          target: slot.slotId,
          payloadHash: hash,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const result = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: contact.id,
        serviceId: service.id,
        slotId: slot.slotId,
        confirmationId: conf.id,
        testSessionId: testSession.id,
      });

      bookedAppointment = result.appointment;
    });

    it("reschedules appointment to a new slot with history tracking", async () => {
      const res = await availabilityService.getAvailability({
        workspaceId,
        serviceId: service.id,
        date: "2026-09-16",
      });
      const newSlot = res.slots[0];

      const hash = (appointmentDomainService.constructor as any).computePayloadHash({
        appointmentId: bookedAppointment.id,
        slotId: newSlot.slotId,
      });

      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSession.id,
          action: "appointment.reschedule",
          target: bookedAppointment.id,
          payloadHash: hash,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const result = await appointmentDomainService.rescheduleAppointment({
        workspaceId,
        appointmentId: bookedAppointment.id,
        slotId: newSlot.slotId,
        confirmationId: conf.id,
        reason: "Patient requested morning time",
      });

      expect(result.appointment.status).toBe(AppointmentStatus.RESCHEDULED);

      // Verify change history
      const changes = await prisma.appointmentChange.findMany({
        where: { appointmentId: bookedAppointment.id },
      });
      expect(changes.some((c) => c.type === "RESCHEDULED")).toBe(true);
    });

    it("cancels appointment and supports safe idempotent cancellation", async () => {
      const hash = (appointmentDomainService.constructor as any).computePayloadHash({
        appointmentId: bookedAppointment.id,
      });

      const conf = await prisma.conversationConfirmation.create({
        data: {
          workspaceId,
          testSessionId: testSession.id,
          action: "appointment.cancel",
          target: bookedAppointment.id,
          payloadHash: hash,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // 1. Initial cancel
      const cancelRes = await appointmentDomainService.cancelAppointment({
        workspaceId,
        appointmentId: bookedAppointment.id,
        confirmationId: conf.id,
        reason: "Patient moved out of state",
      });

      expect(cancelRes.appointment.status).toBe(AppointmentStatus.CANCELLED);

      // 2. Idempotent cancel: cancelling again safely returns cancelled state
      const idempotentRes = await appointmentDomainService.cancelAppointment({
        workspaceId,
        appointmentId: bookedAppointment.id,
        reason: "Repeated cancel call",
      });

      expect(idempotentRes.appointment.status).toBe(AppointmentStatus.CANCELLED);
      expect((idempotentRes as any).alreadyCancelled).toBe(true);
    });
  });

  describe("5. Tool Gateway Scheduling Integration", () => {
    it("allows find_service and returns active catalog", async () => {
      const res = await ToolGatewayService.execute({
        sessionId: testSession.id,
        toolCallId: "call_find_1",
        toolName: "find_service",
        arguments: {},
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.services.length).toBeGreaterThan(0);
        expect(res.data.services[0].name).toBe("Routine Dental Cleaning");
      }
    });

    it("disallows scheduling tools when SCHEDULE_APPOINTMENTS objective is absent", async () => {
      const restRec = await prisma.receptionist.create({
        data: {
          workspaceId,
          name: "Restricted Ava",
          slug: "restricted-ava-2",
          roleTitle: "Receptionist",
          industry: "Dental",
          objectiveConfig: { objectives: ["ANSWER_QUESTIONS"] },
          createdByUserId: ownerUser.id,
        },
      });

      const restSession = await prisma.realtimeTestSession.create({
        data: {
          workspaceId,
          receptionistId: restRec.id,
          status: RealtimeTestSessionStatus.CONNECTED,
          configurationVersion: 1,
          createdByUserId: ownerUser.id,
        },
      });

      const res = await ToolGatewayService.execute({
        sessionId: restSession.id,
        toolCallId: "call_no_sched",
        toolName: "check_availability",
        arguments: { serviceId: service.id },
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("TOOL_NOT_ENABLED");
      }
    });
  });
});
