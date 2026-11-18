import { describe, expect, it, vi } from "vitest";
import {
  BrowserEmbeddingService,
} from "../embeddings/BrowserEmbeddingService.js";
import {
  DEFAULT_EMBEDDING_MODEL_ID,
  type EmbeddingModel,
  type EmbeddingModelFactory,
} from "../embeddings/EmbeddingService.js";

describe("BrowserEmbeddingService", () => {
  it("does not load the model during construction", () => {
    const modelFactory = vi.fn<EmbeddingModelFactory>();

    new BrowserEmbeddingService({ modelFactory });

    expect(modelFactory).not.toHaveBeenCalled();
  });

  it("loads the configured model when initialized", async () => {
    const model = async (text: string) => [text.length];
    const modelFactory = vi.fn(async (_modelId: string) => model);
    const service = new BrowserEmbeddingService({ modelFactory });

    await service.initialize();

    expect(modelFactory).toHaveBeenCalledOnce();
    expect(modelFactory).toHaveBeenCalledWith(DEFAULT_EMBEDDING_MODEL_ID);
  });

  it("loads the model on the first embedding request", async () => {
    const model = async (text: string) => [text.length, 1];
    const modelFactory = vi.fn(async (_modelId: string) => model);
    const service = new BrowserEmbeddingService({ modelFactory });

    await expect(service.getEmbedding("hello")).resolves.toEqual([5, 1]);
    expect(modelFactory).toHaveBeenCalledOnce();
  });

  it("shares one in-progress load across concurrent callers", async () => {
    let resolveModel!: (model: EmbeddingModel) => void;
    const modelLoad = new Promise<EmbeddingModel>((resolve) => {
      resolveModel = resolve;
    });
    const modelFactory = vi.fn((_modelId: string) => modelLoad);
    const services = Array.from(
      { length: 5 },
      () => new BrowserEmbeddingService({ modelFactory }),
    );

    const embeddings = services.map((service, index) =>
      service.getEmbedding(`query-${index}`),
    );

    await vi.waitFor(() => expect(modelFactory).toHaveBeenCalledOnce());
    resolveModel(async (text) => [text.length]);

    await expect(Promise.all(embeddings)).resolves.toEqual([
      [7],
      [7],
      [7],
      [7],
      [7],
    ]);
  });

  it("shares a loaded model across service instances", async () => {
    const modelFactory = vi.fn(async (_modelId: string) => async () => [1]);
    const first = new BrowserEmbeddingService({ modelFactory });
    const second = new BrowserEmbeddingService({ modelFactory });

    await Promise.all([first.initialize(), second.initialize()]);

    expect(modelFactory).toHaveBeenCalledOnce();
  });

  it("clears failed load state and allows a successful retry", async () => {
    let shouldFail = true;
    const modelFactory = vi.fn(async (_modelId: string) => {
      if (shouldFail) {
        throw new Error("network unavailable");
      }
      return async (text: string) => [text.length];
    });
    const service = new BrowserEmbeddingService({ modelFactory });

    await expect(service.initialize()).rejects.toThrow(
      /Failed to load embedding model.*network unavailable/,
    );
    shouldFail = false;

    await expect(service.getEmbedding("retry")).resolves.toEqual([5]);
    expect(modelFactory).toHaveBeenCalledTimes(2);
  });
});