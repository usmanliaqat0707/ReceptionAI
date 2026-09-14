import { prisma, RealtimeTestSessionStatus } from "@receptionai/db";
import {
  getToolDefinition,
  NormalizedToolResult,
  ToolExecutionContext,
} from "../tool-registry";
import { AIToolPolicyService } from "./ai-tool-policy.service";
import { REALTIME_TOOL_TIMEOUT_MS } from "@receptionai/config";

export interface ExecuteToolGatewayParams {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  arguments: any;
  actorUserId: string;
  userWorkspaceIds: string[];
  requestId?: string;
}

export class ToolGatewayService {
  public static async execute(
    params: ExecuteToolGatewayParams
  ): Promise<NormalizedToolResult> {
    const startTime = Date.now();
    const {
      sessionId,
      toolCallId,
      toolName,
      arguments: rawArgs,
      actorUserId,
      userWorkspaceIds,
      requestId = "req_" + Math.random().toString(36).substring(2, 9),
    } = params;

    // 1. Validate tool name exists
    const toolDef = getToolDefinition(toolName);
    if (!toolDef) {
      return {
        success: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `The tool '${toolName}' is not recognized by the ReceptionAI platform.`,
        },
      };
    }

    // 2. Validate Session
    const session = await prisma.realtimeTestSession.findUnique({
      where: { id: sessionId },
      include: {
        receptionist: true,
      },
    });

    if (!session) {
      return {
        success: false,
        error: {
          code: "TOOL_SESSION_INVALID",
          message: "Voice test session does not exist.",
        },
      };
    }

    if (!userWorkspaceIds.includes(session.workspaceId)) {
      return {
        success: false,
        error: {
          code: "TOOL_NOT_ALLOWED",
          message: "User is not authorized to execute tools in this workspace.",
        },
      };
    }

    if (
      session.status === RealtimeTestSessionStatus.COMPLETED ||
      session.status === RealtimeTestSessionStatus.FAILED ||
      session.status === RealtimeTestSessionStatus.EXPIRED
    ) {
      return {
        success: false,
        error: {
          code: "TOOL_SESSION_ENDED",
          message: "Tool execution is not permitted after voice session has ended.",
        },
      };
    }

    // 3. Idempotency Check
    const existingExecution = await prisma.receptionistToolExecution.findUnique({
      where: {
        testSessionId_toolCallId: {
          testSessionId: sessionId,
          toolCallId,
        },
      },
    });

    if (existingExecution && existingExecution.status === "SUCCEEDED") {
      return {
        success: true,
        data: existingExecution.outputJson as any,
      };
    }

