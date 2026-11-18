import { describe, expect, it, vi } from "vitest";
import type { SmartAIGatewayOptions } from "../models/SmartAIGatewayOptions.js";
import { SmartAIGateway } from "../core/SmartAIGateway.js";
import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

class FakeKnowledgeSource implements KnowledgeSource {
  initializeCalls = 0;
  searchCalls = 0;

  constructor(private readonly name = "FakeKnowledgeSource") {}

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
  }

  async search(_query: string): Promise<KnowledgeResult | null> {
    this.searchCalls += 1;
    return null;
  }

  getName(): string {
    return this.name;
  }
}

class SecondFakeKnowledgeSource implements KnowledgeSource {
  initializeCalls = 0;
  searchCalls = 0;

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
  }

  async search(_query: string): Promise<KnowledgeResult | null> {
    this.searchCalls += 1;
    return null;
  }

  getName(): string {
    return "SecondFakeKnowledgeSource";
  }
}

function createGatewayOptions(
  sources: KnowledgeSource[] = [new FakeKnowledgeSource()],
  overrides: Partial<SmartAIGatewayOptions> = {},
): SmartAIGatewayOptions {
  return { sources, ...overrides };
}

describe("SmartAIGateway initialization and configuration", () => {
  it("initializes every registered source", async () => {
    const first = new FakeKnowledgeSource();
    const second = new SecondFakeKnowledgeSource();
    const gateway = new SmartAIGateway({ sources: [first, second] });

    await gateway.initialize();

    expect(first.initializeCalls).toBe(1);
    expect(second.initializeCalls).toBe(1);
  });

  it("initializes each source exactly once after repeated initialization", async () => {
    const source = new FakeKnowledgeSource();
    const gateway = new SmartAIGateway({ sources: [source] });

    await gateway.initialize();
    await gateway.initialize();

    expect(source.initializeCalls).toBe(1);
  });

  it("shares one initialization run between concurrent callers", async () => {
    let resolveInitialization!: () => void;
    const initialization = new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    });
    const source = new FakeKnowledgeSource();
    vi.spyOn(source, "initialize").mockReturnValue(initialization);
    const gateway = new SmartAIGateway({ sources: [source] });

    const callers = [gateway.initialize(), gateway.initialize(), gateway.initialize()];

    expect(source.initialize).toHaveBeenCalledOnce();
    resolveInitialization();
    await Promise.all(callers);
  });

  it("clears failed initialization state and allows a retry", async () => {
    const source = new FakeKnowledgeSource();
    vi.spyOn(source, "initialize")
      .mockRejectedValueOnce(new Error("temporary initialization failure"))
      .mockResolvedValueOnce();
    const gateway = new SmartAIGateway({ sources: [source] });

    await expect(gateway.initialize()).rejects.toThrow(
      "temporary initialization failure",
    );
    await expect(gateway.initialize()).resolves.toBeUndefined();

    expect(source.initialize).toHaveBeenCalledTimes(2);
  });

  it("defaults threshold and estimated call cost", () => {
    const gateway = new SmartAIGateway(createGatewayOptions());

    expect(gateway.threshold).toBe(0.85);
    expect(gateway.estimatedLlmCostPerCall).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01])(
    "rejects invalid threshold %s",
    (threshold) => {
      expect(
        () => new SmartAIGateway(createGatewayOptions(undefined, { threshold })),
      ).toThrow("threshold must be a finite number between 0 and 1.");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01])(
    "rejects invalid estimated call cost %s",
    (estimatedLlmCostPerCall) => {
      expect(
        () =>
          new SmartAIGateway(
            createGatewayOptions(undefined, { estimatedLlmCostPerCall }),
          ),
      ).toThrow(
        "estimatedLlmCostPerCall must be a finite non-negative number.",
      );
    },
  );

  it("rejects missing and empty sources", () => {
    expect(
      () =>
        new SmartAIGateway(
          undefined as unknown as SmartAIGatewayOptions,
        ),
    ).toThrow("SmartAIGateway requires a sources array.");
    expect(() => new SmartAIGateway({ sources: [] })).toThrow(
      "SmartAIGateway requires at least one source.",
    );
  });

  it("initializes distinct source implementations without gateway changes", async () => {
    const first = new FakeKnowledgeSource();
    const second = new SecondFakeKnowledgeSource();
    const gateway = new SmartAIGateway({ sources: [first, second] });

    await gateway.initialize();

    expect(first.getName()).toBe("FakeKnowledgeSource");
    expect(second.getName()).toBe("SecondFakeKnowledgeSource");
    expect(first.initializeCalls).toBe(1);
    expect(second.initializeCalls).toBe(1);
  });
});