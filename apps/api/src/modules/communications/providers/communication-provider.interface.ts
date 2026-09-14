export interface SmsSendRequest {
  to: string;
  from?: string;
  body: string;
  idempotencyKey?: string;
  workspaceId: string;
  communicationId: string;
  statusCallbackUrl?: string;
}

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  status: "SENT" | "QUEUED" | "FAILED";
  estimatedSegments?: number;
  errorCode?: string;
  errorMessage?: string;
  isTransient?: boolean;
  rawResponse?: any;
}

export interface SmsProvider {
  name: string;
  send(req: SmsSendRequest): Promise<SmsSendResult>;
}

export interface EmailSendRequest {
  to: string;
  fromAddress: string;
  fromName?: string;
  subject: string;
  html?: string;
  text: string;
  idempotencyKey?: string;
  workspaceId: string;
  communicationId: string;
}

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  status: "SENT" | "QUEUED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  isTransient?: boolean;
  rawResponse?: any;
}

export interface EmailProvider {
  name: string;
  send(req: EmailSendRequest): Promise<EmailSendResult>;
}
