import { prisma } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  createLeadToolSchema,
  updateLeadToolSchema,
  CreateLeadToolInput,
  UpdateLeadToolInput,
} from "@receptionai/validation";

export const createLeadTool: ToolDefinition<CreateLeadToolInput> = {
  name: "create_lead",
  description:
    "Record a new business sales lead or patient inquiry when a caller expresses interest in services or scheduling. Requires an existing contactId.",
  capability: "CAPTURE_LEADS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: false,
  inputSchema: createLeadToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: CreateLeadToolInput
  ): Promise<NormalizedToolResult> {
    // 1. Verify contact belongs to same workspace
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

    // 2. Duplicate lead check: same contact, same intent, created in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingLead = await prisma.lead.findFirst({
      where: {
        workspaceId: context.workspaceId,
        contactId: input.contactId,
        intent: { equals: input.intent.trim(), mode: "insensitive" },
        status: { in: ["NEW", "QUALIFIED", "CONTACTED"] },
        createdAt: { gte: oneDayAgo },
        archivedAt: null,
      },
    });

    if (existingLead) {
      return {
        success: true,
        data: {
          leadId: existingLead.id,
          status: existingLead.status,
          intent: existingLead.intent,
          isExisting: true,
          message: "An active lead for this service already exists for this caller.",
        },
      };
    }

    // 3. Create lead
    const lead = await prisma.lead.create({
      data: {
        workspaceId: context.workspaceId,
        contactId: input.contactId,
        receptionistId: context.receptionistId,
        testSessionId: context.testSessionId,
        status: "NEW",
        source: "VOICE_RECEPTIONIST",
        intent: input.intent.trim(),
        qualification: input.qualification?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return {
      success: true,
      data: {
        leadId: lead.id,
        status: lead.status,
        intent: lead.intent,
        isExisting: false,
      },
    };
  },
};

export const updateLeadTool: ToolDefinition<UpdateLeadToolInput> = {
  name: "update_lead",
  description:
    "Update an existing lead with additional qualification notes or intent details gathered during the conversation.",
  capability: "CAPTURE_LEADS",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: false,
  inputSchema: updateLeadToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: UpdateLeadToolInput
  ): Promise<NormalizedToolResult> {
    const lead = await prisma.lead.findFirst({
      where: {
        id: input.leadId,
        workspaceId: context.workspaceId,
        archivedAt: null,
      },
    });

    if (!lead) {
      return {
        success: false,
        error: {
          code: "LEAD_NOT_FOUND",
          message: "The requested lead was not found.",
        },
      };
    }

    const updateData: any = {};
    if (input.intent !== undefined) updateData.intent = input.intent.trim();
    if (input.qualification !== undefined)
      updateData.qualification = input.qualification.trim();
    if (input.notes !== undefined) updateData.notes = input.notes.trim();

    const updated = await prisma.lead.update({
      where: { id: input.leadId },
      data: updateData,
    });

    return {
      success: true,
      data: {
        leadId: updated.id,
        status: updated.status,
        intent: updated.intent,
      },
    };
  },
};
