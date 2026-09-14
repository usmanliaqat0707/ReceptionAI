export interface ExtractedDocument {
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export class TextExtractor {
  extract(rawText: string, filename?: string): ExtractedDocument {
    const normalized = rawText.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: Document text is empty.");
    }

    // Try to extract title from first markdown heading or filename
    const firstHeading = normalized.match(/^#\s+(.+)$/m);
    const title = firstHeading ? firstHeading[1].trim() : filename?.replace(/\.[^/.]+$/, "") || "Untitled Document";

    return {
      title,
      content: normalized,
    };
  }
}

export const textExtractor = new TextExtractor();
