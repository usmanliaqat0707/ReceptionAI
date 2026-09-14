import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { buildApp } from "../src/app";
import {
  prisma,
  WorkspaceRole,
  AppointmentStatus,
  ActorType,
  CalendarProviderType,
  CalendarIntegrationStatus,
} from "@receptionai/db";
import { hashPassword, generateSecureToken, hashToken } from "@receptionai/security";
import { SESSION_COOKIE_NAME } from "@receptionai/config";
import { CommunicationDeliveryService } from "../src/modules/communications/services/communication-delivery.service";
import { CommunicationPolicyService } from "../src/modules/communications/services/communication-policy.service";
import { TemplateEngineService } from "../src/modules/communications/services/template-engine.service";
import { CommunicationWebhookService } from "../src/modules/communications/services/communication-webhook.service";
import { CommunicationProviderFactory } from "../src/modules/communications/providers/provider-factory";
import { MockSmsProvider } from "../src/modules/communications/providers/mock-sms.provider";
import { MockEmailProvider } from "../src/modules/communications/providers/mock-email.provider";
import { ToolGatewayService } from "../src/modules/tools/services/tool-gateway.service";
import { appointmentDomainService } from "../src/modules/appointments/services/appointment-domain.service";

describe("Phase 7 Messaging & Notifications Tests", () => {
  const app = buildApp();
  const mockSms = new MockSmsProvider();
  const mockEmail = new MockEmailProvider();

  let workspaceId: string;
  let ownerUser: any;
  let staffUser: any;
  let ownerCookie: string;
  let staffCookie: string;
  let testContact: any;
  let testService: any;
  let testIntegration: any;
  let testReceptionist: any;

  beforeAll(async () => {
    CommunicationProviderFactory.setSmsProvider(mockSms);
    CommunicationProviderFactory.setEmailProvider(mockEmail);

    // 1. Clean Database
    await prisma.communicationProviderEvent.deleteMany();
    await prisma.communicationDeliveryAttempt.deleteMany();
    await prisma.outboundCommunication.deleteMany();
    await prisma.communicationSuppression.deleteMany();
    await prisma.communicationTemplate.deleteMany();
    await prisma.workspaceCommunicationSettings.deleteMany();
    await prisma.contactCommunicationPreference.deleteMany();
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
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await hashPassword("password123");

    // 2. Create Workspace
    const ws = await prisma.workspace.create({
      data: {
        name: "Apex Healthcare Clinic",
        slug: "apex-healthcare",
        timezone: "America/New_York",
      },
    });
    workspaceId = ws.id;

    // 3. Create Users
    ownerUser = await prisma.user.create({
      data: {
        email: "admin@apex.local",
        passwordHash,
        name: "Dr. Apex Admin",
      },
    });
    await prisma.workspaceMembership.create({
      data: {
        workspaceId,
        userId: ownerUser.id,
        role: WorkspaceRole.OWNER,
      },
    });
    const ownerToken = generateSecureToken();
    await prisma.session.create({
      data: {
        userId: ownerUser.id,
        tokenHash: hashToken(ownerToken),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    ownerCookie = `${SESSION_COOKIE_NAME}=${ownerToken}`;

    staffUser = await prisma.user.create({
      data: {
        email: "staff@apex.local",
        passwordHash,
        name: "Staff Jane",
      },
    });
    await prisma.workspaceMembership.create({
      data: {
        workspaceId,
        userId: staffUser.id,
        role: WorkspaceRole.RECEPTION_STAFF,
      },
    });
    const staffToken = generateSecureToken();
    await prisma.session.create({
      data: {
        userId: staffUser.id,
        tokenHash: hashToken(staffToken),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    staffCookie = `${SESSION_COOKIE_NAME}=${staffToken}`;

    // 4. Create Contact
    testContact = await prisma.contact.create({
      data: {
        workspaceId,
        firstName: "Michael",
        lastName: "Scott",
        phone: "+15555550199",
        normalizedPhone: "+15555550199",
        email: "michael@dundermifflin.local",
        normalizedEmail: "michael@dundermifflin.local",
      },
    });

    // 5. Create Calendar & Service
    testIntegration = await prisma.calendarIntegration.create({
      data: {
        workspaceId,
        name: "Demo Calendar",
        provider: CalendarProviderType.INTERNAL_DEMO,
        status: CalendarIntegrationStatus.CONNECTED,
      },
    });

    testService = await prisma.service.create({
      data: {
        workspaceId,
        name: "General Consultation",
        durationMinutes: 30,
        active: true,
        calendarIntegrationId: testIntegration.id,
      },
    });

    testReceptionist = await prisma.receptionist.create({
      data: {
        workspaceId,
        name: "Apex AI Receptionist",
        slug: "apex-receptionist",
        objectiveConfig: {
          objectives: ["SCHEDULE_APPOINTMENTS", "SEND_COMMUNICATIONS"],
        },
      },
    });
  });

  afterEach(() => {
    mockSms.clear();
    mockEmail.clear();
  });

  // 1. Template Engine
  describe("Template Engine & Safety", () => {
    it("safely interpolates variables into templates without eval", () => {
      const template = "Hello {{customer_first_name}}, your {{service_name}} appointment is at {{appointment_time}}.";
      const vars = {
        customer_first_name: "Michael",
        service_name: "Consultation",
        appointment_time: "10:00 AM",
      };
      const rendered = TemplateEngineService.render(template, vars);
      expect(rendered).toBe("Hello Michael, your Consultation appointment is at 10:00 AM.");
    });

    it("renders missing or undefined variables as empty string safely", () => {
      const template = "Hello {{customer_first_name}} {{customer_last_name}}!";
      const vars = { customer_first_name: "Michael" };
      const rendered = TemplateEngineService.render(template, vars);
      expect(rendered).toBe("Hello Michael !");
    });

    it("sanitizes text for HTML email inclusion to prevent XSS", () => {
      const dangerous = '<script>alert("hack")</script> & "quotes"';
      const sanitized = TemplateEngineService.sanitizeForHtml(dangerous);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
      expect(sanitized).toContain("&quot;quotes&quot;");
    });
  });

  // 2. Outbox Idempotency & Deduplication
  describe("Outbox Idempotency & Deduplication", () => {
    it("creates a pending communication in the outbox", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "test-idem-key-1",
        variables: {
          customer_first_name: "Michael",
          service_name: "Consultation",
          appointment_date: "Monday, Oct 12",
          appointment_time: "10:00 AM",
        },
      });

      expect(comm).toBeDefined();
      expect(comm?.status).toBe("PENDING");
      expect(comm?.recipientAddress).toBe("+15555550199");
      expect(comm?.body).toContain("Michael");
      expect(comm?.body).toContain("Consultation");
    });

    it("returns existing record without duplicate insertion when exact idempotency key is reused", async () => {
      const comm1 = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "test-idem-key-unique",
      });

      const comm2 = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "test-idem-key-unique",
      });

      expect(comm1?.id).toBe(comm2?.id);
      const count = await prisma.outboundCommunication.count({
        where: { workspaceId, idempotencyKey: "test-idem-key-unique" },
      });
      expect(count).toBe(1);
    });
  });

  // 3. Strict Anti-Open-Relay Security Policy
  describe("Anti-Open-Relay Security Enforcement", () => {
    it("rejects send_sms tool call if model supplies arbitrary recipient number or body", async () => {
      const receptionist = await prisma.receptionist.create({
        data: {
          workspaceId,
          name: "Receptionist Alice",
          slug: "alice-comm-1",
          objectiveConfig: {
            objectives: ["SCHEDULE_APPOINTMENTS", "SEND_COMMUNICATIONS"],
          },
        },
      });

      const session = await prisma.realtimeTestSession.create({
        data: {
          workspaceId,
          receptionistId: receptionist.id,
          status: "CONNECTED",
          configurationVersion: 1,
          createdByUserId: ownerUser.id,
        },
      });

      // Passing raw 'to' or 'body' violates open relay policy
      const result = await ToolGatewayService.execute({
        sessionId: session.id,
        toolCallId: "call_open_relay",
        toolName: "send_sms",
        arguments: {
          to: "+19999999999",
          body: "Spam message from compromised prompt",
          contactId: testContact.id,
          purpose: "CUSTOM_TRANSACTIONAL",
        },
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(result.success).toBe(false);
      expect((result as any).error?.code).toBe("SECURITY_POLICY_VIOLATION");
    });

    it("allows send_sms when referencing contactId and server-controlled purpose", async () => {
      const receptionist = await prisma.receptionist.create({
        data: {
          workspaceId,
          name: "Receptionist Bob",
          slug: "bob-comm-2",
          objectiveConfig: {
            objectives: ["SCHEDULE_APPOINTMENTS", "SEND_COMMUNICATIONS"],
          },
        },
      });

      const session = await prisma.realtimeTestSession.create({
        data: {
          workspaceId,
          receptionistId: receptionist.id,
          status: "CONNECTED",
          configurationVersion: 1,
          createdByUserId: ownerUser.id,
        },
      });

      const result = await ToolGatewayService.execute({
        sessionId: session.id,
        toolCallId: "call_safe_relay",
        toolName: "send_sms",
        arguments: {
          contactId: testContact.id,
          purpose: "APPOINTMENT_CONFIRMATION",
        },
        actorUserId: ownerUser.id,
        userWorkspaceIds: [workspaceId],
      });

      expect(result.success).toBe(true);
      expect((result as any).data?.message).toContain("SMS notification queued");
    });
  });

  // 4. Policy, Suppression & Contact Preferences
  describe("Communication Policy & Suppression", () => {
    it("marks communication as SUPPRESSED if recipient address is in suppression list", async () => {
      await prisma.communicationSuppression.create({
        data: {
          workspaceId,
          channel: "SMS",
          address: "+15550001111",
          reason: "USER_OPTOUT",
        },
      });

      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        recipientAddress: "+15550001111",
        idempotencyKey: "suppressed-test-1",
      });

      expect(comm?.status).toBe("SUPPRESSED");
      expect(comm?.metadata).toMatchObject({
        suppressionReason: expect.stringContaining("USER_OPTOUT"),
      });
    });

    it("blocks SMS if contact has opted out in ContactCommunicationPreference", async () => {
      const optOutContact = await prisma.contact.create({
        data: {
          workspaceId,
          firstName: "Dwight",
          phone: "+15558889999",
          normalizedPhone: "+15558889999",
        },
      });

      await prisma.contactCommunicationPreference.create({
        data: {
          workspaceId,
          contactId: optOutContact.id,
          smsTransactionalAllowed: false,
        },
      });

      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: optOutContact.id,
      });

      expect(comm).toBeNull();
    });
  });

  // 5. Delivery Execution & Monotonic Status Transitions
  describe("Delivery Lifecycle & Monotonic Webhook Transitions", () => {
    it("executes delivery via provider adapter, creates delivery attempt, and sets status to SENT", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "CALLBACK_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "deliver-test-1",
      });

      expect(comm).toBeDefined();

      const delivered = await CommunicationDeliveryService.deliver(comm!.id);
      expect(delivered?.status).toBe("SENT");
      expect(mockSms.sentMessages.length).toBe(1);
      expect(mockSms.sentMessages[0].to).toBe(testContact.phone);

      const attempts = await prisma.communicationDeliveryAttempt.findMany({
        where: { communicationId: comm!.id },
      });
      expect(attempts.length).toBe(1);
      expect(attempts[0].status).toBe("SENT");
    });

    it("monotonically transitions status from SENT to DELIVERED upon receiving provider webhook", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "MESSAGE_RECEIVED_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "webhook-test-1",
      });

      await CommunicationDeliveryService.deliver(comm!.id);

      const attempt = await prisma.communicationDeliveryAttempt.findFirst({
        where: { communicationId: comm!.id },
      });

      // Simulate Twilio delivered status callback
      const webhookRes = await CommunicationWebhookService.handleTwilioWebhook({
        MessageSid: attempt?.providerMessageId,
        MessageStatus: "delivered",
      });

      expect(webhookRes.handled).toBe(true);
      expect(webhookRes.status).toBe("DELIVERED");

      const updated = await prisma.outboundCommunication.findUnique({
        where: { id: comm!.id },
      });
      expect(updated?.status).toBe("DELIVERED");
      expect(updated?.deliveredAt).toBeDefined();
    });

    it("prevents out-of-order webhook regression: late SENT webhook does NOT revert DELIVERED", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "out-of-order-test",
      });

      await CommunicationDeliveryService.deliver(comm!.id);
      const attempt = await prisma.communicationDeliveryAttempt.findFirst({
        where: { communicationId: comm!.id },
      });

      // 1. Deliver event arrives first
      await CommunicationWebhookService.handleTwilioWebhook({
        MessageSid: attempt?.providerMessageId,
        MessageStatus: "delivered",
      });

      let current = await prisma.outboundCommunication.findUnique({
        where: { id: comm!.id },
      });
      expect(current?.status).toBe("DELIVERED");

      // 2. Late 'sent' event arrives
      const lateRes = await CommunicationWebhookService.handleTwilioWebhook({
        MessageSid: attempt?.providerMessageId,
        MessageStatus: "sent",
      });

      expect(lateRes.ignoredOutOfOrder).toBe(true);

      current = await prisma.outboundCommunication.findUnique({
        where: { id: comm!.id },
      });
      expect(current?.status).toBe("DELIVERED"); // Remains DELIVERED!
    });

    it("automatically suppresses phone number upon Twilio 21610 STOP unsubscribe error", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "SMS",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "twilio-stop-test",
      });

      await CommunicationDeliveryService.deliver(comm!.id);
      const attempt = await prisma.communicationDeliveryAttempt.findFirst({
        where: { communicationId: comm!.id },
      });

      await CommunicationWebhookService.handleTwilioWebhook({
        MessageSid: attempt?.providerMessageId,
        MessageStatus: "failed",
        ErrorCode: "21610", // Twilio STOP code
      });

      const updatedComm = await prisma.outboundCommunication.findUnique({
        where: { id: comm!.id },
      });
      expect(updatedComm?.status).toBe("FAILED");

      // Verify suppression record created
      const suppression = await prisma.communicationSuppression.findUnique({
        where: {
          workspaceId_channel_address: {
            workspaceId,
            channel: "SMS",
            address: testContact.phone,
          },
        },
      });
      expect(suppression).toBeDefined();
      expect(suppression?.reason).toBe("USER_OPTOUT");
    });

    it("automatically suppresses email upon Resend bounce event", async () => {
      const comm = await CommunicationDeliveryService.enqueue({
        workspaceId,
        channel: "EMAIL",
        purpose: "APPOINTMENT_CONFIRMATION",
        contactId: testContact.id,
        idempotencyKey: "resend-bounce-test",
      });

      await CommunicationDeliveryService.deliver(comm!.id);
      const attempt = await prisma.communicationDeliveryAttempt.findFirst({
        where: { communicationId: comm!.id },
      });

      await CommunicationWebhookService.handleResendWebhook({
        type: "email.bounced",
        data: {
          email_id: attempt?.providerMessageId,
          to: [testContact.email],
        },
      });

      const updatedComm = await prisma.outboundCommunication.findUnique({
        where: { id: comm!.id },
      });
      expect(updatedComm?.status).toBe("FAILED");

      const suppression = await prisma.communicationSuppression.findUnique({
        where: {
          workspaceId_channel_address: {
            workspaceId,
            channel: "EMAIL",
            address: testContact.email,
          },
        },
      });
      expect(suppression).toBeDefined();
      expect(suppression?.reason).toBe("HARD_BOUNCE");
    });
  });

  // 6. End-to-End Appointment Booking Confirmation
  describe("End-to-End Appointment Lifecycle Confirmation", () => {
    it("automatically enqueues and delivers SMS and Email confirmations upon successful appointment booking", async () => {
      const bookingContact = await prisma.contact.create({
        data: {
          workspaceId,
          firstName: "Jim",
          lastName: "Halpert",
          phone: "+15551234567",
          normalizedPhone: "+15551234567",
          email: "jim@dundermifflin.local",
          normalizedEmail: "jim@dundermifflin.local",
        },
      });

      const slotStart = new Date(Date.now() + 3600000 * 24);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

      // Create signed slot token
      const { slotTokenService } = await import("../src/modules/appointments/services/slot-token.service");
      const slotToken = slotTokenService.generateSlotToken({
        workspaceId,
        serviceId: testService.id,
        calendarIntegrationId: testIntegration.id,
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
      });

      const session = await prisma.realtimeTestSession.create({
        data: {
          workspaceId,
          receptionistId: testReceptionist.id,
          status: "CONNECTED",
          configurationVersion: 1,
          createdByUserId: ownerUser.id,
        },
      });

      // Step 1: Request booking without confirmationId -> returns CONFIRMATION_REQUIRED and creates confirmation
      const firstTry = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: bookingContact.id,
        serviceId: testService.id,
        slotId: slotToken,
        testSessionId: session.id,
      });

      expect(firstTry.confirmationRequired).toBe(true);
      const confId = firstTry.confirmationId!;

      // Caller confirms
      await prisma.conversationConfirmation.update({
        where: { id: confId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      // Step 2: Book with confirmed token
      const bookResult = await appointmentDomainService.bookAppointment({
        workspaceId,
        contactId: bookingContact.id,
        serviceId: testService.id,
        slotId: slotToken,
        confirmationId: confId,
        testSessionId: session.id,
      });

      expect(bookResult.confirmationRequired).toBe(false);
      expect(bookResult.appointment).toBeDefined();

      // Check outbound communications for this appointment
      const comms = await prisma.outboundCommunication.findMany({
        where: {
          workspaceId,
          appointmentId: bookResult.appointment.id,
        },
      });

      expect(comms.length).toBeGreaterThanOrEqual(1);
      const smsComm = comms.find((c) => c.channel === "SMS");
      expect(smsComm).toBeDefined();
      expect(smsComm?.status).toBe("SENT");
      expect(smsComm?.body).toContain("General Consultation");
    });
  });

  // 7. REST API Endpoints & RBAC
  describe("REST API Endpoints & RBAC", () => {
    it("GET /api/v1/workspaces/:workspaceId/communications returns communications list", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceId}/communications`,
        headers: { cookie: ownerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      // Owner sees unmasked address
      expect(body.items.some((i: any) => i.recipientAddress.includes("+1555"))).toBe(true);
    });

    it("masks recipient address for RECEPTION_STAFF without view_recipient permission", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceId}/communications`,
        headers: { cookie: staffCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      // Staff receives masked address
      expect(body.items[0].recipientAddress).toContain("***");
    });

    it("POST /api/v1/workspaces/:workspaceId/communications/send-test delivers operator test message", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceId}/communications/send-test`,
        headers: { cookie: ownerCookie },
        payload: {
          channel: "SMS",
          recipient: "+15555550188",
          message: "Live operator connectivity test.",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.communication.status).toBe("SENT");
      expect(mockSms.sentMessages.some((m) => m.to === "+15555550188")).toBe(true);
    });

    it("POST /api/v1/workspaces/:workspaceId/communications/:id/retry triggers retry for a failed message", async () => {
      const failedComm = await prisma.outboundCommunication.create({
        data: {
          workspaceId,
          channel: "SMS",
          purpose: "CALLBACK_CONFIRMATION",
          recipientAddress: "+15557778888",
          body: "Retry test notification",
          status: "FAILED",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspaceId}/communications/${failedComm.id}/retry`,
        headers: { cookie: ownerCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.communication.status).toBe("SENT");
    });
  });
});
