import { EmbeddingProvider } from "./embedding.interface";
import { DEFAULT_EMBEDDING_DIMENSIONS, DEFAULT_EMBEDDING_MODEL } from "@receptionai/config";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; dimensions?: number; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || "";
    this.model = options?.model || process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
    this.dimensions = options?.dimensions || DEFAULT_EMBEDDING_DIMENSIONS;
    this.baseUrl = options?.baseUrl || "https://api.openai.com/v1";
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      throw new Error("KNOWLEDGE_EMBEDDING_FAILED: OpenAI API key is not configured.");
    }

    // Batch in chunks of 50 to stay well below provider payload limits
    const BATCH_SIZE = 50;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await this.callApiWithRetry(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error("KNOWLEDGE_EMBEDDING_FAILED: OpenAI API key is not configured.");
    }

    const results = await this.callApiWithRetry([text]);
    if (!results[0]) {
      throw new Error("KNOWLEDGE_EMBEDDING_FAILED: Empty embedding returned from provider.");
    }
    return results[0];
  }

  private async callApiWithRetry(inputs: string[], maxRetries = 3): Promise<number[][]> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            input: inputs,
            model: this.model,
            dimensions: this.dimensions,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          // Sort items by index to guarantee input alignment
          const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
          return sorted.map((item: any) => item.embedding);
        }

        const errorData = ((await response.json().catch(() => ({})))) as any;
        const status = response.status;
        const message = errorData.error?.message || `HTTP error ${status}`;

        // Retry on 429 (Rate Limit) or 5xx server errors
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        throw new Error(`OpenAI API error (${status}): ${message}`);
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    throw new Error(`KNOWLEDGE_EMBEDDING_FAILED: ${lastError?.message || "Provider call failed"}`);
  }
}
