import crypto from "crypto";
import { prisma, CommunicationStatus, SuppressionReason } from "@receptionai/db";

export class CommunicationWebhookService {
  /**
   * Validates Twilio Webhook Signature (X-Twilio-Signature).
   */
  public static verifyTwilioSignature(params: {
    url: string;
    postParams: Record<string, string>;
    signature: string;
    authToken?: string;
  }): boolean {
    const token =
      params.authToken ||
      process.env.TWILIO_WEBHOOK_AUTH_TOKEN ||
      process.env.TWILIO_AUTH_TOKEN;

    if (!token) {
      // If no token is configured in dev/test, bypass or log warning
      if (process.env.NODE_ENV === "test") return true;
      return false;
    }

    // Sort keys alphabetically
    const keys = Object.keys(params.postParams).sort();
    let data = params.url;
    for (const key of keys) {
      data += key + params.postParams[key];
    }

    const hmac = crypto.createHmac("sha1", token);
    hmac.update(data, "utf8");
    const expectedSignature = hmac.digest("base64");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(params.signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Validates Resend Webhook Signature (Svix svix-signature).
   */
  public static verifyResendSignature(params: {
    payload: string;
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
    webhookSecret?: string;
  }): boolean {
    const secret =
      params.webhookSecret || process.env.RESEND_WEBHOOK_SECRET;

    if (!secret) {
      if (process.env.NODE_ENV === "test") return true;
      return false;
    }

    // Secret is usually in format "whsec_..."
    const secretKey = secret.startsWith("whsec_")
      ? Buffer.from(secret.replace("whsec_", ""), "base64")
      : Buffer.from(secret);

    const toSign = `${params.svixId}.${params.svixTimestamp}.${params.payload}`;
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(toSign);
    const expectedSignature = `v1,${hmac.digest("base64")}`;

    try {
      // svix-signature can contain multiple space-separated signatures
      const passedSignatures = params.svixSignature.split(" ");
      return passedSignatures.some((sig) => {
        try {
          return crypto.timingSafeEqual(
            Buffer.from(sig),
            Buffer.from(expectedSignature)
          );
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Handles Twilio SMS status callback webhooks.
   */
  public static async handleTwilioWebhook(payload: Record<string, any>) {
    const messageSid = payload.MessageSid;
    const messageStatus = (payload.MessageStatus || "").toLowerCase();
    const errorCode = payload.ErrorCode;
    const eventId = `twilio_${messageSid}_${messageStatus}_${errorCode || "ok"}`;

    // Deduplication check
    const existingEvent = await prisma.communicationProviderEvent.findUnique({
      where: { providerEventId: eventId },
    });
    if (existingEvent) {
      return { handled: true, duplicate: true };
    }

    // Find communication attempt
    const attempt = await prisma.communicationDeliveryAttempt.findFirst({
      where: { providerMessageId: messageSid },
      include: { communication: true },
    });

    // Record provider event
    await prisma.communicationProviderEvent.create({
      data: {
        provider: "twilio",
        providerEventId: eventId,
        communicationId: attempt?.communicationId,
        type: `sms.${messageStatus}`,
        payloadSafe: {
          messageSid,
          messageStatus,
          errorCode,
          errorMessage: payload.ErrorMessage,
        },
        processedAt: new Date(),
      },
    });

    if (!attempt || !attempt.communication) {
      return { handled: true, unknownMessage: true };
    }

    const currentComm = attempt.communication;

    // Out-of-order transition guard: If already DELIVERED, do not regress to SENT
    if (currentComm.status === "DELIVERED" && messageStatus !== "failed" && messageStatus !== "undelivered") {
      return { handled: true, ignoredOutOfOrder: true };
    }

    let nextStatus: CommunicationStatus = currentComm.status;
    let deliveredAt: Date | null = currentComm.deliveredAt;
    let failedAt: Date | null = currentComm.failedAt;

    if (messageStatus === "delivered") {
      nextStatus = "DELIVERED";
      deliveredAt = new Date();
    } else if (messageStatus === "failed" || messageStatus === "undelivered") {
      nextStatus = "FAILED";
      failedAt = new Date();

      // Check for STOP / unsubscribed opt-out code
      if (errorCode === "21610") {
        await prisma.communicationSuppression.upsert({
          where: {
            workspaceId_channel_address: {
              workspaceId: currentComm.workspaceId,
              channel: "SMS",
              address: currentComm.recipientAddress,
            },
          },
          create: {
            workspaceId: currentComm.workspaceId,
            channel: "SMS",
            address: currentComm.recipientAddress,
            reason: "USER_OPTOUT",
            notes: "Twilio 21610 STOP opt-out",
          },
          update: {
            reason: "USER_OPTOUT",
            notes: "Twilio 21610 STOP opt-out",
          },
        });
      }
    }

    await prisma.outboundCommunication.update({
      where: { id: currentComm.id },
      data: {
        status: nextStatus,
        deliveredAt,
        failedAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: currentComm.workspaceId,
        action: `communication.${nextStatus.toLowerCase()}`,
        resourceType: "communication",
        resourceId: currentComm.id,
        metadata: {
          provider: "twilio",
          messageSid,
          status: nextStatus,
        },
      },
    });

    return { handled: true, status: nextStatus };
  }

  /**
   * Handles Resend Email delivery and bounce webhooks.
   */
  public static async handleResendWebhook(payload: Record<string, any>) {
    const eventType = payload.type; // e.g. "email.delivered", "email.bounced"
    const data = payload.data || {};
    const emailId = data.email_id || data.id;
    const eventId = `resend_${emailId}_${eventType}`;

    // Deduplication check
    const existingEvent = await prisma.communicationProviderEvent.findUnique({
      where: { providerEventId: eventId },
    });
    if (existingEvent) {
      return { handled: true, duplicate: true };
    }

    // Find communication attempt
    const attempt = await prisma.communicationDeliveryAttempt.findFirst({
      where: { providerMessageId: emailId },
      include: { communication: true },
    });

    await prisma.communicationProviderEvent.create({
      data: {
        provider: "resend",
        providerEventId: eventId,
        communicationId: attempt?.communicationId,
        type: eventType,
        payloadSafe: {
          emailId,
          type: eventType,
          to: data.to,
        },
        processedAt: new Date(),
      },
    });

    if (!attempt || !attempt.communication) {
      return { handled: true, unknownMessage: true };
    }

    const currentComm = attempt.communication;

    // Out-of-order guard
    if (currentComm.status === "DELIVERED" && eventType !== "email.bounced" && eventType !== "email.complained") {
      return { handled: true, ignoredOutOfOrder: true };
    }

    let nextStatus: CommunicationStatus = currentComm.status;
    let deliveredAt: Date | null = currentComm.deliveredAt;
    let failedAt: Date | null = currentComm.failedAt;

    if (eventType === "email.delivered") {
      nextStatus = "DELIVERED";
      deliveredAt = new Date();
    } else if (eventType === "email.bounced" || eventType === "email.complained") {
      nextStatus = "FAILED";
      failedAt = new Date();

      const reason: SuppressionReason =
        eventType === "email.complained" ? "USER_OPTOUT" : "HARD_BOUNCE";

      await prisma.communicationSuppression.upsert({
        where: {
          workspaceId_channel_address: {
            workspaceId: currentComm.workspaceId,
            channel: "EMAIL",
            address: currentComm.recipientAddress.toLowerCase().trim(),
          },
        },
        create: {
          workspaceId: currentComm.workspaceId,
          channel: "EMAIL",
          address: currentComm.recipientAddress.toLowerCase().trim(),
          reason,
          notes: `Resend event: ${eventType}`,
        },
        update: {
          reason,
          notes: `Resend event: ${eventType}`,
        },
      });
    }

    await prisma.outboundCommunication.update({
      where: { id: currentComm.id },
      data: {
        status: nextStatus,
        deliveredAt,
        failedAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: currentComm.workspaceId,
        action: `communication.${nextStatus.toLowerCase()}`,
        resourceType: "communication",
        resourceId: currentComm.id,
        metadata: {
          provider: "resend",
          emailId,
          status: nextStatus,
        },
      },
    });

    return { handled: true, status: nextStatus };
  }
}
