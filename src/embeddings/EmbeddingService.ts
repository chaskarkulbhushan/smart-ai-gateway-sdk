export interface EmbeddingService {
  initialize(): Promise<void>;
  getEmbedding(text: string): Promise<number[]>;
}

export type EmbeddingModel = (text: string) => Promise<number[]>;

export type EmbeddingModelFactory = (
  modelId: string
) => Promise<EmbeddingModel>;

export interface BrowserEmbeddingServiceOptions {
  modelFactory?: EmbeddingModelFactory;
}

export const DEFAULT_EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";