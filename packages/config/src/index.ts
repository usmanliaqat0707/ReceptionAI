import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://127.0.0.1:6380"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters for security"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_APIKEY: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().default("gpt-realtime-2.1"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  REALTIME_VOICE_ENABLED: z.coerce.boolean().default(true),
  SMS_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  SMS_FROM_NUMBER: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().default("notifications@receptionai.com"),
  EMAIL_FROM_NAME: z.string().default("ReceptionAI"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_WEBHOOK_AUTH_TOKEN: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[CRITICAL] Invalid environment variables configuration:\n${errorDetails}\nPlease check your .env file.`
    );
  }
  return parsed.data;
}

// Role Definitions
export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "AGENT_MANAGER",
  "RECEPTION_STAFF",
  "VIEWER",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  "workspace.read",
  "workspace.manage",
  "members.read",
  "members.manage",
  "security.manage",
  "audit.read",
  "receptionists.read",
  "receptionists.create",
  "receptionists.update",
  "receptionists.lifecycle",
  "receptionists.archive",
  "receptionists.test",
  "transfer_destinations.read",
  "transfer_destinations.manage",
  "contacts.read",
  "contacts.create",
  "contacts.update",
  "contacts.archive",
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.archive",
  "messages.read",
  "messages.update",
  "business_profile.read",
  "business_profile.manage",
  "receptionist_tools.read",
  "knowledge.read",
  "knowledge.create",
  "knowledge.update",
  "knowledge.archive",
  "knowledge.reindex",
  "knowledge.assign",
  "services.read",
  "services.create",
  "services.update",
  "services.archive",
  "appointments.read",
  "appointments.create",
  "appointments.update",
  "appointments.cancel",
  "calendar_integrations.read",
  "calendar_integrations.manage",
  "communications.read",
  "communications.send_test",
  "communications.manage_templates",
  "communications.manage_settings",
  "communications.retry",
  "communications.view_recipient",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [
    "workspace.read",
    "workspace.manage",
    "members.read",
    "members.manage",
    "security.manage",
    "audit.read",
    "receptionists.read",
    "receptionists.create",
    "receptionists.update",
    "receptionists.lifecycle",
    "receptionists.archive",
    "receptionists.test",
    "transfer_destinations.read",
    "transfer_destinations.manage",
    "contacts.read",
    "contacts.create",
    "contacts.update",
    "contacts.archive",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.archive",
    "messages.read",
    "messages.update",
    "business_profile.read",
    "business_profile.manage",
    "receptionist_tools.read",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.archive",
    "knowledge.reindex",
    "knowledge.assign",
    "services.read",
    "services.create",
    "services.update",
    "services.archive",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "appointments.cancel",
    "calendar_integrations.read",
    "calendar_integrations.manage",
    "communications.read",
    "communications.send_test",
    "communications.manage_templates",
    "communications.manage_settings",
    "communications.retry",
    "communications.view_recipient",
  ],
  ADMIN: [
    "workspace.read",
    "workspace.manage",
    "members.read",
    "members.manage",
    "audit.read",
    "receptionists.read",
    "receptionists.create",
    "receptionists.update",
    "receptionists.lifecycle",
    "receptionists.archive",
    "receptionists.test",
    "transfer_destinations.read",
    "transfer_destinations.manage",
    "contacts.read",
    "contacts.create",
    "contacts.update",
    "contacts.archive",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.archive",
    "messages.read",
    "messages.update",
    "business_profile.read",
    "business_profile.manage",
    "receptionist_tools.read",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.archive",
    "knowledge.reindex",
    "knowledge.assign",
    "services.read",
    "services.create",
    "services.update",
    "services.archive",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "appointments.cancel",
    "calendar_integrations.read",
    "calendar_integrations.manage",
    "communications.read",
    "communications.send_test",
    "communications.manage_templates",
    "communications.manage_settings",
    "communications.retry",
    "communications.view_recipient",
  ],
  AGENT_MANAGER: [
    "workspace.read",
    "members.read",
    "receptionists.read",
    "receptionists.create",
    "receptionists.update",
    "receptionists.lifecycle",
    "receptionists.test",
    "transfer_destinations.read",
    "transfer_destinations.manage",
    "contacts.read",
    "contacts.create",
    "contacts.update",
    "contacts.archive",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.archive",
    "messages.read",
    "messages.update",
    "business_profile.read",
    "business_profile.manage",
    "receptionist_tools.read",
    "knowledge.read",
    "knowledge.create",
    "knowledge.update",
    "knowledge.archive",
    "knowledge.reindex",
    "knowledge.assign",
    "services.read",
    "services.create",
    "services.update",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "appointments.cancel",
    "calendar_integrations.read",
    "communications.read",
    "communications.retry",
  ],
  RECEPTION_STAFF: [
    "workspace.read",
    "receptionists.read",
    "receptionists.test",
    "transfer_destinations.read",
    "contacts.read",
    "contacts.create",
    "contacts.update",
    "leads.read",
    "leads.create",
    "leads.update",
    "messages.read",
    "messages.update",
    "business_profile.read",
    "receptionist_tools.read",
    "knowledge.read",
    "services.read",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "appointments.cancel",
    "calendar_integrations.read",
    "communications.read",
  ],
  VIEWER: [
    "workspace.read",
    "receptionists.read",
    "transfer_destinations.read",
    "contacts.read",
    "leads.read",
    "messages.read",
    "business_profile.read",
    "receptionist_tools.read",
    "knowledge.read",
    "services.read",
    "appointments.read",
    "calendar_integrations.read",
    "communications.read",
  ],
};

// Phase 4 Realtime Tool Execution Constants
export const REALTIME_TOOL_TIMEOUT_MS = 8000;
export const REALTIME_SESSION_TOOL_CALL_LIMIT = 25;
export const REALTIME_SESSION_MUTATION_LIMIT = 10;
export const CONFIRMATION_EXPIRY_MINUTES = 5;

// Phase 6 Scheduling & Calendar Constants
export const DEFAULT_SLOT_EXPIRY_MINUTES = 5;
export const APPOINTMENT_CONFIRMATION_EXPIRY_MINUTES = 3;
export const MAX_AVAILABILITY_SEARCH_DAYS = 30;
export const MAX_AVAILABILITY_SLOTS_RETURNED = 12;
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
export const DEFAULT_MINIMUM_LEAD_TIME_MINUTES = 60;
export const DEFAULT_MAXIMUM_ADVANCE_DAYS = 90;
export const DEFAULT_CANCELLATION_CUTOFF_MINUTES = 1440; // 24 hours
export const DEFAULT_RESCHEDULE_CUTOFF_MINUTES = 1440; // 24 hours

// Phase 5 Knowledge & RAG Constants
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_CHUNK_SIZE = 400;
export const DEFAULT_CHUNK_OVERLAP = 50;
export const DEFAULT_HYBRID_VECTOR_WEIGHT = 0.7;
export const DEFAULT_HYBRID_LEXICAL_WEIGHT = 0.3;
export const DEFAULT_RETRIEVAL_THRESHOLD = 0.35;
export const DEFAULT_RETRIEVAL_LIMIT = 4;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_CRAWL_PAGES = 50;
export const MAX_CRAWL_DEPTH = 3;
export const CRAWL_CONNECT_TIMEOUT_MS = 5000;
export const CRAWL_RESPONSE_TIMEOUT_MS = 10000;
export const REALTIME_SESSION_KNOWLEDGE_SEARCH_LIMIT = 15;

// Session & Expiration Timers
export const SESSION_COOKIE_NAME = "rai_session";
export const SESSION_EXPIRY_DAYS = 7;
export const INVITATION_EXPIRY_DAYS = 7;
export const PASSWORD_RESET_EXPIRY_HOURS = 2;
export const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

// Receptionist Domain Constants
export const PERSONALITY_TRAITS = [
  "PROFESSIONAL",
  "FRIENDLY",
  "WARM",
  "CALM",
  "FORMAL",
  "CONCISE",
  "ENERGETIC",
  "PATIENT",
  "EMPATHETIC",
] as const;

export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export const RECEPTIONIST_OBJECTIVES = [
  "ANSWER_QUESTIONS",
  "CAPTURE_LEADS",
  "BOOK_APPOINTMENTS",
  "RESCHEDULE_APPOINTMENTS",
  "CANCEL_APPOINTMENTS",
  "TAKE_MESSAGES",
  "TRANSFER_CALLS",
  "QUALIFY_PROSPECTS",
  "COLLECT_CUSTOMER_INFORMATION",
  "HANDLE_AFTER_HOURS",
] as const;

export type ReceptionistObjective = (typeof RECEPTIONIST_OBJECTIVES)[number];

export const SPEAKING_STYLES = ["neutral", "warm", "professional", "calm", "energetic"] as const;
export type SpeakingStyle = (typeof SPEAKING_STYLES)[number];

export const SPEAKING_RATES = ["slow", "normal", "fast"] as const;
export type SpeakingRate = (typeof SPEAKING_RATES)[number];

export const RESPONSE_PACING = ["concise", "balanced", "detailed"] as const;
export type ResponsePacing = (typeof RESPONSE_PACING)[number];

export const SILENCE_HANDLING = [
  "WAIT",
  "PROMPT_ONCE",
  "PROMPT_TWICE",
  "END_AFTER_PROMPT",
] as const;
export type SilenceHandling = (typeof SILENCE_HANDLING)[number];

export const UNKNOWN_ANSWER_BEHAVIOR = ["admit_unknown", "take_message", "escalate"] as const;
export type UnknownAnswerBehavior = (typeof UNKNOWN_ANSWER_BEHAVIOR)[number];

export const AFTER_HOURS_MODES = [
  "CONTINUE_NORMAL",
  "FAQ_ONLY",
  "TAKE_MESSAGE",
  "CALLBACK_REQUEST",
  "TRANSFER_EMERGENCY",
  "DISABLED",
] as const;
export type AfterHoursMode = (typeof AFTER_HOURS_MODES)[number];

export const INDUSTRIES = [
  "GENERAL",
  "DENTAL",
  "MEDICAL",
  "LEGAL",
  "REAL_ESTATE",
  "SALON",
  "HOME_SERVICES",
  "AUTO_REPAIR",
  "RESTAURANT",
  "CONSULTING",
  "PROPERTY_MANAGEMENT",
  "OTHER",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: "en-US", name: "English (US)", flag: "🇺🇸" },
  { code: "en-GB", name: "English (UK)", flag: "🇬🇧" },
  { code: "es-ES", name: "Spanish", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", flag: "🇫🇷" },
  { code: "de-DE", name: "German", flag: "🇩🇪" },
  { code: "it-IT", name: "Italian", flag: "🇮🇹" },
  { code: "pt-BR", name: "Portuguese (Brazil)", flag: "🇧🇷" },
  { code: "ur-PK", name: "Urdu", flag: "🇵🇰" },
] as const;

// OpenAI Realtime Voice Mapping
export const OPENAI_VOICE_MAP: Record<string, string> = {
  warm: "coral",
  professional: "sage",
  calm: "verse",
  energetic: "alloy",
  neutral: "ash",
  friendly: "shimmer",
  formal: "ballad",
  authoritative: "echo",
};

// Playground Session Timeouts
export const REALTIME_SESSION_MAX_DURATION_SECONDS = 900; // 15 minutes
export const REALTIME_SESSION_WARNING_SECONDS = 120; // 2 minutes remaining warning
export const REALTIME_RATE_LIMIT_MAX_PER_MINUTE = 6;

// Phase 7 Messaging & Notifications Constants
export const DEFAULT_SMS_SEGMENT_LIMIT = 1;
export const MAX_COMMUNICATION_RETRY_ATTEMPTS = 5;
export const EXPONENTIAL_BACKOFF_BASE_MS = 1000;
export const MAX_BACKOFF_MS = 300000; // 5 minutes
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

