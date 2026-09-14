import { describe, it, expect } from "vitest";
import { ChunkerService } from "../src/modules/knowledge/services/chunker.service";

describe("Phase 5 Chunker Service Unit Tests", () => {
  const chunker = new ChunkerService();

  it("preserves heading hierarchy in markdown chunks", () => {
    const md = `
# Bright Dental Clinical Policies

## Arrival Policy
All new patients are required to arrive 15 minutes early to complete initial health forms.

## Cancellation Policy
Cancellations must be communicated at least 24 hours in advance to avoid late cancellation charges.
`.trim();

    const chunks = chunker.chunkMarkdown(md, 200, 20);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].headingPath).toContain("Arrival Policy");
    expect(chunks[0].content).toContain("15 minutes early");
    expect(chunks[1].headingPath).toContain("Cancellation Policy");
    expect(chunks[1].content).toContain("24 hours in advance");
  });

  it("calculates deterministic SHA-256 content hash and token counts", () => {
    const text = "Routine dental prophylaxis removes plaque and tartar build-up from tooth surfaces.";
    const chunks = chunker.chunkText(text, 100, 10);

    expect(chunks.length).toBe(1);
    expect(chunks[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(chunks[0].tokenCount).toBeGreaterThan(5);
  });

  it("correctly chunks structured FAQ items", () => {
    const faqItems = [
      {
        question: "Do you accept Delta Dental insurance?",
        answer: "Yes, Bright Dental is an in-network provider for Delta Dental Premier and PPO plans.",
      },
      {
        question: "Is emergency tooth extraction available?",
        answer: "Yes, we reserve daily slots for urgent emergency procedures and tooth extractions.",
      },
    ];

    const chunks = chunker.chunkFaqItems(faqItems);

    expect(chunks.length).toBe(2);
    expect(chunks[0].headingPath).toBe("FAQ > Do you accept Delta Dental insurance?");
    expect(chunks[0].content).toContain("Delta Dental");
    expect(chunks[1].headingPath).toBe("FAQ > Is emergency tooth extraction available?");
    expect(chunks[1].content).toContain("urgent emergency procedures");
  });
});
