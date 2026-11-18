import type {
  BrowserEmbeddingServiceOptions,
  EmbeddingModel,
  EmbeddingModelFactory,
  EmbeddingService,
} from "./EmbeddingService.js";
import { DEFAULT_EMBEDDING_MODEL_ID } from "./EmbeddingService.js";

const defaultModelFactory: EmbeddingModelFactory = async (modelId) => {
  const { env, pipeline } = await import("@xenova/transformers");

  // Prevent checking localhost:5173/models/ before fetching from Hugging Face
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const extractor = await pipeline("feature-extraction", modelId);

  return async (text) => {
    const result = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(result.data as Float32Array);
  };
};

const sharedModelLoads = new WeakMap<
  EmbeddingModelFactory,
  Promise<EmbeddingModel>
>();

function getSharedModel(factory: EmbeddingModelFactory): Promise<EmbeddingModel> {
  const existingLoad = sharedModelLoads.get(factory);
  if (existingLoad) {
    return existingLoad;
  }

  let modelLoad: Promise<EmbeddingModel>;
  modelLoad = Promise.resolve()
    .then(() => factory(DEFAULT_EMBEDDING_MODEL_ID))
    .catch((error: unknown) => {
      if (sharedModelLoads.get(factory) === modelLoad) {
        sharedModelLoads.delete(factory);
      }

      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load embedding model "${DEFAULT_EMBEDDING_MODEL_ID}": ${detail}`,
        { cause: error },
      );
    });

  sharedModelLoads.set(factory, modelLoad);
  return modelLoad;
}

export class BrowserEmbeddingService implements EmbeddingService {
  private readonly modelFactory: EmbeddingModelFactory;

  constructor(options: BrowserEmbeddingServiceOptions = {}) {
    this.modelFactory = options.modelFactory ?? defaultModelFactory;
  }

  async initialize(): Promise<void> {
    await getSharedModel(this.modelFactory);
  }

  async getEmbedding(text: string): Promise<number[]> {
    const model = await getSharedModel(this.modelFactory);
    return model(text);
  }
}
