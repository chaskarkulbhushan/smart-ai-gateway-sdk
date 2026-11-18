import { describe, expect, it } from "vitest";
import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import { Router } from "../core/Router.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

class FakeKnowledgeSource implements KnowledgeSource {
  searchCalls = 0;

  constructor(
    private readonly name: string,
    private readonly result: KnowledgeResult | null,
    private readonly failure?: Error,
    private readonly searchTask?: () => Promise<KnowledgeResult | null>,
  ) {}

  async initialize(): Promise<void> {}

  async search(_query: string): Promise<KnowledgeResult | null> {
    this.searchCalls += 1;
    if (this.searchTask) {
      return this.searchTask();
    }
    if (this.failure) {
      throw this.failure;
    }
    return this.result;
  }

  getName(): string {
    return this.name;
  }
}

function result(answer: string, confidence: number): KnowledgeResult {
  return { answer, confidence };
}

describe("Router", () => {
  it("returns the result from a single source", async () => {
    const source = new FakeKnowledgeSource(
      "single",
      result("one answer", 0.7),
    );

    await expect(new Router([source]).search("question")).resolves.toEqual({
      result: result("one answer", 0.7),
      sourceName: "single",
    });
  });

  it("searches multiple sources and returns the highest-confidence result", async () => {
    const router = new Router([
      new FakeKnowledgeSource("lower", result("lower answer", 0.4)),
      new FakeKnowledgeSource("higher", result("higher answer", 0.9)),
    ]);

    await expect(router.search("question")).resolves.toEqual({
      result: result("higher answer", 0.9),
      sourceName: "higher",
    });
  });

  it("keeps the first registered source when confidence ties", async () => {
    const router = new Router([
      new FakeKnowledgeSource("first", result("first answer", 0.8)),
      new FakeKnowledgeSource("second", result("second answer", 0.8)),
    ]);

    await expect(router.search("question")).resolves.toEqual({
      result: result("first answer", 0.8),
      sourceName: "first",
    });
  });

  it("returns null when all sources return null", async () => {
    const router = new Router([
      new FakeKnowledgeSource("first", null),
      new FakeKnowledgeSource("second", null),
    ]);

    await expect(router.search("question")).resolves.toBeNull();
  });

  it("ignores a failed source when another source succeeds", async () => {
    const router = new Router([
      new FakeKnowledgeSource("failed", null, new Error("source unavailable")),
      new FakeKnowledgeSource("working", result("answer", 0.75)),
    ]);

    await expect(router.search("question")).resolves.toEqual({
      result: result("answer", 0.75),
      sourceName: "working",
    });
  });

  it("returns null when every source fails", async () => {
    const router = new Router([
      new FakeKnowledgeSource("first", null, new Error("first failed")),
      new FakeKnowledgeSource("second", null, new Error("second failed")),
    ]);

    await expect(router.search("question")).resolves.toBeNull();
  });

  it("selects the best successful result among mixed failures and successes", async () => {
    const router = new Router([
      new FakeKnowledgeSource("low", result("low", 0.5)),
      new FakeKnowledgeSource("failure", null, new Error("failed")),
      new FakeKnowledgeSource("best", result("best", 0.95)),
    ]);

    await expect(router.search("question")).resolves.toEqual({
      result: result("best", 0.95),
      sourceName: "best",
    });
  });

  it("returns the selected source name", async () => {
    const router = new Router([
      new FakeKnowledgeSource("named-source", result("answer", 0.6)),
    ]);

    await expect(router.search("question")).resolves.toMatchObject({
      sourceName: "named-source",
    });
  });

  it("starts all source searches before waiting for their results", async () => {
    const pendingResolves: Array<(value: KnowledgeResult | null) => void> = [];
    const sources = ["first", "second", "third"].map(
      (name) =>
        new FakeKnowledgeSource(
          name,
          null,
          undefined,
          () =>
            new Promise<KnowledgeResult | null>((resolve) => {
              pendingResolves.push(resolve);
            }),
        ),
    );
    const router = new Router(sources);

    const search = router.search("question");
    await Promise.resolve();

    expect(sources.map((source) => source.searchCalls)).toEqual([1, 1, 1]);

    pendingResolves[0]!(result("first", 0.4));
    pendingResolves[1]!(result("second", 0.6));
    pendingResolves[2]!(result("third", 0.8));

    await expect(search).resolves.toEqual({
      result: result("third", 0.8),
      sourceName: "third",
    });
  });

  it("does not apply threshold decisions", async () => {
    const router = new Router([
      new FakeKnowledgeSource("low-confidence", result("answer", 0.01)),
    ]);

    await expect(router.search("question")).resolves.toEqual({
      result: result("answer", 0.01),
      sourceName: "low-confidence",
    });
  });
});