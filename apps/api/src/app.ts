import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import crypto from "crypto";
import { ZodError } from "zod";
import { logger } from "@receptionai/observability";
import { healthRoutes } from "./modules/health/health.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { workspaceRoutes } from "./modules/workspaces/workspace.routes";
import { membershipRoutes } from "./modules/memberships/membership.routes";
import { securityRoutes } from "./modules/security/security.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import { receptionistRoutes } from "./modules/receptionists/receptionist.routes";
import { transferDestinationRoutes } from "./modules/transfer-destinations/transfer-destination.routes";
import { realtimeSessionRoutes } from "./modules/realtime/realtime-session.routes";
import { toolExecutionRoutes } from "./modules/tools/tool-execution.routes";
import { contactRoutes } from "./modules/contacts/contact.routes";
import { leadRoutes } from "./modules/leads/lead.routes";
import { messageRoutes } from "./modules/messages/message.routes";
import { businessProfileRoutes } from "./modules/business-profile/business-profile.routes";
import { knowledgeRoutes } from "./modules/knowledge/knowledge.routes";
import { serviceRoutes } from "./modules/services/service.routes";
import { appointmentRoutes } from "./modules/appointments/appointment.routes";
import { calendarRoutes } from "./modules/calendar/calendar.routes";
import { communicationRoutes } from "./modules/communications/communication.routes";
import { communicationWebhookRoutes } from "./modules/communications/provider-webhook.routes";

export function buildApp(): FastifyInstance {
  const app = fastify({
    genReqId: (req) => {
      const headerId = req.headers["x-request-id"];
      return typeof headerId === "string" ? headerId : crypto.randomUUID();
    },
    logger: false, // Observability package logger is used via hooks
    trustProxy: true,
  });

  // Request & Response Logging via Observability
  app.addHook("onRequest", async (req) => {
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        url: req.url,
        ip: req.ip,
      },
      `Incoming Request: ${req.method} ${req.url}`
    );
  });

  app.addHook("onResponse", async (req, reply) => {
    logger.info(
      {
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
      },
      `Response Sent: ${req.method} ${req.url} -> ${reply.statusCode}`
    );
  });

  // CORS Configuration
  const webOrigin = process.env.WEB_URL || "http://localhost:3000";
  app.register(cors, {
    origin: [
      webOrigin,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookies
  app.register(cookie, {
    secret: process.env.SESSION_SECRET || "default_super_secret_for_development_purposes_only",
    parseOptions: {},
  });

  // Rate Limiting (General protection)
  app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: (req) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please slow down and try again shortly.",
        requestId: req.id,
      },
    }),
  });

  // Global Error Handler
  app.setErrorHandler((error, req, reply) => {
    // 1. Zod Validation Error
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The submitted request data failed schema validation.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
          requestId: req.id,
        },
      });
    }

    // 2. Fastify Validation Error
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          requestId: req.id,
        },
      });
    }

    // 3. Known HTTP errors
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.name || "CLIENT_ERROR",
          message: error.message,
          requestId: req.id,
        },
      });
    }

    // 4. Unexpected 500 Internal Error (Sanitized)
    logger.error(
      {
        err: error,
        requestId: req.id,
        url: req.url,
        method: req.method,
      },
      "Unhandled server exception"
    );

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing your request.",
        requestId: req.id,
      },
    });
  });

  // Register Routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(workspaceRoutes);
  app.register(membershipRoutes);
  app.register(securityRoutes);
  app.register(auditRoutes);
  app.register(receptionistRoutes);
  app.register(transferDestinationRoutes);
  app.register(realtimeSessionRoutes);
  app.register(toolExecutionRoutes);
  app.register(contactRoutes);
  app.register(leadRoutes);
  app.register(messageRoutes);
  app.register(businessProfileRoutes);
  app.register(knowledgeRoutes);
  app.register(serviceRoutes);
  app.register(appointmentRoutes);
  app.register(calendarRoutes);
  app.register(communicationRoutes);
  app.register(communicationWebhookRoutes);

  return app;
}
