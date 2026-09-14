import { prisma } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  findContactToolSchema,
  createContactToolSchema,
  updateContactToolSchema,
  FindContactToolInput,
  CreateContactToolInput,
  UpdateContactToolInput,
  normalizePhoneNumber,
} from "@receptionai/validation";

export const findContactTool: ToolDefinition<FindContactToolInput> = {
  name: "find_contact",
  description:
    "Look up an existing contact record by authoritative phone number or email address. Use this to recognize returning callers.",
  capability: "COLLECT_CUSTOMER_INFORMATION",
  sideEffect: "NONE",
  requiresIdempotency: false,
  requiresConfirmation: false,
  inputSchema: findContactToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: FindContactToolInput
  ): Promise<NormalizedToolResult> {
    const normalizedPhone = normalizePhoneNumber(input.phone);
    const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

    if (!normalizedPhone && !normalizedEmail) {
      return {
        success: false,
        error: {
          code: "INVALID_LOOKUP_PARAMETERS",
          message: "A valid phone number or email must be provided to find a contact.",
        },
      };
    }

    const whereConditions: any[] = [];
    if (normalizedPhone) {
      whereConditions.push({ normalizedPhone });
    }
    if (normalizedEmail) {
      whereConditions.push({ normalizedEmail });
    }

    const contact = await prisma.contact.findFirst({
      where: {
        workspaceId: context.workspaceId,
        archivedAt: null,
        OR: whereConditions,
      },
    });

    if (!contact) {
      return {
        success: true,
        data: {
          found: false,
        },
      };
    }

    return {
      success: true,
      data: {
        found: true,
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
          company: contact.company,
        },
      },
    };
  },
};

export const createContactTool: ToolDefinition<CreateContactToolInput> = {
  name: "create_contact",
  description:
    "Create a new contact record after collecting caller name and phone or email. Never call this without at least a first name and phone or email.",
  capability: "COLLECT_CUSTOMER_INFORMATION",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: false,
  inputSchema: createContactToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: CreateContactToolInput
  ): Promise<NormalizedToolResult> {
    const normalizedPhone = normalizePhoneNumber(input.phone);
    const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

    if (!normalizedPhone && !normalizedEmail) {
      return {
        success: false,
        error: {
          code: "INVALID_CONTACT_DETAILS",
          message: "A valid phone number or email address is required to create a contact.",
        },
      };
    }

    // Duplicate check: check if contact with normalized phone or email already exists
    const existing = await prisma.contact.findFirst({
      where: {
        workspaceId: context.workspaceId,
        archivedAt: null,
        OR: [
          ...(normalizedPhone ? [{ normalizedPhone }] : []),
          ...(normalizedEmail ? [{ normalizedEmail }] : []),
        ],
      },
    });

    if (existing) {
      return {
        success: true,
        data: {
          contactId: existing.id,
          firstName: existing.firstName,
          lastName: existing.lastName,
          isExisting: true,
          message: "Existing contact found and matched.",
        },
      };
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId: context.workspaceId,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        phone: input.phone || null,
        normalizedPhone,
        email: input.email?.trim() || null,
        normalizedEmail,
        company: input.company?.trim() || null,
        source: "VOICE_RECEPTIONIST",
        notes: input.notes?.trim() || null,
      },
    });

    return {
      success: true,
      data: {
        contactId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        isExisting: false,
      },
    };
  },
};

export const updateContactTool: ToolDefinition<UpdateContactToolInput> = {
  name: "update_contact",
  description:
    "Update an existing contact's details (e.g. name, company, notes). Updating phone or email requires caller confirmation.",
  capability: "COLLECT_CUSTOMER_INFORMATION",
  sideEffect: "WRITE",
  requiresIdempotency: true,
  requiresConfirmation: true,
  inputSchema: updateContactToolSchema,
  async execute(
    context: ToolExecutionContext,
    input: UpdateContactToolInput
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
          message: "The requested contact was not found.",
        },
      };
    }

    const updateData: any = {};
    if (input.firstName !== undefined) updateData.firstName = input.firstName.trim();
    if (input.lastName !== undefined) updateData.lastName = input.lastName.trim();
    if (input.company !== undefined) updateData.company = input.company.trim();

    if (input.phone !== undefined) {
      updateData.phone = input.phone;
      updateData.normalizedPhone = normalizePhoneNumber(input.phone);
    }
    if (input.email !== undefined) {
      updateData.email = input.email.trim();
      updateData.normalizedEmail = input.email.trim().toLowerCase();
    }

    const updated = await prisma.contact.update({
      where: { id: input.contactId },
      data: updateData,
    });

    return {
      success: true,
      data: {
        contactId: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
      },
    };
  },
};
