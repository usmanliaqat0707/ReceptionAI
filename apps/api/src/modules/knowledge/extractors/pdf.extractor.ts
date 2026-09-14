import { ExtractedDocument } from "./text.extractor";

export class PdfExtractor {
  async extract(buffer: Buffer, filename?: string): Promise<ExtractedDocument> {
    if (!buffer || buffer.length === 0) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: Empty PDF file provided.");
    }

    try {
      // @ts-ignore
      const pdfModule = await import("pdf-parse");
      const parser = (pdfModule as any).default || pdfModule;
      const data = await parser(buffer);
      const text = data.text?.replace(/\r\n/g, "\n").trim();

      if (!text || text.length < 10) {
        throw new Error(
          "KNOWLEDGE_EXTRACTION_FAILED: PDF contains no readable text. Scanned image-only PDFs require OCR which is not enabled in Phase 5."
        );
      }

      const defaultTitle = filename?.replace(/\.[^/.]+$/, "") || "PDF Document";
      const title = data.info?.Title ? String(data.info.Title).trim() : defaultTitle;

      return {
        title: title || defaultTitle,
        content: text,
        metadata: {
          pages: data.numpages,
          pdfVersion: data.version,
          author: data.info?.Author,
        },
      };
    } catch (err: any) {
      if (err.message.includes("no readable text")) {
        throw err;
      }
      throw new Error(`KNOWLEDGE_EXTRACTION_FAILED: Failed to parse PDF: ${err.message}`);
    }
  }
}

export const pdfExtractor = new PdfExtractor();
