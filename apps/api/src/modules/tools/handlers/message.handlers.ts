import { prisma, CallbackWindow } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  takeMessageToolSchema,
  requestCallbackToolSchema,
  TakeMessageToolInput,
  RequestCallbackToolInput,
} from "@receptionai/validation";

export const takeMessageTool: ToolDefinition<TakeMessageToolInput> = {
  name: "take_message",
  description:
    "Take a structured message from a caller for the staff when an inquiry cannot be answered or staff is unavailable. Requires contactId.",
  capability: "TAKE_MESSAGES",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: false,
  inputSchema: takeMessageToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: TakeMessageToolInput
  ): Promise<NormalizedToolResult> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: input.contactId,
        workspaceId: context.workspaceId,
        archivedAt: null,
      },
    });

    if (!contact) {
      return {
        success: false,
        error: {
          code: "CONTACT_NOT_FOUND",
          message: "The specified contact does not exist in this workspace.",
        },
      };
    }

    const message = await prisma.receptionistMessage.create({
      data: {
        workspaceId: context.workspaceId,
        contactId: input.contactId,
        receptionistId: context.receptionistId,
        testSessionId: context.testSessionId,
        subject: input.subject.trim(),
        body: input.message.trim(),
        urgency: input.urgency,
        callbackRequested: false,
        status: "NEW",
      },
    });

    return {
      success: true,
      data: {
        messageId: message.id,
        status: message.status,
        subject: message.subject,
      },
    };
  },
};

export const requestCallbackTool: ToolDefinition<RequestCallbackToolInput> = {
  name: "request_callback",
  description:
    "Record a request for the office staff to call the caller back, with an optional preferred date, time, or general window (MORNING, AFTERNOON, EVENING).",
  capability: "HANDLE_AFTER_HOURS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: false,
  inputSchema: requestCallbackToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: RequestCallbackToolInput
  ): Promise<NormalizedToolResult> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: input.contactId,
        workspaceId: context.workspaceId,
        archivedAt: null,
      },
    });

    if (!contact) {
      return {
        success: false,
        error: {
          code: "CONTACT_NOT_FOUND",
          message: "The specified contact does not exist in this workspace.",
        },
      };
    }

    const callbackWindow: CallbackWindow = (input.requestedCallbackWindow as CallbackWindow) || "ANYTIME";

    const message = await prisma.receptionistMessage.create({
      data: {
        workspaceId: context.workspaceId,
        contactId: input.contactId,
        receptionistId: context.receptionistId,
        testSessionId: context.testSessionId,
        subject: input.subject?.trim() || "Callback Requested",
        body: input.message?.trim() || `Caller requested a callback during ${callbackWindow}.`,
        urgency: input.urgency,
        callbackRequested: true,
        requestedCallbackAt: input.requestedCallbackAt
          ? new Date(input.requestedCallbackAt)
          : null,
        requestedCallbackWindow: callbackWindow,
        status: "NEW",
      },
    });

    return {
      success: true,
      data: {
        messageId: message.id,
        callbackRequested: true,
        requestedCallbackWindow: message.requestedCallbackWindow,
        subject: message.subject,
      },
    };
  },
};
