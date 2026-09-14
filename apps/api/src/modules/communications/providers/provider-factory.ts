import {
  EmailProvider,
  SmsProvider,
} from "./communication-provider.interface";
import { MockSmsProvider } from "./mock-sms.provider";
import { MockEmailProvider } from "./mock-email.provider";
import { TwilioSmsProvider } from "./twilio-sms.provider";
import { ResendEmailProvider } from "./resend-email.provider";

export class CommunicationProviderFactory {
  private static customSmsProvider: SmsProvider | null = null;
  private static customEmailProvider: EmailProvider | null = null;

  public static setSmsProvider(provider: SmsProvider | null) {
    this.customSmsProvider = provider;
  }

  public static setEmailProvider(provider: EmailProvider | null) {
    this.customEmailProvider = provider;
  }

  public static reset() {
    this.customSmsProvider = null;
    this.customEmailProvider = null;
  }

  public static getSmsProvider(): SmsProvider {
    if (this.customSmsProvider) {
      return this.customSmsProvider;
    }

    const providerType = (process.env.SMS_PROVIDER || "mock").toLowerCase();
    if (providerType === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return new TwilioSmsProvider();
    }

    return new MockSmsProvider();
  }

  public static getEmailProvider(): EmailProvider {
    if (this.customEmailProvider) {
      return this.customEmailProvider;
    }

    const providerType = (process.env.EMAIL_PROVIDER || "mock").toLowerCase();
    if (providerType === "resend" && process.env.RESEND_API_KEY) {
      return new ResendEmailProvider();
    }

    return new MockEmailProvider();
  }
}
