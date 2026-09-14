import crypto from "crypto";
import { DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE } from "@receptionai/config";

export interface ChunkItem {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  headingPath?: string;
  metadata?: Record<string, any>;
}

export interface ChunkerOptions {
  maxTokens?: number;
  overlapTokens?: number;
  defaultHeadingPath?: string;
}

export class ChunkerService {
  /**
   * Approximates token count using standard ~4 characters per token heuristic.
   */
  estimateTokenCount(text: string): number {
    return Math.max(1, Math.ceil(text.trim().length / 4));
  }

  /**
   * Generates SHA-256 hash of content.
   */
  hashContent(content: string): string {
    return crypto.createHash("sha256").update(content.trim()).digest("hex");
  }

  /**
   * Chunks a structured or markdown document into semantically cohesive, bounded blocks.
   * Preserves heading hierarchies and paragraph boundaries.
   */
  chunkText(
    text: string,
    optionsOrMaxTokens?: ChunkerOptions | number,
    maybeOverlap?: number
  ): ChunkItem[] {
    const maxTokens =
      typeof optionsOrMaxTokens === "number"
        ? optionsOrMaxTokens
        : optionsOrMaxTokens?.maxTokens || DEFAULT_CHUNK_SIZE;
    const overlapTokens =
      typeof maybeOverlap === "number"
        ? maybeOverlap
        : typeof optionsOrMaxTokens === "object"
          ? optionsOrMaxTokens?.overlapTokens || DEFAULT_CHUNK_OVERLAP
          : DEFAULT_CHUNK_OVERLAP;
    const maxChars = Math.max(40, maxTokens * 4);
    const overlapChars = Math.min(Math.floor(maxChars / 2), overlapTokens * 4);
    const stepChars = Math.max(20, maxChars - overlapChars);

    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];

    // Split text by lines while tracking heading hierarchy
    const lines = normalized.split("\n");
    const sections: Array<{ headingPath: string; text: string }> = [];

    const headingStack: string[] = [];
    let currentParagraphs: string[] = [];

    const defaultHeading =
      typeof optionsOrMaxTokens === "object" ? optionsOrMaxTokens?.defaultHeadingPath || "" : "";

    const flushParagraphs = () => {
      if (currentParagraphs.length > 0) {
        const body = currentParagraphs.join("\n").trim();
        if (body) {
          const currentPath =
            headingStack.length > 0 ? headingStack.join(" > ") : defaultHeading;
          sections.push({ headingPath: currentPath, text: body });
        }
        currentParagraphs = [];
      }
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraphs();
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        headingStack.splice(level - 1);
        headingStack[level - 1] = title;
      } else {
        currentParagraphs.push(line);
      }
    }
    flushParagraphs();

    const chunks: ChunkItem[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionText = section.text;
      if (this.estimateTokenCount(sectionText) <= maxTokens) {
        // Small section fits in a single chunk
        chunks.push({
          chunkIndex: chunkIndex++,
          content: sectionText,
          contentHash: this.hashContent(sectionText),
          tokenCount: this.estimateTokenCount(sectionText),
          headingPath: section.headingPath || undefined,
        });
      } else {
        // Split section by paragraphs or sentences
        const paragraphs = sectionText.split(/\n\s*\n/);
        let currentChunkText = "";

        for (const p of paragraphs) {
          const trimmedP = p.trim();
          if (!trimmedP) continue;

          if ((currentChunkText + "\n\n" + trimmedP).length <= maxChars) {
            currentChunkText = currentChunkText ? `${currentChunkText}\n\n${trimmedP}` : trimmedP;
          } else {
            if (currentChunkText) {
              chunks.push({
                chunkIndex: chunkIndex++,
                content: currentChunkText,
                contentHash: this.hashContent(currentChunkText),
                tokenCount: this.estimateTokenCount(currentChunkText),
                headingPath: section.headingPath || undefined,
              });
              // Retain overlap from end of previous chunk
              const words = currentChunkText.split(/\s+/);
              const overlapText = words.slice(-Math.floor(overlapChars / 5)).join(" ");
              currentChunkText = overlapText ? `${overlapText}\n\n${trimmedP}` : trimmedP;
            } else {
              // Very long single paragraph: slice by character window
              let remaining = trimmedP;
              while (remaining.length > 0) {
                const slice = remaining.slice(0, maxChars);
                chunks.push({
                  chunkIndex: chunkIndex++,
                  content: slice,
                  contentHash: this.hashContent(slice),
                  tokenCount: this.estimateTokenCount(slice),
                  headingPath: section.headingPath || undefined,
                });
                remaining = remaining.slice(stepChars).trim();
                if (remaining.length <= overlapChars) break;
              }
              currentChunkText = "";
            }
          }
        }

        if (currentChunkText.trim()) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: currentChunkText.trim(),
            contentHash: this.hashContent(currentChunkText.trim()),
            tokenCount: this.estimateTokenCount(currentChunkText.trim()),
            headingPath: section.headingPath || undefined,
          });
        }
      }
    }

    return chunks;
  }

  chunkMarkdown(
    text: string,
    optionsOrMaxTokens?: ChunkerOptions | number,
    maybeOverlap?: number
  ): ChunkItem[] {
    return this.chunkText(text, optionsOrMaxTokens as any, maybeOverlap);
  }

  chunkFaqItems(items: Array<{ question: string; answer: string }>): ChunkItem[] {
    return items.map((item, idx) => {
      const content = `Question: ${item.question}\nAnswer: ${item.answer}`;
      return {
        chunkIndex: idx,
        content,
        contentHash: this.hashContent(content),
        tokenCount: this.estimateTokenCount(content),
        headingPath: `FAQ > ${item.question}`,
        metadata: { question: item.question },
      };
    });
  }
}

export const chunkerService = new ChunkerService();
