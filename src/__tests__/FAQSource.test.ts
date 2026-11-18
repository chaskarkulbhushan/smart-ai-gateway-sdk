import { describe, expect, it, vi } from "vitest";
import type { EmbeddingService } from "../embeddings/EmbeddingService.js";
import { FAQSource } from "../sources/FAQSource.js";

function createEmbeddingService(
  vectors: Record<string, number[]>,
): EmbeddingService & { getEmbedding: ReturnType<typeof vi.fn> } {
  return {
    initialize: vi.fn(async () => {}),
    getEmbedding: vi.fn(async (text: string) => {
      const embedding = vectors[text];
      if (!embedding) {
        throw new Error(`No test embedding configured for: ${text}`);
      }
      return embedding;
    }),
  };
}

describe("FAQSource", () => {
  it("returns null for an empty FAQ source without requesting embeddings", async () => {
    const embeddingService = createEmbeddingService({});
    const source = new FAQSource({ entries: [], embeddingService });

    await expect(source.search("any question")).resolves.toBeNull();
    expect(embeddingService.getEmbedding).not.toHaveBeenCalled();
  });

  it("embeds each FAQ question once during initialization", async () => {
    const embeddingService = createEmbeddingService({
      "Question one": [1, 0],
      "Question two": [0, 1],
    });
    const source = new FAQSource({
      entries: [
        { question: "Question one", answer: "Answer one" },
        { question: "Question two", answer: "Answer two" },
      ],
      embeddingService,
    });

    await source.initialize();

    expect(embeddingService.getEmbedding).toHaveBeenCalledTimes(2);
    expect(embeddingService.getEmbedding).toHaveBeenNthCalledWith(1, "Question one");
    expect(embeddingService.getEmbedding).toHaveBeenNthCalledWith(2, "Question two");
  });

  it("returns the FAQ with the best cosine match", async () => {
    const embeddingService = createEmbeddingService({
      "Billing question": [0, 1],
      "Password question": [1, 0],
      "reset credentials": [0.98, 0.2],
    });
    const source = new FAQSource({
      entries: [
        { question: "Billing question", answer: "Billing answer" },
        { question: "Password question", answer: "Password answer" },
      ],
      embeddingService,
    });

    await expect(source.search("reset credentials")).resolves.toEqual({
      answer: "Password answer",
      confidence: expect.any(Number),
    });
  });

  it("matches the password paraphrase fixture", async () => {
    const embeddingService = createEmbeddingService({
      "How do I reset my password?": [1, 0],
      "Where can I see my invoices?": [0, 1],
      "How can I change my password?": [0.95, 0.05],
    });
    const source = new FAQSource({
      entries: [
        {
          question: "How do I reset my password?",
          answer: "Use the password reset link on the sign-in page.",
        },
        {
          question: "Where can I see my invoices?",
          answer: "Invoices are available in billing settings.",
        },
      ],
      embeddingService,
    });

    await expect(
      source.search("How can I change my password?"),
    ).resolves.toMatchObject({
      answer: "Use the password reset link on the sign-in page.",
    });
  });

  it("returns the highest-confidence FAQ", async () => {
    const embeddingService = createEmbeddingService({
      "FAQ A": [0.8, 0.6],
      "FAQ B": [1, 0],
      query: [1, 0],
    });
    const source = new FAQSource({
      entries: [
        { question: "FAQ A", answer: "Lower-confidence answer" },
        { question: "FAQ B", answer: "Highest-confidence answer" },
      ],
      embeddingService,
    });

    await expect(source.search("query")).resolves.toEqual({
      answer: "Highest-confidence answer",
      confidence: 1,
    });
  });

  it("keeps confidence within [0, 1]", async () => {
    const embeddingService = createEmbeddingService({
      FAQ: [1, 0],
      aligned: [1, 0],
      opposite: [-1, 0],
      orthogonal: [0, 1],
      zero: [0, 0],
    });
    const source = new FAQSource({
      entries: [{ question: "FAQ", answer: "FAQ answer" }],
      embeddingService,
    });

    for (const [query, expectedConfidence] of [
      ["aligned", 1],
      ["opposite", 0],
      ["orthogonal", 0.5],
      ["zero", 0.5],
    ] as const) {
      const result = await source.search(query);
      expect(result?.confidence).toBeGreaterThanOrEqual(0);
      expect(result?.confidence).toBeLessThanOrEqual(1);
      expect(result?.confidence).toBeCloseTo(expectedConfidence);
    }
  });

  it("reuses indexed FAQ embeddings across searches", async () => {
    const embeddingService = createEmbeddingService({
      "FAQ question": [1, 0],
      "query one": [1, 0],
      "query two": [0.9, 0.1],
    });
    const source = new FAQSource({
      entries: [{ question: "FAQ question", answer: "FAQ answer" }],
      embeddingService,
    });

    await source.search("query one");
    await source.search("query two");

    expect(embeddingService.getEmbedding).toHaveBeenCalledTimes(3);
    expect(embeddingService.getEmbedding).toHaveBeenCalledWith("FAQ question");
  });

  it("does not re-embed FAQs when initialized repeatedly", async () => {
    const embeddingService = createEmbeddingService({
      "FAQ question": [1, 0],
    });
    const source = new FAQSource({
      entries: [{ question: "FAQ question", answer: "FAQ answer" }],
      embeddingService,
    });

    await Promise.all([source.initialize(), source.initialize()]);
    await source.initialize();

    expect(embeddingService.getEmbedding).toHaveBeenCalledTimes(1);
  });

  it('returns the name "FAQSource"', () => {
    const source = new FAQSource({ entries: [] });

    expect(source.getName()).toBe("FAQSource");
  });
});