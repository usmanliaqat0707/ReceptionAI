import {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./communication-provider.interface";

export class ResendEmailProvider implements EmailProvider {
  public name = "resend";
  private apiKey: string;
  private defaultFromAddress: string;
  private defaultFromName: string;

  constructor(config?: { apiKey?: string; fromAddress?: string; fromName?: string }) {
    this.apiKey = config?.apiKey || process.env.RESEND_API_KEY || "";
    this.defaultFromAddress =
      config?.fromAddress || process.env.EMAIL_FROM_ADDRESS || "notifications@receptionai.com";
    this.defaultFromName = config?.fromName || process.env.EMAIL_FROM_NAME || "ReceptionAI";
  }

  async send(req: EmailSendRequest): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "PROVIDER_MISSING_CREDENTIALS",
        errorMessage: "Resend API key is missing.",
        isTransient: false,
      };
    }

    const fromAddress = req.fromAddress || this.defaultFromAddress;
    const fromName = req.fromName || this.defaultFromName;
    const fromFormatted = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

    const payload: any = {
      from: fromFormatted,
      to: [req.to],
      subject: req.subject,
      text: req.text,
      html: req.html || `<div style="font-family: sans-serif; line-height: 1.5;">${req.text.replace(/\n/g, "<br/>")}</div>`,
    };

    if (req.idempotencyKey) {
      payload.headers = {
        "X-Entity-Ref-ID": req.idempotencyKey,
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        const isTransient = response.status >= 500 || response.status === 429;
        return {
          success: false,
          status: "FAILED",
          errorCode: data?.name ? `RESEND_${data.name}` : `HTTP_${response.status}`,
          errorMessage: data?.message || `Resend send failed with HTTP ${response.status}`,
          isTransient,
          rawResponse: data,
        };
      }

      return {
        success: true,
        providerMessageId: data.id,
        status: "SENT",
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "NETWORK_ERROR",
        errorMessage: err.message || "Failed to reach Resend API",
        isTransient: true,
      };
    }
  }
}
