import {
  SmsProvider,
  SmsSendRequest,
  SmsSendResult,
} from "./communication-provider.interface";

export class TwilioSmsProvider implements SmsProvider {
  public name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber?: string;

  constructor(config?: { accountSid?: string; authToken?: string; fromNumber?: string }) {
    this.accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = config?.fromNumber || process.env.SMS_FROM_NUMBER;
  }

  async send(req: SmsSendRequest): Promise<SmsSendResult> {
    if (!this.accountSid || !this.authToken) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "PROVIDER_MISSING_CREDENTIALS",
        errorMessage: "Twilio account SID or Auth Token is missing.",
        isTransient: false,
      };
    }

    const from = req.from || this.fromNumber;
    if (!from) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "FROM_ADDRESS_MISSING",
        errorMessage: "No Twilio SMS fromNumber configured.",
        isTransient: false,
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;

    const formParams = new URLSearchParams();
    formParams.set("To", req.to);
    formParams.set("From", from);
    formParams.set("Body", req.body);
    if (req.statusCallbackUrl) {
      formParams.set("StatusCallback", req.statusCallbackUrl);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formParams.toString(),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        const isTransient = response.status >= 500 || response.status === 429;
        return {
          success: false,
          status: "FAILED",
          errorCode: data?.code ? `TWILIO_${data.code}` : `HTTP_${response.status}`,
          errorMessage: data?.message || `Twilio send failed with HTTP ${response.status}`,
          isTransient,
          rawResponse: data,
        };
      }

      const numSegments = Number(data.num_segments) || Math.max(1, Math.ceil(req.body.length / 160));

      return {
        success: true,
        providerMessageId: data.sid,
        status: data.status === "queued" ? "QUEUED" : "SENT",
        estimatedSegments: numSegments,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "NETWORK_ERROR",
        errorMessage: err.message || "Failed to reach Twilio API",
        isTransient: true,
      };
    }
  }
}
