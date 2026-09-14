import {
  SmsProvider,
  SmsSendRequest,
  SmsSendResult,
} from "./communication-provider.interface";

export class MockSmsProvider implements SmsProvider {
  public name = "mock-sms";
  public sentMessages: Array<SmsSendRequest & { sentAt: Date; providerMessageId: string }> = [];
  private failNext: { errorCode: string; errorMessage: string; isTransient: boolean } | null = null;

  public setFailNext(errorCode: string, errorMessage: string, isTransient: boolean = false) {
    this.failNext = { errorCode, errorMessage, isTransient };
  }

  public clear() {
    this.sentMessages = [];
    this.failNext = null;
  }

  async send(req: SmsSendRequest): Promise<SmsSendResult> {
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

    const providerMessageId = `mock_sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const estimatedSegments = Math.max(1, Math.ceil(req.body.length / 160));

    this.sentMessages.push({
      ...req,
      sentAt: new Date(),
      providerMessageId,
    });

    return {
      success: true,
      providerMessageId,
      status: "SENT",
      estimatedSegments,
      rawResponse: { mock: true, recipient: req.to, segments: estimatedSegments },
    };
  }
}
