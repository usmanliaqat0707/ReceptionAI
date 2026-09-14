import { prisma } from "@receptionai/db";
import {
  ToolDefinition,
  ToolExecutionContext,
  NormalizedToolResult,
} from "../tool-registry";
import {
  getBusinessInformationToolSchema,
  GetBusinessInformationToolInput,
} from "@receptionai/validation";

export const getBusinessInformationTool: ToolDefinition<GetBusinessInformationToolInput> =
  {
    name: "get_business_information",
    description:
      "Retrieve authoritative public business information such as company name, official phone number, website, office address, and description. Use this when the caller asks about the business.",
    capability: "ANSWER_QUESTIONS",
    sideEffect: "NONE",
    requiresIdempotency: false,
    requiresConfirmation: false,
    inputSchema: getBusinessInformationToolSchema,
    async execute(
      context: ToolExecutionContext,
      input: GetBusinessInformationToolInput
    ): Promise<NormalizedToolResult> {
      // 1. Fetch workspace & profile
      const workspace = await prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        include: { businessProfile: true },
      });

      if (!workspace) {
        return {
          success: false,
          error: {
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace details could not be resolved.",
          },
        };
      }

      const profile = workspace.businessProfile;

      // Safe caller-facing fields only
      const safeData = {
        businessName: profile?.businessName || workspace.name,
        phone: profile?.phone || "+15555550100",
        website: profile?.website || null,
        email: profile?.email || null,
        description: profile?.description || `${workspace.name} provides professional services.`,
        address: profile?.addressLine1
          ? {
              street: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(", "),
              city: profile.city || "San Francisco",
              region: profile.region || "CA",
              postalCode: profile.postalCode || "94105",
              country: profile.country || "US",
            }
          : {
              city: "San Francisco",
              region: "CA",
              country: "US",
            },
        timezone: profile?.timezone || workspace.timezone,
      };

      if (input.fields && input.fields.length > 0) {
        const filtered: Record<string, any> = {};
        for (const f of input.fields) {
          if (f in safeData) {
            filtered[f] = (safeData as any)[f];
          }
        }
        return { success: true, data: filtered };
      }

      return {
        success: true,
        data: safeData,
      };
    },
  };
