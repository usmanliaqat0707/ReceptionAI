import { tool } from "@openai/agents/realtime";
import { z } from "zod";

export interface ToolExecutionEvent {
  id: string;
  toolCallId: string;
  toolName: string;
  arguments: any;
  status: "EXECUTING" | "SUCCEEDED" | "FAILED";
  result?: any;
  error?: any;
  durationMs?: number;
  timestamp: string;
}

export interface ClientToolsOptions {
  sessionId: string;
  apiBaseUrl?: string;
  allowedToolNames?: string[];
  onExecutionUpdate?: (event: ToolExecutionEvent) => void;
}

/**
 * Creates the real client-side tool definitions that forward calls to the
 * trusted backend gateway via authenticated session cookies.
 */
export function createBrowserRealtimeTools(options: ClientToolsOptions) {
  const {
    sessionId,
    apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "",
    allowedToolNames,
    onExecutionUpdate,
  } = options;

  async function executeOnServer(toolName: string, args: any): Promise<string> {
    const startTime = Date.now();
    const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventId = `evt_${toolCallId}`;

    onExecutionUpdate?.({
      id: eventId,
      toolCallId,
      toolName,
      arguments: args,
      status: "EXECUTING",
      timestamp: new Date().toISOString(),
    });

    try {
      const url = apiBaseUrl
        ? `${apiBaseUrl}/api/v1/realtime-test-sessions/${sessionId}/tools/execute`
        : `/api/v1/realtime-test-sessions/${sessionId}/tools/execute`;
      const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            toolCallId,
            toolName,
            arguments: args,
          }),
        }
      );

      const data = await res.json();
      const durationMs = Date.now() - startTime;

      if (data.success) {
        onExecutionUpdate?.({
          id: eventId,
          toolCallId,
          toolName,
          arguments: args,
          status: "SUCCEEDED",
          result: data.data,
          durationMs,
          timestamp: new Date().toISOString(),
        });
        return JSON.stringify(data.data);
      } else {
        onExecutionUpdate?.({
          id: eventId,
          toolCallId,
          toolName,
          arguments: args,
          status: "FAILED",
          error: data.error,
          durationMs,
          timestamp: new Date().toISOString(),
        });
        return JSON.stringify({
          error: data.error?.message || "Tool execution failed on the server.",
          code: data.error?.code || "TOOL_FAILED",
        });
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      onExecutionUpdate?.({
        id: eventId,
        toolCallId,
        toolName,
        arguments: args,
        status: "FAILED",
        error: { message: err.message || "Network error" },
        durationMs,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify({
        error: "Failed to connect to the ReceptionAI server.",
        code: "GATEWAY_CONNECTION_ERROR",
      });
    }
  }

  const allTools = [
    (tool as any)({
      name: "get_business_information",
      description:
        "Retrieve authoritative public business information such as company name, official phone number, website, office address, and description. Use this when the caller asks about the business.",
      parameters: z.object({
        fields: z.array(z.string()).optional(),
      }),
      execute: async (args: any) => executeOnServer("get_business_information", args),
    }),

    (tool as any)({
      name: "get_business_hours",
      description:
        "Retrieve authoritative operating schedule and open/closed status for today or a specific date. Use when caller asks if the business is open or what hours the office operates.",
      parameters: z.object({
        date: z.string().optional().describe("Optional date in YYYY-MM-DD format"),
      }),
      execute: async (args: any) => executeOnServer("get_business_hours", args),
    }),

    (tool as any)({
      name: "find_contact",
      description:
        "Look up an existing contact record by authoritative phone number or email address. Use this to recognize returning callers.",
      parameters: z.object({
        phone: z.string().optional().describe("Caller phone number"),
        email: z.string().optional().describe("Caller email address"),
      }),
      execute: async (args: any) => executeOnServer("find_contact", args),
    }),

    (tool as any)({
      name: "create_contact",
      description:
        "Create a new contact record after collecting caller name and phone or email. Never call this without at least a first name and phone or email.",
      parameters: z.object({
        firstName: z.string().describe("Caller's first name"),
        lastName: z.string().optional().describe("Caller's last name"),
        phone: z.string().optional().describe("Caller's phone number"),
        email: z.string().optional().describe("Caller's email address"),
        company: z.string().optional().describe("Caller's company name"),
        notes: z.string().optional().describe("Relevant context notes"),
      }),
      execute: async (args: any) => executeOnServer("create_contact", args),
    }),

    (tool as any)({
      name: "update_contact",
      description:
        "Update an existing contact's details (e.g. name, company, notes). Updating phone or email requires caller confirmation.",
      parameters: z.object({
        contactId: z.string().describe("Existing contact ID to update"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        company: z.string().optional(),
        confirmationId: z.string().optional().describe("Confirmation ID for phone/email update"),
      }),
      execute: async (args: any) => executeOnServer("update_contact", args),
    }),

    (tool as any)({
      name: "create_lead",
      description:
        "Record a new business sales lead or patient inquiry when a caller expresses interest in services or scheduling. Requires an existing contactId.",
      parameters: z.object({
        contactId: z.string().describe("ID of the contact who expressed interest"),
        intent: z.string().describe("Specific reason or service the caller wants"),
        qualification: z.string().optional().describe("Qualification details like budget, timing, insurance"),
        notes: z.string().optional().describe("Additional conversational notes"),
      }),
      execute: async (args: any) => executeOnServer("create_lead", args),
    }),

    (tool as any)({
      name: "update_lead",
      description:
        "Update an existing lead with additional qualification notes or intent details gathered during the conversation.",
      parameters: z.object({
        leadId: z.string().describe("ID of the existing lead to update"),
        intent: z.string().optional(),
        qualification: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (args: any) => executeOnServer("update_lead", args),
    }),

    (tool as any)({
      name: "take_message",
      description:
        "Take a structured message from a caller for the staff when an inquiry cannot be answered or staff is unavailable. Requires contactId.",
      parameters: z.object({
        contactId: z.string().describe("ID of the caller contact"),
        subject: z.string().describe("Short subject line for the message"),
        message: z.string().describe("Detailed message body"),
        urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
      }),
      execute: async (args: any) => executeOnServer("take_message", args),
    }),

    (tool as any)({
      name: "request_callback",
      description:
        "Record a request for the office staff to call the caller back, with an optional preferred date, time, or general window (MORNING, AFTERNOON, EVENING).",
      parameters: z.object({
        contactId: z.string().describe("ID of the caller contact"),
        subject: z.string().optional().describe("Subject of the callback"),
        message: z.string().optional().describe("Callback context or question"),
        requestedCallbackAt: z.string().optional().describe("Specific ISO timestamp requested"),
        requestedCallbackWindow: z
          .enum(["MORNING", "AFTERNOON", "EVENING", "ANYTIME"])
          .optional()
          .default("ANYTIME"),
        urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional().default("NORMAL"),
      }),
      execute: async (args: any) => executeOnServer("request_callback", args),
    }),

    (tool as any)({
      name: "search_knowledge_base",
      description:
        "Search the receptionist's approved business knowledge base for factual information regarding business services, procedures, pricing, and policies. Use this when the answer is not already available from structured business info or business hours.",
      parameters: z.object({
        query: z.string().describe("The specific factual question or search query"),
        maxResults: z.number().optional().default(4).describe("Maximum number of knowledge chunks to return"),
      }),
      execute: async (args: any) => executeOnServer("search_knowledge_base", args),
    }),
  ];

  if (!allowedToolNames || allowedToolNames.length === 0) {
    return allTools;
  }

  const allowedSet = new Set(allowedToolNames);
  return allTools.filter((t) => allowedSet.has(t.name));
}
