import { describe, expect, it } from "vitest";
import {
  BrowserEmbeddingService,
  FAQSource,
  SmartAIGateway,
} from "../index.js";
import type {
  AskResult,
  EmbeddingService,
  FAQEntry,
  GatewayMetrics,
  KnowledgeResult,
  KnowledgeSource,
  SmartAIGatewayOptions,
} from "../index.js";

class ConsumerSource implements KnowledgeSource {
  async initialize(): Promise<void> {}

  async search(_query: string): Promise<KnowledgeResult | null> {
    return null;
  }

  getName(): string {
    return "ConsumerSource";
  }
}

describe("public SDK entry point", () => {
  it("exports constructible APIs and resolves public contracts", () => {
    const embeddingService: EmbeddingService = {
      async initialize(): Promise<void> {},
      async getEmbedding(_text: string): Promise<number[]> {
        return [1, 0];
      },
    };
    const entries: FAQEntry[] = [
      { question: "Question", answer: "Answer" },
    ];
    const faqSource = new FAQSource({ entries, embeddingService });
    const options: SmartAIGatewayOptions = {
      threshold: 0.85,
      sources: [faqSource, new ConsumerSource()],
    };
    const gateway = new SmartAIGateway(options);
    const browserEmbeddingService = new BrowserEmbeddingService();
    const askResult: AskResult = {
      answer: "",
      source: "llm",
      confidence: 0,
      reason: "No local answer found",
      processingTimeMs: 0,
    };
    const metrics: GatewayMetrics = gateway.getMetrics();

    expect(browserEmbeddingService).toBeInstanceOf(BrowserEmbeddingService);
    expect(faqSource).toBeInstanceOf(FAQSource);
    expect(gateway).toBeInstanceOf(SmartAIGateway);
    expect(askResult.source).toBe("llm");
    expect(metrics.totalQueries).toBe(0);
  });
});