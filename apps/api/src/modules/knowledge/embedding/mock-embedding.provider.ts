import crypto from "crypto";
import { EmbeddingProvider } from "./embedding.interface";

/**
 * Deterministic Mock Embedding Provider for tests and offline development.
 * Produces unit-normalized 1536-dimensional vectors where overlapping words
 * produce semantically coherent cosine similarities without network calls.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly model = "mock-text-embedding-3-small";
  readonly dimensions = 1536;

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  private generateVector(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = text.toLowerCase().match(/\b[a-z0-9_]+\b/g) || [text];

    // Distribute weights across vector dimensions deterministically
    for (const token of tokens) {
      const hash = crypto.createHash("sha256").update(token).digest();
      for (let i = 0; i < 8; i++) {
        const dim = hash.readUInt16BE((i * 2) % 30) % this.dimensions;
        vector[dim] += 1.0;
      }
    }

    // Unit normalization (L2 norm = 1.0) for proper cosine distance calculations
    let sumSquares = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares) || 1;

    return vector.map((v) => Number((v / norm).toFixed(6)));
  }
}
