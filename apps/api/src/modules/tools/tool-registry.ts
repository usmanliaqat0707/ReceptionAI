import { ZodTypeAny } from "zod";

export type ToolSideEffect = "NONE" | "READ" | "WRITE";

export interface ToolExecutionContext {
  workspaceId: string;
  receptionistId: string;
  configurationVersion: number;
  testSessionId: string;
  userId: string;
  actorType: "AI_RECEPTIONIST";
  requestId: string;
  toolCallId: string;
}

export type NormalizedToolSuccess<T = any> = {
  success: true;
  data: T;
};

export type NormalizedToolError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
};

export type NormalizedToolResult<T = any> =
  | NormalizedToolSuccess<T>
  | NormalizedToolError;

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  capability: string; // matches Receptionist objective, e.g. "ANSWER_QUESTIONS"
  sideEffect: ToolSideEffect;
  requiresIdempotency: boolean;
  requiresConfirmation: boolean;
  inputSchema: ZodTypeAny;
  execute(
    context: ToolExecutionContext,
    input: TInput
  ): Promise<NormalizedToolResult<TOutput>>;
}

// Global registry of server-side tool implementations
export const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(definition: ToolDefinition) {
  toolRegistry.set(definition.name, definition);
}

// Import handlers and register
import { getBusinessInformationTool } from "./handlers/business-info.handler";
import { getBusinessHoursTool } from "./handlers/business-hours.handler";
import {
  findContactTool,
  createContactTool,
  updateContactTool,
} from "./handlers/contact.handlers";
import { createLeadTool, updateLeadTool } from "./handlers/lead.handlers";
import { takeMessageTool, requestCallbackTool } from "./handlers/message.handlers";
import { searchKnowledgeBaseTool } from "./handlers/search-knowledge.handler";
import {
  findServiceTool,
  checkAvailabilityTool,
  getAppointmentTool,
  bookAppointmentTool,
  rescheduleAppointmentTool,
  cancelAppointmentTool,
} from "./handlers/appointment.handlers";
import {
  sendSmsTool,
  sendEmailTool,
} from "./handlers/communication.handlers";

registerTool(getBusinessInformationTool);
registerTool(getBusinessHoursTool);
registerTool(findContactTool);
registerTool(createContactTool);
registerTool(updateContactTool);
registerTool(createLeadTool);
registerTool(updateLeadTool);
registerTool(takeMessageTool);
registerTool(requestCallbackTool);
registerTool(searchKnowledgeBaseTool);
registerTool(findServiceTool);
registerTool(checkAvailabilityTool);
registerTool(getAppointmentTool);
registerTool(bookAppointmentTool);
registerTool(rescheduleAppointmentTool);
registerTool(cancelAppointmentTool);
registerTool(sendSmsTool);
registerTool(sendEmailTool);

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export const CAPABILITY_TO_TOOLS: Record<string, string[]> = {
  ANSWER_QUESTIONS: [
    "get_business_information",
    "get_business_hours",
    "search_knowledge_base",
  ],
  KNOWLEDGE_SEARCH: ["search_knowledge_base"],
  COLLECT_CUSTOMER_INFORMATION: ["find_contact", "create_contact", "update_contact"],
  CAPTURE_LEADS: [
    "find_contact",
    "create_contact",
    "create_lead",
    "update_lead",
    "send_sms",
    "send_email",
  ],
  TAKE_MESSAGES: [
    "find_contact",
    "create_contact",
    "take_message",
    "send_sms",
    "send_email",
  ],
  HANDLE_AFTER_HOURS: [
    "get_business_hours",
    "take_message",
    "request_callback",
    "send_sms",
  ],
  SCHEDULE_APPOINTMENTS: [
    "find_service",
    "check_availability",
    "get_appointment",
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "find_contact",
    "create_contact",
    "send_sms",
    "send_email",
  ],
  SEND_COMMUNICATIONS: [
    "find_contact",
    "send_sms",
    "send_email",
  ],
};

export function getAllowedToolsForObjectives(objectives: string[]): ToolDefinition[] {
  const allowedNames = new Set<string>();
  for (const obj of objectives) {
    const tools = CAPABILITY_TO_TOOLS[obj] || [];
    for (const tool of tools) {
      allowedNames.add(tool);
    }
  }

  const result: ToolDefinition[] = [];
  for (const name of allowedNames) {
    const def = toolRegistry.get(name);
    if (def) {
      result.push(def);
    }
  }
  return result;
}