    // 4. Schema validation
    const parsedInput = toolDef.inputSchema.safeParse(rawArgs || {});
    if (!parsedInput.success) {
      const validationIssues = parsedInput.error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));

      // Persist rejected execution
      const isSecurityViolation = validationIssues.some((i) =>
        i.message.includes("SECURITY_POLICY_VIOLATION")
      );
      const errorCode = isSecurityViolation ? "SECURITY_POLICY_VIOLATION" : "TOOL_INPUT_INVALID";
      const errorMessage = isSecurityViolation
        ? "Arbitrary recipient numbers or message bodies are strictly prohibited. You must supply contactId and purpose only."
        : "Tool parameters failed schema validation.";

      await prisma.receptionistToolExecution.upsert({
        where: {
          testSessionId_toolCallId: {
            testSessionId: sessionId,
            toolCallId,
          },
        },
        create: {
          workspaceId: session.workspaceId,
          receptionistId: session.receptionistId,
          testSessionId: sessionId,
          configurationVersion: session.configurationVersion,
          toolCallId,
          toolName,
          status: "REJECTED",
          inputJson: rawArgs,
          errorCode,
          errorMessageSafe: errorMessage,
          idempotencyKey: `${sessionId}:${toolCallId}`,
          durationMs: Date.now() - startTime,
        },
        update: {
          status: "REJECTED",
          errorCode,
          errorMessageSafe: errorMessage,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: validationIssues,
        },
      };
    }

    // 5. AI Tool Policy & Capabilities Check
    const receptionist = session.receptionist;
    const objectiveConfig = (receptionist.objectiveConfig as { objectives?: string[] }) || {};
    const configuredObjectives = objectiveConfig.objectives || ["ANSWER_QUESTIONS"];

    const context: ToolExecutionContext = {
      workspaceId: session.workspaceId,
      receptionistId: session.receptionistId,
      configurationVersion: session.configurationVersion,
      testSessionId: sessionId,
      userId: actorUserId,
      actorType: "AI_RECEPTIONIST",
      requestId,
      toolCallId,
    };

    const policyCheck = await AIToolPolicyService.validatePolicy(
      context,
      toolDef,
      parsedInput.data,
      configuredObjectives
    );

    if (!policyCheck.allowed) {
      await prisma.receptionistToolExecution.upsert({
        where: {
          testSessionId_toolCallId: {
            testSessionId: sessionId,
            toolCallId,
          },
        },
        create: {
          workspaceId: session.workspaceId,
          receptionistId: session.receptionistId,
          testSessionId: sessionId,
          configurationVersion: session.configurationVersion,
          toolCallId,
          toolName,
          status: "REJECTED",
          inputJson: parsedInput.data,
          errorCode: policyCheck.errorCode,
          errorMessageSafe: policyCheck.errorMessage,
          idempotencyKey: `${sessionId}:${toolCallId}`,
          durationMs: Date.now() - startTime,
        },
        update: {
          status: "REJECTED",
          errorCode: policyCheck.errorCode,
          errorMessageSafe: policyCheck.errorMessage,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        success: false,
        error: {
          code: policyCheck.errorCode || "TOOL_NOT_ALLOWED",
          message: policyCheck.errorMessage || "Tool execution disallowed by policy.",
        },
      };
    }

    // 6. Record EXECUTING state
    await prisma.receptionistToolExecution.upsert({
      where: {
        testSessionId_toolCallId: {
          testSessionId: sessionId,
          toolCallId,
        },
      },
      create: {
        workspaceId: session.workspaceId,
        receptionistId: session.receptionistId,
        testSessionId: sessionId,
        configurationVersion: session.configurationVersion,
        toolCallId,
        toolName,
        status: "EXECUTING",
        inputJson: parsedInput.data,
        idempotencyKey: `${sessionId}:${toolCallId}`,
        startedAt: new Date(),
      },
      update: {
        status: "EXECUTING",
        startedAt: new Date(),
      },
    });

    // 7. Execute Handler with Timeout
    try {
      const executePromise = toolDef.execute(context, parsedInput.data);
      const timeoutPromise = new Promise<NormalizedToolResult>((_, reject) =>
        setTimeout(
          () => reject(new Error("TOOL_EXECUTION_TIMEOUT")),
          REALTIME_TOOL_TIMEOUT_MS
        )
      );

      const result = await Promise.race([executePromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      if (result.success) {
        await prisma.receptionistToolExecution.update({
          where: {
            testSessionId_toolCallId: {
              testSessionId: sessionId,
              toolCallId,
            },
          },
          data: {
            status: "SUCCEEDED",
            outputJson: result.data,
            durationMs,
            completedAt: new Date(),
          },
        });

        // Audit Log
        await prisma.auditLog.create({
          data: {
            workspaceId: session.workspaceId,
            actorType: "AI_RECEPTIONIST",
            actorUserId,
            action: "receptionist.tool.succeeded",
            resourceType: "tool_execution",
            resourceId: toolCallId,
            metadata: {
              toolName,
              receptionistId: session.receptionistId,
              testSessionId: sessionId,
              durationMs,
            },
          },
        });

        return result;
      } else {
        await prisma.receptionistToolExecution.update({
          where: {
            testSessionId_toolCallId: {
              testSessionId: sessionId,
              toolCallId,
            },
          },
          data: {
            status: "FAILED",
            errorCode: result.error.code,
            errorMessageSafe: result.error.message,
            durationMs,
            completedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            workspaceId: session.workspaceId,
            actorType: "AI_RECEPTIONIST",
            actorUserId,
            action: "receptionist.tool.failed",
            resourceType: "tool_execution",
            resourceId: toolCallId,
            metadata: {
              toolName,
              errorCode: result.error.code,
              testSessionId: sessionId,
            },
          },
        });

        return result;
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err.message === "TOOL_EXECUTION_TIMEOUT";
      const errorCode = isTimeout ? "TOOL_EXECUTION_TIMEOUT" : "TOOL_EXECUTION_FAILED";
      const errorMessage = isTimeout
        ? "Tool operation timed out on the server."
        : "An unexpected error occurred while executing the business action.";

      await prisma.receptionistToolExecution.update({
        where: {
          testSessionId_toolCallId: {
            testSessionId: sessionId,
            toolCallId,
          },
        },
        data: {
          status: "FAILED",
          errorCode,
          errorMessageSafe: errorMessage,
          durationMs,
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }
}
