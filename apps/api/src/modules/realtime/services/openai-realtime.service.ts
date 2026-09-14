import { logger } from "@receptionai/observability";

export interface RealtimeClientSecretResponse {
  clientSecret: string;
  expiresAt: number;
  model: string;
}

export class OpenAIRealtimeCredentialProvider {
  /**
   * Generates a short-lived client secret from OpenAI's /v1/realtime/client_secrets endpoint.
   * This ephemeral token (ek_...) allows the browser to connect via WebRTC without exposing the master OPENAI_API_KEY.
   */
  static async createBrowserClientSecret(options?: {
    model?: string;
  }): Promise<RealtimeClientSecretResponse> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY;

    if (!apiKey) {
      logger.error("OpenAI API key is missing in environment variables.");
      throw new Error("OPENAI_API_KEY_MISSING");
    }

    const model = options?.model || process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";

    try {
      const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, errorText },
          "Failed to generate OpenAI Realtime client secret."
        );
        throw new Error("REALTIME_CREDENTIAL_FAILED");
      }

      const data = (await response.json()) as {
        value: string;
        expires_at: number;
        session?: { model?: string };
      };

      if (!data.value) {
        throw new Error("REALTIME_CREDENTIAL_FAILED");
      }

      return {
        clientSecret: data.value,
        expiresAt: data.expires_at,
        model: data.session?.model || model,
      };
    } catch (err: any) {
      if (
        err.message === "OPENAI_API_KEY_MISSING" ||
        err.message === "REALTIME_CREDENTIAL_FAILED"
      ) {
        throw err;
      }
      logger.error({ err }, "Unexpected error calling OpenAI Realtime client_secrets API.");
      throw new Error("REALTIME_PROVIDER_ERROR");
    }
  }
}
