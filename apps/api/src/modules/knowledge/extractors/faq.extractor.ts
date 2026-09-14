import { ExtractedDocument } from "./text.extractor";

export interface FaqItem {
  question: string;
  answer: string;
}

export class FaqExtractor {
  extract(items: FaqItem[], sourceName?: string): ExtractedDocument[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: No FAQ items provided.");
    }

    const documents: ExtractedDocument[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const q = item.question?.trim();
      const a = item.answer?.trim();

      if (!q || !a) continue;

      const content = `### Question: ${q}\n\n**Answer:**\n${a}`;
      documents.push({
        title: q,
        content,
        metadata: {
          faqIndex: i,
          sourceName: sourceName || "FAQ",
        },
      });
    }

    if (documents.length === 0) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: All FAQ items were empty or invalid.");
    }

    return documents;
  }
}

export const faqExtractor = new FaqExtractor();
