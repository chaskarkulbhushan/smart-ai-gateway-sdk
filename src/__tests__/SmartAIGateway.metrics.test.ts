import { describe, expect, it } from "vitest";
import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import { SmartAIGateway } from "../core/SmartAIGateway.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

class SequenceSource implements KnowledgeSource {
  initializeCalls = 0;
  private nextResultIndex = 0;

  constructor(private readonly results: Array<KnowledgeResult | null>) {}

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
  }

  async search(_query: string): Promise<KnowledgeResult | null> {
    const result = this.results[this.nextResultIndex % this.results.length] ?? null;
    this.nextResultIndex += 1;
    return result;
  }

  getName(): string {
    return "SequenceSource";
  }
}

describe("SmartAIGateway metrics", () => {
  it("tracks local answers and escalations per gateway instance", async () => {
    const source = new SequenceSource([
      { answer: "Local answer", confidence: 0.9 },
      null,
    ]);
    const gateway = new SmartAIGateway({
      threshold: 0.85,
      estimatedLlmCostPerCall: 0.002,
      sources: [source],
    });

    await gateway.ask("local question");
    await gateway.ask("unknown question");

    const metrics = gateway.getMetrics();
    expect(metrics.totalQueries).toBe(2);
    expect(metrics.localAnswers).toBe(1);
    expect(metrics.llmFallbacks).toBe(1);
    expect(metrics.localHitRate).toBe(50);
    expect(metrics.llmEscalationRate).toBe(50);
    expect(metrics.estimatedLlmCallsAvoided).toBe(1);
    expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    expect(metrics.estimatedCostAvoidance).toBe(0.002);
  });

  it("keeps metrics independent between gateway instances", async () => {
    const localGateway = new SmartAIGateway({
      sources: [new SequenceSource([{ answer: "Local", confidence: 1 }])],
    });
    const escalationGateway = new SmartAIGateway({
      sources: [new SequenceSource([null])],
    });

    await localGateway.ask("known");

    expect(localGateway.getMetrics().totalQueries).toBe(1);
    expect(escalationGateway.getMetrics().totalQueries).toBe(0);
    expect(escalationGateway.getMetrics().localAnswers).toBe(0);
  });

  it("records concurrent asks without lost updates", async () => {
    const gateway = new SmartAIGateway({
      sources: [new SequenceSource([{ answer: "Local", confidence: 1 }])],
    });

    await Promise.all(
      Array.from({ length: 100 }, (_, index) => gateway.ask(`question-${index}`)),
    );

    const metrics = gateway.getMetrics();
    expect(metrics.totalQueries).toBe(100);
    expect(metrics.localAnswers).toBe(100);
    expect(metrics.llmFallbacks).toBe(0);
    expect(metrics.localHitRate).toBe(100);
    expect(metrics.estimatedLlmCallsAvoided).toBe(100);
  });

  it("returns frozen snapshots rather than an internal mutable reference", async () => {
    const gateway = new SmartAIGateway({
      sources: [new SequenceSource([{ answer: "Local", confidence: 1 }])],
    });
    const snapshot = gateway.getMetrics();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Reflect.set(snapshot, "totalQueries", 42)).toBe(false);

    await gateway.ask("question");

    expect(snapshot.totalQueries).toBe(0);
    expect(gateway.getMetrics().totalQueries).toBe(1);
  });
});