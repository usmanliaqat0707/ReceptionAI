import { prisma } from "@receptionai/db";
import {
  REALTIME_SESSION_TOOL_CALL_LIMIT,
  REALTIME_SESSION_MUTATION_LIMIT,
  CONFIRMATION_EXPIRY_MINUTES,
} from "@receptionai/config";
import {
  ToolDefinition,
  ToolExecutionContext,
  CAPABILITY_TO_TOOLS,
} from "../tool-registry";
import crypto from "crypto";

export class AIToolPolicyService {
  /**
   * Validates whether the tool call is permitted under session policy,
   * capability assignment, rate limits, and confirmation rules.
   */
  public static async validatePolicy(
    context: ToolExecutionContext,
    toolDef: ToolDefinition,
    rawInput: any,
    receptionistObjectives: string[]
  ): Promise<{ allowed: boolean; errorCode?: string; errorMessage?: string }> {
    // 1. Verify capability is enabled on receptionist
    const allowedToolsForObjectives = new Set<string>();
    for (const obj of receptionistObjectives) {
      const toolNames = CAPABILITY_TO_TOOLS[obj] || [];
      for (const t of toolNames) {
        allowedToolsForObjectives.add(t);
      }
    }

    if (!allowedToolsForObjectives.has(toolDef.name)) {
      return {
        allowed: false,
        errorCode: "TOOL_NOT_ENABLED",
        errorMessage: `Tool '${toolDef.name}' is not enabled for this receptionist's configured objectives.`,
      };
    }

    // 2. Rate Limits per Test Session
    const totalExecutionsCount = await prisma.receptionistToolExecution.count({
      where: { testSessionId: context.testSessionId },
    });

    if (totalExecutionsCount >= REALTIME_SESSION_TOOL_CALL_LIMIT) {
      return {
        allowed: false,
        errorCode: "TOOL_RATE_LIMITED",
        errorMessage: `Session tool limit exceeded (max ${REALTIME_SESSION_TOOL_CALL_LIMIT} calls per session).`,
      };
    }

    if (toolDef.sideEffect === "WRITE") {
      const writeExecutionsCount = await prisma.receptionistToolExecution.count({
        where: {
          testSessionId: context.testSessionId,
          status: "SUCCEEDED",
          toolName: {
            in: [
              "create_contact",
              "update_contact",
              "create_lead",
              "update_lead",
              "take_message",
              "request_callback",
              "book_appointment",
              "reschedule_appointment",
              "cancel_appointment",
            ],
          },
        },
      });

      if (writeExecutionsCount >= REALTIME_SESSION_MUTATION_LIMIT) {
        return {
          allowed: false,
          errorCode: "TOOL_MUTATION_LIMIT_EXCEEDED",
          errorMessage: `Session mutation limit reached (max ${REALTIME_SESSION_MUTATION_LIMIT} write operations per session).`,
        };
      }
    }

    // Explicit Trust Boundary: Never trust model-asserted callerConfirmed=true as authorization
    if (["book_appointment", "reschedule_appointment", "cancel_appointment"].includes(toolDef.name)) {
      if (rawInput?.callerConfirmed === true && !rawInput?.confirmationId) {
        return {
          allowed: false,
          errorCode: "MODEL_CONFIRMATION_REJECTED",
          errorMessage:
            "Authorization rejected: The AI model cannot self-certify caller authorization with callerConfirmed=true. A valid server-issued confirmationId is required.",
        };
      }
    }

    // 3. Confirmation Requirement for Sensitive Contact Updates
    if (toolDef.name === "update_contact") {
      const { contactId, phone, email, confirmationId } = rawInput;
      if (phone || email) {
        // Fetch existing contact to see if replacement is occurring
        const existing = await prisma.contact.findFirst({
          where: { id: contactId, workspaceId: context.workspaceId, archivedAt: null },
        });

        if (existing) {
          const isReplacingPhone = phone && existing.phone && phone !== existing.phone;
          const isReplacingEmail = email && existing.email && email !== existing.email;

          if (isReplacingPhone || isReplacingEmail) {
            if (!confirmationId) {
              // Create pending confirmation record
              const payloadHash = crypto
                .createHash("sha256")
                .update(JSON.stringify({ contactId, phone, email }))
                .digest("hex");

              const conf = await prisma.conversationConfirmation.create({
                data: {
                  workspaceId: context.workspaceId,
                  testSessionId: context.testSessionId,
                  action: "contact.update_sensitive_info",
                  target: contactId,
                  payloadHash,
                  status: "PENDING",
                  expiresAt: new Date(
                    Date.now() + CONFIRMATION_EXPIRY_MINUTES * 60 * 1000
                  ),
                },
              });

              return {
                allowed: false,
                errorCode: "CONFIRMATION_REQUIRED",
                errorMessage: `Replacing contact phone or email requires explicit caller confirmation. Generated confirmation ID: ${conf.id}. Ask caller to confirm, then resend with confirmationId.`,
              };
            }

            // Validate supplied confirmationId
            const validConf = await prisma.conversationConfirmation.findFirst({
              where: {
                id: confirmationId,
                workspaceId: context.workspaceId,
                testSessionId: context.testSessionId,
                status: "CONFIRMED",
                expiresAt: { gt: new Date() },
              },
            });

            if (!validConf) {
              return {
                allowed: false,
                errorCode: "INVALID_CONFIRMATION",
                errorMessage: `Confirmation ID is invalid, expired, or not in CONFIRMED status.`,
              };
            }
          }
        }
      }
    }

    return { allowed: true };
  }
}
