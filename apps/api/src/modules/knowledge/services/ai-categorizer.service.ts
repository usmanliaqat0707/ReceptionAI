import { CrawledPage } from "./crawler.service";

export interface CategorizedKnowledgeDocument {
  categoryKey: "SERVICES" | "TIMINGS" | "PROCESSES" | "POLICIES" | "OVERVIEW" | "FAQ" | "SPECIALTIES";
  title: string;
  content: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export class AiKnowledgeCategorizerService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || "";
    this.baseUrl = options?.baseUrl || "https://api.openai.com/v1";
    this.model = options?.model || "gpt-4o-mini";
  }

  /**
   * Intelligently categorizes crawled website content into distinct knowledge documents
   * using OpenAI GPT-4o-mini structured analysis, with automatic heuristic fallback.
   */
  async categorizeWebsiteContent(
    pages: CrawledPage[],
    sourceName: string,
    rootUrl: string
  ): Promise<CategorizedKnowledgeDocument[]> {
    if (pages.length === 0) return [];

    // If API key is not set or in test mode without key, use heuristic extraction
    if (!this.apiKey || process.env.NODE_ENV === "test") {
      return this.heuristicCategorize(pages, sourceName, rootUrl);
    }

    try {
      // 1. Prepare concise aggregated content from crawled pages
      // Include structured JSON-LD data, meta descriptions, and clean content
      const aggregatedContent = pages
        .slice(0, 40)
        .map((page, idx) => {
          const doc = page.document;
          const metaDesc = doc.metadata?.description || "";
          const structuredData = doc.metadata?.structuredData
            ? `Structured Data: ${JSON.stringify(doc.metadata.structuredData)}`
            : "";
          const cleanBody = doc.content
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .slice(0, 150)
            .join("\n");

          return `--- PAGE ${idx + 1}: ${doc.title} (${page.url}) ---\n${metaDesc ? `Summary: ${metaDesc}\n` : ""}${structuredData ? `${structuredData}\n` : ""}Content:\n${cleanBody}\n`;
        })
        .join("\n\n");

      // Cap aggregated text to ~90,000 characters to ensure safe token bounds
      const boundedContent = aggregatedContent.slice(0, 90000);

      const systemPrompt = `You are an expert AI knowledge architect for ReceptionAI, an autonomous voice receptionist SaaS.
Your task is to analyze all crawled content from a business website and intelligently extract, synthesize, and categorize its facts into comprehensive, authoritative, structured Knowledge Documents for AI receptionist retrieval.

You MUST extract and synthesize information into the following categories (only omit a category if the website has absolutely zero information about it):
1. SERVICES: All clinical/business services, treatments, procedures, specialties, packages, and pricing/details.
2. TIMINGS: Operating hours, days open, opening/closing hours per location or branch, emergency availability, holiday schedules.
3. PROCESSES: Booking procedures, appointment scheduling steps, patient/client check-in protocols, arrival instructions, consultation steps.
4. POLICIES: Cancellation and rescheduling policy, payment methods accepted, insurance plans accepted, deposit/refund rules, arrival requirements.
5. OVERVIEW: Business identity, background, mission, clinic branches, doctor/staff profiles, phone numbers, email addresses, physical locations.
6. FAQ: Frequently Asked Questions and clear, direct answers based on the site facts.

Each categorized document MUST have:
- categoryKey: One of "SERVICES", "TIMINGS", "PROCESSES", "POLICIES", "OVERVIEW", "FAQ", "SPECIALTIES"
- title: A clear, descriptive document title (e.g. "Dental Aesthetics - Services & Treatments")
- content: Comprehensive, well-organized markdown with headings (##, ###), bullet points, and specific facts extracted from the site. Do not summarize with generic filler; provide the actual facts, numbers, phone numbers, addresses, and hours.
- summary: A 1-2 sentence executive summary of this category.

Respond ONLY with valid JSON following this schema:
{
  "documents": [
    {
      "categoryKey": "SERVICES",
      "title": "...",
      "content": "...",
      "summary": "..."
    }
  ]
}`;

      const userPrompt = `Website Name: ${sourceName}
Root URL: ${rootUrl}
Total Crawled Pages: ${pages.length}

Crawled Website Content:
${boundedContent}`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`OpenAI categorization API error (${response.status}):`, errJson);
        return this.heuristicCategorize(pages, sourceName, rootUrl);
      }

      const json = (await response.json()) as any;
      const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");

      if (Array.isArray(parsed.documents) && parsed.documents.length > 0) {
        return parsed.documents.map((d: any) => ({
          categoryKey: d.categoryKey || "OVERVIEW",
          title: d.title || `${sourceName} - Knowledge`,
          content: d.content || "",
          summary: d.summary || "",
          metadata: {
            category: d.categoryKey || "OVERVIEW",
            aiCategorized: true,
            model: this.model,
          },
        }));
      }

      return this.heuristicCategorize(pages, sourceName, rootUrl);
    } catch (err) {
      console.warn("AI categorization failed, falling back to heuristic categorization:", err);
      return this.heuristicCategorize(pages, sourceName, rootUrl);
    }
  }

  /**
   * Fallback rule-based categorizer for offline, test, or rate-limited environments.
   */
  private heuristicCategorize(
    pages: CrawledPage[],
    sourceName: string,
    _rootUrl: string
  ): CategorizedKnowledgeDocument[] {
    const categories: Record<string, { title: string; contents: string[] }> = {
      SERVICES: { title: `${sourceName} - Services & Treatments`, contents: [] },
      TIMINGS: { title: `${sourceName} - Operating Hours & Locations`, contents: [] },
      POLICIES: { title: `${sourceName} - Policies & Guidelines`, contents: [] },
      PROCESSES: { title: `${sourceName} - Patient Booking & Arrival Guidelines`, contents: [] },
      OVERVIEW: { title: `${sourceName} - General Business Overview`, contents: [] },
      FAQ: { title: `${sourceName} - Questions & Answers`, contents: [] },
    };

    for (const page of pages) {
      const urlLower = page.url.toLowerCase();
      const titleLower = page.document.title.toLowerCase();
      const content = page.document.content;

      if (urlLower.includes("service") || titleLower.includes("service") || urlLower.includes("treatment")) {
        categories.SERVICES.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      } else if (urlLower.includes("hour") || urlLower.includes("timing") || titleLower.includes("time") || titleLower.includes("contact")) {
        categories.TIMINGS.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      } else if (urlLower.includes("policy") || urlLower.includes("terms") || titleLower.includes("policy") || titleLower.includes("insurance")) {
        categories.POLICIES.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      } else if (urlLower.includes("faq") || titleLower.includes("faq") || titleLower.includes("question")) {
        categories.FAQ.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      } else if (urlLower.includes("book") || urlLower.includes("appointment") || titleLower.includes("appointment")) {
        categories.PROCESSES.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      } else {
        categories.OVERVIEW.contents.push(`## ${page.document.title}\nSource: ${page.url}\n\n${content}`);
      }
    }

    const docs: CategorizedKnowledgeDocument[] = [];
    for (const [catKey, data] of Object.entries(categories)) {
      if (data.contents.length > 0) {
        docs.push({
          categoryKey: catKey as any,
          title: data.title,
          content: data.contents.join("\n\n---\n\n"),
          summary: `Extracted ${catKey.toLowerCase()} information for ${sourceName}.`,
          metadata: {
            category: catKey,
            aiCategorized: false,
          },
        });
      }
    }

    // Ensure at least one overview document exists
    if (docs.length === 0 && pages[0]) {
      docs.push({
        categoryKey: "OVERVIEW",
        title: `${sourceName} - Overview`,
        content: pages.map((p) => `# ${p.document.title}\n${p.document.content}`).join("\n\n---\n\n"),
        summary: `Overview for ${sourceName}`,
        metadata: { category: "OVERVIEW", aiCategorized: false },
      });
    }

    return docs;
  }
}

export const aiKnowledgeCategorizer = new AiKnowledgeCategorizerService();
