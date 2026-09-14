import { z } from "zod";
import {
  WORKSPACE_ROLES,
  PERSONALITY_TRAITS,
  RECEPTIONIST_OBJECTIVES,
  SPEAKING_STYLES,
  SPEAKING_RATES,
  RESPONSE_PACING,
  SILENCE_HANDLING,
  UNKNOWN_ANSWER_BEHAVIOR,
  AFTER_HOURS_MODES,
} from "@receptionai/config";

// Authentication Schemas
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address format")
  .max(255, "Email is too long");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Workspace Schemas
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(100),
  industry: z
    .string()
    .trim()
    .min(2, "Industry must be specified")
    .max(100)
    .default("General Business"),
  timezone: z.string().trim().min(2, "Timezone is required").default("America/New_York"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100)
    .optional(),
  industry: z.string().trim().min(2).max(100).optional(),
  timezone: z.string().trim().min(2).optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// Member & Invitation Schemas
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(WORKSPACE_ROLES),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// Security Schemas
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// E.164 Phone Number Schema
export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{6,14}$/,
    "Phone number must be valid E.164 format starting with '+' followed by 7-15 digits (e.g. +15555550100)"
  );

// Receptionist Schemas
export const createReceptionistSchema = z.object({
  name: z.string().trim().min(2, "Receptionist name must be at least 2 characters").max(100),
  roleTitle: z
    .string()
    .trim()
    .min(2, "Role title is required")
    .max(100)
    .default("Front Desk Receptionist"),
  industry: z.string().trim().default("GENERAL"),
  primaryLanguage: z.string().trim().default("en-US"),
  template: z.string().trim().optional(),
});

export type CreateReceptionistInput = z.infer<typeof createReceptionistSchema>;

