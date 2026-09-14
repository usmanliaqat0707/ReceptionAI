import {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./communication-provider.interface";

export class MockEmailProvider implements EmailProvider {
  public name = "mock-email";
  public sentEmails: Array<EmailSendRequest & { sentAt: Date; providerMessageId: string }> = [];
  private failNext: { errorCode: string; errorMessage: string; isTransient: boolean } | null = null;

  public setFailNext(errorCode: string, errorMessage: string, isTransient: boolean = false) {
    this.failNext = { errorCode, errorMessage, isTransient };
  }

  public clear() {
    this.sentEmails = [];
    this.failNext = null;
  }

  async send(req: EmailSendRequest): Promise<EmailSendResult> {
    if (this.failNext) {
      const fail = this.failNext;
      this.failNext = null;
      return {
        success: false,
        status: "FAILED",
        errorCode: fail.errorCode,
        errorMessage: fail.errorMessage,
        isTransient: fail.isTransient,
        rawResponse: { error: fail.errorMessage },
      };
    }

    const providerMessageId = `mock_email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.sentEmails.push({
      ...req,
      sentAt: new Date(),
      providerMessageId,
    });

    return {
      success: true,
      providerMessageId,
      status: "SENT",
      rawResponse: { mock: true, recipient: req.to, subject: req.subject },
    };
  }
}
