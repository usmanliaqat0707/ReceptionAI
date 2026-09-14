/**
 * Provider-neutral embedding interface.
 * Embedding generation must always happen server-side.
 */
export interface EmbeddingProvider {
  /**
   * Embed multiple document texts in a batch.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * Embed a single search query text.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Model metadata.
   */
  readonly model: string;
  readonly dimensions: number;
}