export const updateReceptionistIdentitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Receptionist name must be at least 2 characters")
    .max(100)
    .optional(),
  roleTitle: z.string().trim().min(2, "Role title is required").max(100).optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .nullable()
    .optional(),
  industry: z.string().trim().optional(),
  primaryLanguage: z.string().trim().optional(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateReceptionistIdentityInput = z.infer<typeof updateReceptionistIdentitySchema>;

export const updateVoiceConfigSchema = z.object({
  speakingStyle: z.enum(SPEAKING_STYLES).default("professional"),
  speakingRate: z.enum(SPEAKING_RATES).default("normal"),
  responsePacing: z.enum(RESPONSE_PACING).default("balanced"),
  provider: z.string().nullable().optional(),
  voiceId: z.string().nullable().optional(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateVoiceConfigInput = z.infer<typeof updateVoiceConfigSchema>;

export const updatePersonalitySchema = z.object({
  traits: z
    .array(z.enum(PERSONALITY_TRAITS))
    .max(6, "Cannot select more than 6 personality traits"),
  expectedVersion: z.number().int().positive(),
});

export type UpdatePersonalityInput = z.infer<typeof updatePersonalitySchema>;

export const updateGreetingSchema = z.object({
  greeting: z
    .string()
    .trim()
    .max(600, "Greeting cannot exceed 600 characters")
    .nullable()
    .optional(),
  afterHoursGreeting: z
    .string()
    .trim()
    .max(600, "After-hours greeting cannot exceed 600 characters")
    .nullable()
    .optional(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateGreetingInput = z.infer<typeof updateGreetingSchema>;

export const updateInstructionsSchema = z.object({
  instructions: z
    .string()
    .max(8000, "Instructions cannot exceed 8,000 characters")
    .nullable()
    .optional(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateInstructionsInput = z.infer<typeof updateInstructionsSchema>;

export const updateObjectivesSchema = z.object({
  objectives: z.array(z.enum(RECEPTIONIST_OBJECTIVES)),
  expectedVersion: z.number().int().positive(),
});

export type UpdateObjectivesInput = z.infer<typeof updateObjectivesSchema>;

export const updateBehaviorSchema = z.object({
  responseLength: z.enum(RESPONSE_PACING).default("balanced"),
  askOneQuestionAtATime: z.boolean().default(true),
  confirmCriticalDetails: z.boolean().default(true),
  allowCallerInterruptions: z.boolean().default(true),
  silenceHandling: z.enum(SILENCE_HANDLING).default("PROMPT_ONCE"),
  silenceTimeoutSeconds: z.number().min(3).max(30).default(8),
  unknownAnswerBehavior: z.enum(UNKNOWN_ANSWER_BEHAVIOR).default("take_message"),
  expectedVersion: z.number().int().positive(),
});

export type UpdateBehaviorInput = z.infer<typeof updateBehaviorSchema>;

export const businessHourItemSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:MM format"),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:MM format"),
  enabled: z.boolean().default(true),
});

export const updateBusinessHoursSchema = z.object({
  businessHoursStrategy: z
    .enum(["USE_WORKSPACE_HOURS", "CUSTOM_HOURS", "ALWAYS_AVAILABLE"])
    .default("USE_WORKSPACE_HOURS"),
  customHours: z.array(businessHourItemSchema).optional().nullable(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>;

export const updateAfterHoursSchema = z.object({
  mode: z.enum(AFTER_HOURS_MODES).default("TAKE_MESSAGE"),
  useCustomGreeting: z.boolean().default(false),
  expectedVersion: z.number().int().positive(),
});

export type UpdateAfterHoursInput = z.infer<typeof updateAfterHoursSchema>;

export const updateEscalationSchema = z.object({
  onHumanRequest: z.boolean().default(true),
  onEmergency: z.boolean().default(true),
  onRepeatedFailure: z.boolean().default(true),
  onUnsupportedRequest: z.boolean().default(false),
  expectedVersion: z.number().int().positive(),
});

export type UpdateEscalationInput = z.infer<typeof updateEscalationSchema>;

export const changeReceptionistStatusSchema = z.object({
  status: z.enum(["DRAFT", "TESTING", "ACTIVE", "PAUSED", "ARCHIVED"]),
  expectedVersion: z.number().int().positive(),
});

export type ChangeReceptionistStatusInput = z.infer<typeof changeReceptionistStatusSchema>;

export const duplicateReceptionistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Receptionist name must be at least 2 characters")
    .max(100)
    .optional(),
});

export type DuplicateReceptionistInput = z.infer<typeof duplicateReceptionistSchema>;

// Transfer Destination Schemas
export const createTransferDestinationSchema = z.object({
  name: z.string().trim().min(2, "Destination name must be at least 2 characters").max(100),
  type: z.enum(["PHONE", "SIP", "INTERNAL_QUEUE"]).default("PHONE"),
  destination: z.string().trim().min(2, "Destination is required").max(255),
});

export type CreateTransferDestinationInput = z.infer<typeof createTransferDestinationSchema>;

export const updateTransferDestinationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  destination: z.string().trim().min(2).max(255).optional(),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).optional(),
});

export type UpdateTransferDestinationInput = z.infer<typeof updateTransferDestinationSchema>;

export const assignTransferDestinationsSchema = z.object({
  destinations: z.array(
    z.object({
      transferDestinationId: z.string().min(1),
      priority: z.number().int().min(1).default(1),
      purpose: z
        .enum(["GENERAL", "SALES", "SUPPORT", "EMERGENCY", "BILLING", "CUSTOM"])
        .default("GENERAL"),
      enabled: z.boolean().default(true),
    })
  ),
  expectedVersion: z.number().int().positive().optional(),
});

export type AssignTransferDestinationsInput = z.infer<typeof assignTransferDestinationsSchema>;

// Realtime Test Session Schemas
export const createRealtimeTestSessionSchema = z.object({
  metadata: z.record(z.any()).optional(),
});

export type CreateRealtimeTestSessionInput = z.infer<typeof createRealtimeTestSessionSchema>;

export const endRealtimeTestSessionSchema = z.object({
  disconnectReason: z.string().max(255).optional(),
  errorCode: z.string().max(100).optional(),
  clientDurationSeconds: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export type EndRealtimeTestSessionInput = z.infer<typeof endRealtimeTestSessionSchema>;

export const realtimeConversationItemSchema = z.object({
  providerItemId: z.string().max(255).optional().nullable(),
  sequence: z.number().int().nonnegative(),
  role: z.enum(["USER", "ASSISTANT"]),
  type: z.string().max(50).default("message"),
  text: z.string().max(10000),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const saveRealtimeTranscriptSchema = z.object({
  items: z.array(realtimeConversationItemSchema).max(500),
});

export type SaveRealtimeTranscriptInput = z.infer<typeof saveRealtimeTranscriptSchema>;

// Phone Normalization Helper
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhoneNumber(
  rawPhone?: string | null,
  defaultCountry: string = "US"
): string | null {
  if (!rawPhone || !rawPhone.trim()) return null;
  const cleaned = rawPhone.trim();
  try {
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as any);
    if (parsed && parsed.isValid()) {
      return parsed.number; // E.164 string format: +15555550100
    }
    const digitsOnly = cleaned.replace(/\D/g, "");
    if (cleaned.startsWith("+") && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length === 10 && (defaultCountry === "US" || defaultCountry === "CA")) {
      return `+1${digitsOnly}`;
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      return `+${digitsOnly}`;
    }
    return null;
  } catch {
    return null;
  }
}

// Phase 4 Realtime Tool Parameter Schemas
export const getBusinessInformationToolSchema = z.object({
  fields: z
    .array(
      z.enum([
        "businessName",
        "phone",
        "email",
        "website",
        "address",
        "timezone",
        "description",
      ])
    )
    .optional(),
});

export type GetBusinessInformationToolInput = z.infer<
  typeof getBusinessInformationToolSchema
>;

export const getBusinessHoursToolSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
    .optional(),
});

export type GetBusinessHoursToolInput = z.infer<typeof getBusinessHoursToolSchema>;

export const findContactToolSchema = z
  .object({
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().max(255).optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: "Either phone or email must be provided to find a contact",
  });

export type FindContactToolInput = z.infer<typeof findContactToolSchema>;

export const createContactToolSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().max(255).optional(),
    company: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: "Either phone or email must be provided for contact creation",
  });

export type CreateContactToolInput = z.infer<typeof createContactToolSchema>;

export const updateContactToolSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).optional(),
  company: z.string().trim().max(150).optional(),
  confirmationId: z.string().optional(),
});

export type UpdateContactToolInput = z.infer<typeof updateContactToolSchema>;

export const createLeadToolSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  intent: z.string().trim().min(2, "Intent is required").max(200),
  qualification: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateLeadToolInput = z.infer<typeof createLeadToolSchema>;

export const updateLeadToolSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  intent: z.string().trim().min(2).max(200).optional(),
  qualification: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type UpdateLeadToolInput = z.infer<typeof updateLeadToolSchema>;

export const takeMessageToolSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  subject: z.string().trim().min(2, "Subject is required").max(200),
  message: z.string().trim().min(2, "Message body is required").max(2000),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export type TakeMessageToolInput = z.infer<typeof takeMessageToolSchema>;

export const requestCallbackToolSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  requestedCallbackAt: z.string().datetime().optional(),
  requestedCallbackWindow: z
    .enum(["MORNING", "AFTERNOON", "EVENING", "ANYTIME"])
    .default("ANYTIME"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export type RequestCallbackToolInput = z.infer<typeof requestCallbackToolSchema>;

// Tool Execution Gateway Endpoint Schema
export const executeToolSchema = z.object({
  toolCallId: z.string().min(1, "Tool call ID is required").max(100),
  toolName: z.string().min(1, "Tool name is required").max(100),
  arguments: z.record(z.any()).default({}),
});

export type ExecuteToolInput = z.infer<typeof executeToolSchema>;

// Contacts REST API Schemas
export const createContactRestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  source: z
    .enum(["MANUAL", "VOICE_RECEPTIONIST", "IMPORT", "INTEGRATION", "OTHER"])
    .default("MANUAL"),
});

