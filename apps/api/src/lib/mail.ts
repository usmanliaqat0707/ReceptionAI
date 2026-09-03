import { logger } from "@receptionai/observability";

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  sendMail(options: SendMailOptions): Promise<void>;
}

export class DevelopmentMailProvider implements MailProvider {
  async sendMail(options: SendMailOptions): Promise<void> {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
      },
      `[DEV MAIL] Email dispatched to ${options.to}: "${options.subject}"`
    );
    // In local development, print link destination without logging raw secrets in production
    if (process.env.NODE_ENV === "development") {
      console.log("-----------------------------------------");
      console.log(`✉️ [DEVELOPMENT EMAIL] To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Body:\n${options.text}`);
      console.log("-----------------------------------------");
    }
  }
}

export const mailProvider: MailProvider = new DevelopmentMailProvider();
