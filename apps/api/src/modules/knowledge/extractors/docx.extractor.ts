import mammoth from "mammoth";
import { ExtractedDocument } from "./text.extractor";

export class DocxExtractor {
  async extract(buffer: Buffer, filename?: string): Promise<ExtractedDocument> {
    if (!buffer || buffer.length === 0) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: Empty DOCX file provided.");
    }

    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.replace(/\r\n/g, "\n").trim();

      if (!text) {
        throw new Error("KNOWLEDGE_EXTRACTION_FAILED: DOCX contains no readable text.");
      }

      const defaultTitle = filename?.replace(/\.[^/.]+$/, "") || "Word Document";

      return {
        title: defaultTitle,
        content: text,
        metadata: {
          messages: result.messages,
        },
      };
    } catch (err: any) {
      throw new Error(`KNOWLEDGE_EXTRACTION_FAILED: Failed to parse DOCX: ${err.message}`);
    }
  }
}

export const docxExtractor = new DocxExtractor();