export type CreateContactRestInput = z.infer<typeof createContactRestSchema>;

export const updateContactRestSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateContactRestInput = z.infer<typeof updateContactRestSchema>;

export const queryContactsRestSchema = z.object({
  search: z.string().max(100).optional(),
  source: z
    .enum(["MANUAL", "VOICE_RECEPTIONIST", "IMPORT", "INTEGRATION", "OTHER"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryContactsRestInput = z.infer<typeof queryContactsRestSchema>;

// Leads REST API Schemas
export const createLeadRestSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  receptionistId: z.string().optional().nullable(),
  status: z
    .enum(["NEW", "QUALIFIED", "CONTACTED", "APPOINTMENT", "WON", "LOST", "ARCHIVED"])
    .default("NEW"),
  source: z
    .enum(["MANUAL", "VOICE_RECEPTIONIST", "IMPORT", "INTEGRATION", "WEB", "OTHER"])
    .default("MANUAL"),
  intent: z.string().trim().min(1, "Intent is required").max(200),
  qualification: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
});

export type CreateLeadRestInput = z.infer<typeof createLeadRestSchema>;

export const updateLeadRestSchema = z.object({
  status: z
    .enum(["NEW", "QUALIFIED", "CONTACTED", "APPOINTMENT", "WON", "LOST", "ARCHIVED"])
    .optional(),
  intent: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
});

export type UpdateLeadRestInput = z.infer<typeof updateLeadRestSchema>;

export const queryLeadsRestSchema = z.object({
  status: z
    .enum(["NEW", "QUALIFIED", "CONTACTED", "APPOINTMENT", "WON", "LOST", "ARCHIVED"])
    .optional(),
  contactId: z.string().optional(),
  receptionistId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryLeadsRestInput = z.infer<typeof queryLeadsRestSchema>;

// Messages REST API Schemas
export const updateMessageStatusRestSchema = z.object({
  status: z.enum(["NEW", "READ", "IN_PROGRESS", "RESOLVED", "ARCHIVED"]),
});

export type UpdateMessageStatusRestInput = z.infer<typeof updateMessageStatusRestSchema>;

export const queryMessagesRestSchema = z.object({
  status: z.enum(["NEW", "READ", "IN_PROGRESS", "RESOLVED", "ARCHIVED"]).optional(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  callbackRequested: z.coerce.boolean().optional(),
  receptionistId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryMessagesRestInput = z.infer<typeof queryMessagesRestSchema>;

// Business Profile REST API Schemas
export const updateBusinessProfileRestSchema = z.object({
  businessName: z.string().trim().min(1).max(100).optional(),
  legalName: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  website: z.string().url().max(255).optional().nullable(),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  region: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(30).optional().nullable(),
  country: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(100).optional(),
});

export type UpdateBusinessProfileRestInput = z.infer<
  typeof updateBusinessProfileRestSchema
>;

// Phase 5: Knowledge Base & RAG Tool Schemas
export const searchKnowledgeBaseToolSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query is required")
    .max(300, "Search query must be under 300 characters"),
  maxResults: z.number().int().min(1).max(10).optional(),
});

export type SearchKnowledgeBaseToolInput = z.infer<
  typeof searchKnowledgeBaseToolSchema
>;

export const createKnowledgeSourceSchema = z.object({
  type: z.enum([
    "WEBSITE",
    "SITEMAP",
    "PDF",
    "DOCX",
    "TXT",
    "MARKDOWN",
    "MANUAL",
    "FAQ",
  ]),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  sourceUrl: z.string().trim().url("Must be a valid URL").optional().nullable(),
  storageKey: z.string().optional().nullable(),
  configuration: z.record(z.any()).optional().nullable(),
});

export type CreateKnowledgeSourceInput = z.infer<
  typeof createKnowledgeSourceSchema
>;

export const updateKnowledgeSourceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  configuration: z.record(z.any()).optional().nullable(),
});

export type UpdateKnowledgeSourceInput = z.infer<
  typeof updateKnowledgeSourceSchema
>;

export const assignReceptionistKnowledgeSourcesSchema = z.object({
  knowledgeSourceIds: z.array(z.string().trim().min(1)),
});

export type AssignReceptionistKnowledgeSourcesInput = z.infer<
  typeof assignReceptionistKnowledgeSourcesSchema
>;

// Phase 6: Service Catalog Schemas
export const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMinutes: z.number().int().min(5, "Minimum duration is 5 minutes").max(480, "Maximum duration is 8 hours").default(30),
  bufferBeforeMinutes: z.number().int().min(0).max(120).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(120).default(0),
  priceText: z.string().trim().max(100).optional().nullable(),
  active: z.boolean().default(true),
  calendarIntegrationId: z.string().optional().nullable(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(120).optional(),
  priceText: z.string().trim().max(100).optional().nullable(),
  active: z.boolean().optional(),
  calendarIntegrationId: z.string().optional().nullable(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// Phase 6: Appointment Policy Schema
export const updateAppointmentPolicySchema = z.object({
  minimumLeadTimeMinutes: z.number().int().min(0).max(10080).optional(),
  maximumAdvanceDays: z.number().int().min(1).max(365).optional(),
  cancellationCutoffMinutes: z.number().int().min(0).max(10080).optional(),
  rescheduleCutoffMinutes: z.number().int().min(0).max(10080).optional(),
  allowSameDay: z.boolean().optional(),
});

export type UpdateAppointmentPolicyInput = z.infer<typeof updateAppointmentPolicySchema>;

// Phase 6: Appointment REST API Schemas
export const createAppointmentRestSchema = z.object({
  contactId: z.string().min(1, "contactId is required"),
  serviceId: z.string().min(1, "serviceId is required"),
  calendarIntegrationId: z.string().optional(),
  startAt: z.string().datetime("startAt must be a valid ISO datetime"),
  timezone: z.string().optional(),
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  receptionistId: z.string().optional(),
});

export type CreateAppointmentRestInput = z.infer<typeof createAppointmentRestSchema>;

export const rescheduleAppointmentRestSchema = z.object({
  startAt: z.string().datetime("startAt must be a valid ISO datetime"),
  timezone: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export type RescheduleAppointmentRestInput = z.infer<typeof rescheduleAppointmentRestSchema>;

export const cancelAppointmentRestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelAppointmentRestInput = z.infer<typeof cancelAppointmentRestSchema>;

export const queryAppointmentsRestSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "RESCHEDULED", "CANCELLED", "COMPLETED", "NO_SHOW", "FAILED"]).optional(),
  serviceId: z.string().optional(),
  contactId: z.string().optional(),
  receptionistId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryAppointmentsRestInput = z.infer<typeof queryAppointmentsRestSchema>;

// Phase 6: Calendar Integration Schemas
export const selectCalendarSchema = z.object({
  calendarId: z.string().min(1, "calendarId is required"),
});

export type SelectCalendarInput = z.infer<typeof selectCalendarSchema>;

// Phase 6: Realtime AI Appointment Tools Schemas
export const findServiceToolSchema = z.object({
  query: z.string().trim().max(100).optional(),
});

export type FindServiceToolInput = z.infer<typeof findServiceToolSchema>;

export const checkAvailabilityToolSchema = z.object({
  serviceId: z.string().min(1, "serviceId is required"),
  date: z.string().optional().describe("Date in YYYY-MM-DD format"),
  startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  endDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
  timePreference: z.enum(["MORNING", "AFTERNOON", "EVENING", "ANYTIME"]).optional().default("ANYTIME"),
});

export type CheckAvailabilityToolInput = z.infer<typeof checkAvailabilityToolSchema>;

export const getAppointmentToolSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
  contactId: z.string().optional().describe("Optional contactId for verification"),
});

export type GetAppointmentToolInput = z.infer<typeof getAppointmentToolSchema>;

export const bookAppointmentToolSchema = z.object({
  contactId: z.string().min(1, "contactId is required"),
  serviceId: z.string().min(1, "serviceId is required"),
  slotId: z.string().min(1, "slotId opaque token is required"),
  confirmationId: z.string().optional().describe("Server-issued confirmation token"),
  callerConfirmed: z.boolean().optional().describe("Ignored by server security policy"),
});

export type BookAppointmentToolInput = z.infer<typeof bookAppointmentToolSchema>;

export const rescheduleAppointmentToolSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
  slotId: z.string().min(1, "slotId opaque token is required"),
  confirmationId: z.string().optional().describe("Server-issued confirmation token"),
  callerConfirmed: z.boolean().optional().describe("Ignored by server security policy"),
});

export type RescheduleAppointmentToolInput = z.infer<typeof rescheduleAppointmentToolSchema>;

export const cancelAppointmentToolSchema = z.object({
  appointmentId: z.string().min(1, "appointmentId is required"),
  reason: z.string().max(500).optional(),
  confirmationId: z.string().optional().describe("Server-issued confirmation token"),
  callerConfirmed: z.boolean().optional().describe("Ignored by server security policy"),
});

export type CancelAppointmentToolInput = z.infer<typeof cancelAppointmentToolSchema>;

// ==========================================
// Phase 7: Messaging & Notifications Schemas
// ==========================================

export const communicationChannelEnum = z.enum(["SMS", "EMAIL"]);
export const communicationPurposeEnum = z.enum([
  "APPOINTMENT_CONFIRMATION",
  "APPOINTMENT_RESCHEDULE",
  "APPOINTMENT_CANCELLATION",
  "CALLBACK_CONFIRMATION",
  "MESSAGE_RECEIVED_CONFIRMATION",
  "LEAD_FOLLOWUP_NOTICE",
  "TEAM_NEW_MESSAGE_ALERT",
  "TEAM_NEW_LEAD_ALERT",
  "CUSTOM_TRANSACTIONAL",
]);
export const communicationStatusEnum = z.enum([
  "PENDING",
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SUPPRESSED",
  "CANCELLED",
]);

export const updateCommunicationSettingsSchema = z.object({
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  timezone: z.string().max(100).optional(),
  sendSmsOnBooking: z.boolean().optional(),
  sendEmailOnBooking: z.boolean().optional(),
  sendSmsOnReschedule: z.boolean().optional(),
  sendEmailOnReschedule: z.boolean().optional(),
  sendSmsOnCancellation: z.boolean().optional(),
  sendEmailOnCancellation: z.boolean().optional(),
  sendSmsOnCallbackRequest: z.boolean().optional(),
  sendEmailOnCallbackRequest: z.boolean().optional(),
  sendEmailOnNewLead: z.boolean().optional(),
  sendEmailOnNewMessage: z.boolean().optional(),
  teamNotificationEmails: z.array(z.string().email()).optional(),
});

export type UpdateCommunicationSettingsInput = z.infer<typeof updateCommunicationSettingsSchema>;

export const createTemplateSchema = z.object({
  key: z.string().min(2).max(100).regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores"),
  channel: communicationChannelEnum,
  name: z.string().min(2).max(100),
  purpose: communicationPurposeEnum,
  subjectTemplate: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(5000),
  variables: z.array(z.string()).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  subjectTemplate: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(5000).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  variables: z.array(z.string()).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const sendTestCommunicationSchema = z.object({
  channel: communicationChannelEnum,
  recipient: z.string().min(3).max(255),
  message: z.string().max(1000).optional(),
});

export type SendTestCommunicationInput = z.infer<typeof sendTestCommunicationSchema>;

export const queryCommunicationsSchema = z.object({
  channel: communicationChannelEnum.optional(),
  purpose: communicationPurposeEnum.optional(),
  status: communicationStatusEnum.optional(),
  contactId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryCommunicationsInput = z.infer<typeof queryCommunicationsSchema>;

// Phase 7 Realtime AI Tools
export const sendSmsToolSchema = z
  .object({
    contactId: z.string().min(1, "contactId is required"),
    purpose: communicationPurposeEnum,
    relatedResourceId: z.string().optional().describe("Optional appointmentId, messageId, or leadId"),
    to: z.string().optional(),
    phone: z.string().optional(),
    body: z.string().optional(),
    text: z.string().optional(),
    message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.to || data.phone || data.body || data.text || data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SECURITY_POLICY_VIOLATION: Arbitrary recipient numbers or message bodies are strictly prohibited. You must supply contactId and purpose only.",
      });
    }
  });

export type SendSmsToolInput = z.infer<typeof sendSmsToolSchema>;

export const sendEmailToolSchema = z
  .object({
    contactId: z.string().min(1, "contactId is required"),
    purpose: communicationPurposeEnum,
    relatedResourceId: z.string().optional().describe("Optional appointmentId, messageId, or leadId"),
    to: z.string().optional(),
    email: z.string().optional(),
    body: z.string().optional(),
    text: z.string().optional(),
    message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.to || data.email || data.body || data.text || data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SECURITY_POLICY_VIOLATION: Arbitrary recipient email addresses or message bodies are strictly prohibited. You must supply contactId and purpose only.",
      });
    }
  });

export type SendEmailToolInput = z.infer<typeof sendEmailToolSchema>;

// Provider Webhooks
export const twilioStatusWebhookSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.string(),
  To: z.string().optional(),
  From: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
});

export type TwilioStatusWebhookInput = z.infer<typeof twilioStatusWebhookSchema>;

export const resendWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
    to: z.array(z.string()).optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
});

export type ResendWebhookInput = z.infer<typeof resendWebhookSchema>;


