import { FastifyInstance } from "fastify";
import { CommunicationWebhookService } from "./services/communication-webhook.service";

export async function communicationWebhookRoutes(app: FastifyInstance) {
  // 1. POST /api/v1/webhooks/communications/twilio
  app.post("/api/v1/webhooks/communications/twilio", async (req, reply) => {
    const signature = (req.headers["x-twilio-signature"] as string) || "";
    const fullUrl = `${req.protocol}://${req.hostname}${req.url}`;
    const postParams = (req.body as Record<string, string>) || {};

    const isValid = CommunicationWebhookService.verifyTwilioSignature({
      url: fullUrl,
      postParams,
      signature,
    });

    if (!isValid && process.env.NODE_ENV === "production") {
      return reply.status(403).send({ error: "INVALID_TWILIO_SIGNATURE" });
    }

    try {
      await CommunicationWebhookService.handleTwilioWebhook(postParams);
      return reply
        .status(200)
        .header("Content-Type", "text/xml")
        .send("<Response></Response>");
    } catch (err: any) {
      req.log?.error(err, "Twilio webhook handler error");
      return reply.status(500).send({ error: "WEBHOOK_PROCESSING_FAILED" });
    }
  });

  // 2. POST /api/v1/webhooks/communications/resend
  app.post("/api/v1/webhooks/communications/resend", async (req, reply) => {
    const svixId = (req.headers["svix-id"] as string) || "";
    const svixTimestamp = (req.headers["svix-timestamp"] as string) || "";
    const svixSignature = (req.headers["svix-signature"] as string) || "";

    const rawPayload =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    const isValid = CommunicationWebhookService.verifyResendSignature({
      payload: rawPayload,
      svixId,
      svixTimestamp,
      svixSignature,
    });

    if (!isValid && process.env.NODE_ENV === "production") {
      return reply.status(403).send({ error: "INVALID_RESEND_SIGNATURE" });
    }

    try {
      const bodyObj =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await CommunicationWebhookService.handleResendWebhook(bodyObj);
      return reply.status(200).send({ success: true, ...result });
    } catch (err: any) {
      req.log?.error(err, "Resend webhook handler error");
      return reply.status(500).send({ error: "WEBHOOK_PROCESSING_FAILED" });
    }
  });
}
