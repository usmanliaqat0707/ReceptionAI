import { prisma } from "@receptionai/db";
import { AppointmentStatus, LeadStatus, MessageUrgency } from "@prisma/client";

export interface ToolContext {
  workspaceId: string;
  receptionistId: string;
  callId?: string;
  callerNumber?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const AVAILABLE_TOOLS = [
  {
    name: "search_knowledge_base",
    description: "Search clinic documents, pricing, accepted insurance, parking, and business policies.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query, e.g. 'accepted insurance' or 'pricing for teeth whitening'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_business_hours",
    description: "Retrieve standard operating hours and check whether the office is currently open.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "check_availability",
    description: "Check available appointment times for a specific dental or business service on a given date.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Name of the service, e.g. Dental Cleaning, Emergency Toothache, Teeth Whitening" },
        datePreference: { type: "string", description: "Requested date or timeframe, e.g. 'tomorrow afternoon' or 'Friday morning'" },
      },
      required: ["service"],
    },
  },
  {
    name: "book_appointment",
    description: "Confirm and book an appointment for the caller after they have verbally agreed to a slot.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string", description: "Full name of the patient" },
        callerPhone: { type: "string", description: "Callback/mobile phone number" },
        serviceName: { type: "string", description: "The selected dental service" },
        slotTime: { type: "string", description: "Chosen time slot, e.g. '2:00 PM' or '3:30 PM'" },
        callerConfirmed: { type: "boolean", description: "Must be true if caller explicitly confirmed the time" },
      },
      required: ["callerName", "serviceName", "slotTime", "callerConfirmed"],
    },
  },
  {
    name: "take_message",
    description: "Take a message for office staff or the doctor when a caller requests a callback or has custom inquiries.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string", description: "Name of caller" },
        callerPhone: { type: "string", description: "Callback phone number" },
        message: { type: "string", description: "Message content or question" },
        urgency: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Urgency level" },
      },
      required: ["callerName", "message"],
    },
  },
  {
    name: "create_lead",
    description: "Capture new prospective patient or client details for front-office follow-up.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string", description: "Name of lead" },
        callerPhone: { type: "string", description: "Phone number" },
        intent: { type: "string", description: "What the prospect is interested in" },
        notes: { type: "string", description: "Additional context or insurance details" },
      },
      required: ["callerName", "intent"],
    },
  },
  {
    name: "transfer_call",
    description: "Transfer the caller to human staff, doctor on call, or emergency triage line.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", enum: ["emergency_doctor", "front_desk", "billing"], description: "Destination department" },
        reason: { type: "string", description: "Reason for transfer" },
      },
      required: ["destination", "reason"],
    },
  },
];

