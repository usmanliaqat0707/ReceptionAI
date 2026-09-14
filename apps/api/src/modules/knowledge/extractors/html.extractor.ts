import * as cheerio from "cheerio";
import { ExtractedDocument } from "./text.extractor";

export class HtmlExtractor {
  extract(htmlString: string, sourceUrl?: string): ExtractedDocument {
    if (!htmlString || htmlString.trim().length === 0) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: Empty HTML content provided.");
    }

    const $ = cheerio.load(htmlString);

    // 1. Extract title priority: <title> -> <h1> -> fallback
    let title = $("title").first().text().trim();
    if (!title) {
      title = $("h1").first().text().trim();
    }
    if (!title && sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        title = parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
      } catch {
        title = "Web Page";
      }
    }
    if (!title) title = "Web Page";

    // 2. Extract Meta Tags (description, keywords, og:description)
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="twitter:description"]').attr("content")?.trim();

    const metaKeywords = $('meta[name="keywords"]').attr("content")?.trim();

    // 3. Extract Schema.org JSON-LD Structured Data BEFORE removing scripts
    const structuredDataSections: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).text().trim();
        if (!jsonText) return;
        const parsed = JSON.parse(jsonText);
        const items = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          if (!item || typeof item !== "object") continue;

          const type = item["@type"] || "Entity";
          const name = item.name || item.headline || "";
          const desc = item.description || "";
          const phone = item.telephone || "";
          const url = item.url || "";
          const price = item.priceRange || "";
          const rating = item.aggregateRating?.ratingValue
            ? `${item.aggregateRating.ratingValue} (${item.aggregateRating.reviewCount || 0} reviews)`
            : "";

          let addressStr = "";
          if (item.address) {
            if (typeof item.address === "string") {
              addressStr = item.address;
            } else {
              const { streetAddress, addressLocality, addressRegion, postalCode, addressCountry } =
                item.address;
              addressStr = [streetAddress, addressLocality, addressRegion, postalCode, addressCountry]
                .filter(Boolean)
                .join(", ");
            }
          }

          const entityLines: string[] = [];
          if (name) entityLines.push(`- **Name**: ${name}`);
          if (type) entityLines.push(`- **Type**: ${type}`);
          if (phone) entityLines.push(`- **Phone**: ${phone}`);
          if (addressStr) entityLines.push(`- **Address**: ${addressStr}`);
          if (rating) entityLines.push(`- **Rating**: ${rating}`);
          if (price) entityLines.push(`- **Price Range**: ${price}`);
          if (url) entityLines.push(`- **Website**: ${url}`);
          if (desc) entityLines.push(`- **Description**: ${desc}`);

          // Handle FAQPage
          if (type === "FAQPage" && Array.isArray(item.mainEntity)) {
            const faqLines: string[] = [];
            for (const q of item.mainEntity) {
              const question = q.name || q.question;
              const answer = q.acceptedAnswer?.text || q.answer;
              if (question && answer) {
                faqLines.push(`### ${question}\n${answer}\n`);
              }
            }
            if (faqLines.length > 0) {
              structuredDataSections.push(`## Frequently Asked Questions\n${faqLines.join("\n")}`);
            }
          }

          if (entityLines.length > 0) {
            structuredDataSections.push(`## ${name || type}\n${entityLines.join("\n")}`);
          }
        }
      } catch {
        // Ignore JSON-LD parse errors
      }
    });

    // 4. Remove non-content elements and boilerplate
    $(
      "script, style, noscript, iframe, svg, canvas, nav, footer, header, form, [role='dialog'], .cookie-banner, #cookie-banner, .cookie-notice, .modal, .popup"
    ).remove();

    // 5. Extract main content (prefer <main> or <article> if available)
    let container = $("main");
    if (container.length === 0) container = $("article");
    if (container.length === 0) container = $("#content, #main, .content, .main");
    if (container.length === 0) container = $("body");

    // 6. Transform block elements into clean text with headings
    const bodyLines: string[] = [];

    container.find("h1, h2, h3, h4, h5, h6, p, li, tr, blockquote, dd, dt").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (!text) return;

      if (tag === "h1") bodyLines.push(`\n# ${text}\n`);
      else if (tag === "h2") bodyLines.push(`\n## ${text}\n`);
      else if (tag === "h3") bodyLines.push(`\n### ${text}\n`);
      else if (tag === "h4" || tag === "h5" || tag === "h6") bodyLines.push(`\n#### ${text}\n`);
      else if (tag === "li") bodyLines.push(`- ${text}`);
      else bodyLines.push(`\n${text}`);
    });

    let bodyContent = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!bodyContent) {
      bodyContent = container.text().replace(/\s+/g, " ").trim();
    }

    // 7. Assemble comprehensive document
    const documentParts: string[] = [];

    if (metaDescription) {
      documentParts.push(`## Overview\n${metaDescription}`);
    }

    if (structuredDataSections.length > 0) {
      documentParts.push(structuredDataSections.join("\n\n"));
    }

    if (bodyContent) {
      documentParts.push(bodyContent);
    }

    if (metaKeywords) {
      documentParts.push(`**Keywords**: ${metaKeywords}`);
    }

    let finalContent = documentParts.join("\n\n").trim();

    // Fallback if the page is a dynamic web shell but has a title
    if (!finalContent && title) {
      finalContent = `# ${title}\nWeb page at ${sourceUrl || "unknown URL"}.`;
    }

    if (!finalContent) {
      throw new Error("KNOWLEDGE_EXTRACTION_FAILED: HTML page produced no readable content.");
    }

    return {
      title,
      content: finalContent,
      metadata: {
        sourceUrl,
        hasStructuredData: structuredDataSections.length > 0,
      },
    };
  }
}

export const htmlExtractor = new HtmlExtractor();
