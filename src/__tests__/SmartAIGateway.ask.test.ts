import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import { SmartAIGateway } from "../core/SmartAIGateway.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

class FakeKnowledgeSource implements KnowledgeSource {
  initializeCalls = 0;

  constructor(
    private readonly sourceName: string,
    private readonly result: KnowledgeResult | null,
  ) {}

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
  }

  async search(_query: string): Promise<KnowledgeResult | null> {
    return this.result;
  }

  getName(): string {
    return this.sourceName;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SmartAIGateway.ask", () => {
  it("returns the best above-threshold result as local", async () => {
    const gateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("faq-high", {
        answer: "Reset through account settings.",
        confidence: 0.9,
      })],
    });

    await expect(gateway.ask("reset password")).resolves.toMatchObject({
      answer: "Reset through account settings.",
      source: "local",
      confidence: 0.9,
      matchedSource: "faq-high",
      reason: "Matched local source",
    });
  });

  it("treats confidence equal to threshold as local", async () => {
    const gateway = new SmartAIGateway({
      threshold: 0.85,
      sources: [new FakeKnowledgeSource("faq", { answer: "Answer", confidence: 0.85 })],
    });

    await expect(gateway.ask("question")).resolves.toMatchObject({
      answer: "Answer",
      source: "local",
      confidence: 0.85,
      matchedSource: "faq",
    });
  });

  it("returns an escalation decision when confidence is below threshold", async () => {
    const gateway = new SmartAIGateway({
      threshold: 0.85,
      sources: [new FakeKnowledgeSource("faq", { answer: "Weak answer", confidence: 0.84 })],
    });

    const result = await gateway.ask("question");

    expect(result).toEqual({
      answer: "",
      source: "llm",
      confidence: 0.84,
      reason: "Best result below threshold",
      processingTimeMs: expect.any(Number),
    });
    expect(result).not.toHaveProperty("matchedSource");
  });

  it("returns the no-local-answer escalation when sources return null", async () => {
    const gateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("empty", null)],
    });

    const result = await gateway.ask("unknown question");

    expect(result).toEqual({
      answer: "",
      source: "llm",
      confidence: 0,
      reason: "No local answer found",
      processingTimeMs: expect.any(Number),
    });
    expect(result).not.toHaveProperty("matchedSource");
  });

  it("returns the source name with local answers and populates processing time", async () => {
    const gateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("product-faq", { answer: "Answer", confidence: 1 })],
    });

    const result = await gateway.ask("question");

    expect(result.matchedSource).toBe("product-faq");
    expect(Number.isFinite(result.processingTimeMs)).toBe(true);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("auto-initializes and initializes sources only once across asks", async () => {
    const source = new FakeKnowledgeSource("faq", { answer: "Answer", confidence: 1 });
    const gateway = new SmartAIGateway({ sources: [source] });

    await Promise.all([gateway.ask("first"), gateway.ask("second")]);

    expect(source.initializeCalls).toBe(1);
  });

  it("always uses one of the defined source values", async () => {
    const localGateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("faq", { answer: "Answer", confidence: 1 })],
    });
    const escalationGateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("empty", null)],
    });

    const results = await Promise.all([
      localGateway.ask("known"),
      escalationGateway.ask("unknown"),
    ]);

    expect(results.map(({ source }) => source)).toEqual(["local", "llm"]);
  });

  it("does not make network or provider calls for escalation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const gateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("empty", null)],
    });

    const result = await gateway.ask("unknown");

    expect(result.source).toBe("llm");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates unexpected router errors", async () => {
    const gateway = new SmartAIGateway({
      sources: [new FakeKnowledgeSource("faq", { answer: "Answer", confidence: 1 })],
    });
    const error = new Error("router failure");
    vi.spyOn(globalThis.performance, "now")
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2);
    const router = (gateway as unknown as { router: { search: () => Promise<never> } }).router;
    vi.spyOn(router, "search").mockRejectedValue(error);

    await expect(gateway.ask("question")).rejects.toBe(error);
  });
});