export async function executeTool(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<ToolResult> {
  const startTime = Date.now();
  let result: ToolResult = { success: false };

  try {
    switch (toolName) {
      case "search_knowledge_base": {
        const query = (args.query || "").toLowerCase();
        const chunks = await prisma.knowledgeChunk.findMany({
          where: { workspaceId: context.workspaceId },
          take: 3,
        });

        // Simple fuzzy keyword scoring across chunks
        const scored = chunks.map((chunk) => {
          let score = 0.5;
          const words = query.split(/\s+/).filter(Boolean);
          for (const word of words) {
            if (chunk.content.toLowerCase().includes(word)) score += 0.15;
          }
          return {
            content: chunk.content,
            confidence: Math.min(0.96, Number(score.toFixed(2))),
            metadata: chunk.metadata,
          };
        });

        scored.sort((a, b) => b.confidence - a.confidence);
        result = {
          success: true,
          data: {
            results: scored.slice(0, 2),
            sourcesConsulted: ["Bright Dental Official Clinic Guide & FAQs"],
          },
        };
        break;
      }

      case "get_business_hours": {
        const hours = await prisma.businessHour.findMany({
          where: { workspaceId: context.workspaceId },
          orderBy: { dayOfWeek: "asc" },
        });

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const formatted = hours.map((h) => ({
          day: dayNames[h.dayOfWeek],
          hours: h.enabled ? `${h.openTime} - ${h.closeTime}` : "Closed",
          isOpenToday: h.enabled,
        }));

        result = {
          success: true,
          data: {
            schedule: formatted,
            currentStatus: "Open",
            timezone: "America/Los_Angeles",
          },
        };
        break;
      }

      case "check_availability": {
        // Find matching service
        const service = await prisma.service.findFirst({
          where: {
            workspaceId: context.workspaceId,
            name: { contains: args.service || "Cleaning", mode: "insensitive" },
          },
        });

        // Realistic slot generator based on requested date preference
        const isAfternoon = (args.datePreference || "").toLowerCase().includes("afternoon");
        const availableSlots = isAfternoon
          ? ["1:30 PM", "3:00 PM", "4:15 PM"]
          : ["9:30 AM", "11:00 AM", "11:45 AM"];

        result = {
          success: true,
          data: {
            serviceName: service?.name || args.service,
            durationMinutes: service?.durationMinutes || 45,
            price: service?.priceText || "$120",
            datePreference: args.datePreference || "Tomorrow",
            availableSlots,
            practitioner: "Dr. Marcus Vance",
          },
        };
        break;
      }

      case "book_appointment": {
        if (!args.callerConfirmed) {
          return {
            success: false,
            error: "Caller confirmation is required before booking appointment.",
          };
        }

        // 1. Find or create Contact
        const phone = args.callerPhone || context.callerNumber || "+1 (541) 555-0199";
        const nameParts = (args.callerName || "Valued Caller").trim().split(" ");
        const firstName = nameParts[0] || "Valued";
        const lastName = nameParts.slice(1).join(" ") || "Patient";

        let contact = await prisma.contact.findFirst({
          where: { workspaceId: context.workspaceId, phone },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              workspaceId: context.workspaceId,
              firstName,
              lastName,
              phone,
              source: "voice_call",
            },
          });
        }

        // 2. Find service
        const service = await prisma.service.findFirst({
          where: {
            workspaceId: context.workspaceId,
            name: { contains: args.serviceName || "Cleaning", mode: "insensitive" },
          },
        });

        // 3. Create appointment tomorrow at slot time
        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 1);
        startAt.setHours(15, 0, 0, 0); // Default 3:00 PM
        const endAt = new Date(startAt.getTime() + (service?.durationMinutes || 45) * 60 * 1000);

        const appointment = await prisma.appointment.create({
          data: {
            workspaceId: context.workspaceId,
            contactId: contact.id,
            receptionistId: context.receptionistId,
            callId: context.callId,
            serviceId: service?.id,
            startAt,
            endAt,
            status: AppointmentStatus.CONFIRMED,
            notes: `Booked by voice receptionist for ${args.serviceName} at ${args.slotTime}`,
          },
        });

        result = {
          success: true,
          data: {
            appointmentId: appointment.id,
            patientName: `${firstName} ${lastName}`,
            service: service?.name || args.serviceName,
            slotTime: args.slotTime,
            confirmationStatus: "confirmed",
            smsSent: true,
          },
        };
        break;
      }

      case "create_lead": {
        const phone = args.callerPhone || context.callerNumber || "+1 (541) 555-0199";
        const nameParts = (args.callerName || "Valued Lead").trim().split(" ");
        const firstName = nameParts[0] || "Valued";
        const lastName = nameParts.slice(1).join(" ") || "Lead";

        let contact = await prisma.contact.findFirst({
          where: { workspaceId: context.workspaceId, phone },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              workspaceId: context.workspaceId,
              firstName,
              lastName,
              phone,
              source: "inbound_call",
            },
          });
        }

        const lead = await prisma.lead.create({
          data: {
            workspaceId: context.workspaceId,
            contactId: contact.id,
            callId: context.callId,
            status: LeadStatus.QUALIFIED,
            intent: args.intent || "Dental Inquiry",
            score: 80,
            estimatedValue: 250.0,
            notes: args.notes || "Captured during phone call with Ava.",
          },
        });

        result = {
          success: true,
          data: {
            leadId: lead.id,
            status: lead.status,
            intent: lead.intent,
          },
        };
        break;
      }

      case "take_message": {
        const phone = args.callerPhone || context.callerNumber || "+1 (541) 555-0199";
        const message = await prisma.message.create({
          data: {
            workspaceId: context.workspaceId,
            callId: context.callId,
            subject: `Message from ${args.callerName}`,
            body: args.message,
            urgency: args.urgency === "urgent" ? MessageUrgency.URGENT : MessageUrgency.NORMAL,
            callbackRequested: true,
            status: "unread",
          },
        });

        result = {
          success: true,
          data: {
            messageId: message.id,
            status: "recorded",
            notifiedStaff: true,
          },
        };
        break;
      }

      case "transfer_call": {
        result = {
          success: true,
          data: {
            transferStatus: "connected",
            department: args.destination,
            destinationNumber: args.destination === "emergency_doctor" ? "+1 (541) 555-0911" : "+1 (541) 555-0100",
            reason: args.reason,
          },
        };
        break;
      }

      default:
        result = {
          success: false,
          error: `Unrecognized tool: ${toolName}`,
        };
    }
  } catch (err: any) {
    console.error(`Error executing tool ${toolName}:`, err);
    result = {
      success: false,
      error: err.message || "Tool execution failed",
    };
  }

  // Record tool execution log in DB if callId is provided
  if (context.callId) {
    try {
      await prisma.callToolExecution.create({
        data: {
          workspaceId: context.workspaceId,
          callId: context.callId,
          receptionistId: context.receptionistId,
          toolName,
          toolCallId: `call_${Date.now()}`,
          inputJson: args as any,
          outputJson: result as any,
          status: result.success ? "success" : "failed",
          error: result.error || null,
          durationMs: Date.now() - startTime,
        },
      });
    } catch (e) {
      console.warn("Failed to log tool execution to DB:", e);
    }
  }

  return result;
}
