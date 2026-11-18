import { BrowserEmbeddingService } from "../embeddings/BrowserEmbeddingService.js";
import type { EmbeddingService } from "../embeddings/EmbeddingService.js";
import type { FAQEntry } from "../models/FAQEntry.js";
import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";
import type { KnowledgeSource } from "./KnowledgeSource.js";

export interface FAQSourceOptions {
  entries: FAQEntry[];
  embeddingService?: EmbeddingService;
}

interface IndexedFAQEntry {
  question: string;
  answer: string;
  embedding: number[];
}

export class FAQSource implements KnowledgeSource {
  private readonly entries: FAQEntry[];
  private readonly embeddingService: EmbeddingService;
  private index: IndexedFAQEntry[] = [];
  private initialized = false;
  private initializationPromise: Promise<void> | undefined;

  constructor({ entries, embeddingService }: FAQSourceOptions) {
    this.entries = entries.map(({ question, answer }) => ({ question, answer }));
    this.embeddingService = embeddingService ?? new BrowserEmbeddingService();
  }

  initialize(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    let initialization: Promise<void>;
    initialization = Promise.all(
      this.entries.map(async ({ question, answer }) => ({
        question,
        answer,
        embedding: await this.embeddingService.getEmbedding(question),
      })),
    )
      .then((index) => {
        this.index = index;
        this.initialized = true;
      })
      .catch((error: unknown) => {
        if (this.initializationPromise === initialization) {
          this.initializationPromise = undefined;
        }
        throw error;
      });

    this.initializationPromise = initialization;
    return initialization;
  }

  async search(query: string): Promise<KnowledgeResult | null> {
    if (this.entries.length === 0) {
      return null;
    }

    await this.initialize();
    const queryEmbedding = await this.embeddingService.getEmbedding(query);

    let bestMatch: IndexedFAQEntry | undefined;
    let bestSimilarity = Number.NEGATIVE_INFINITY;

    for (const entry of this.index) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity > bestSimilarity) {
        bestMatch = entry;
        bestSimilarity = similarity;
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      answer: bestMatch.answer,
      confidence: (bestSimilarity + 1) / 2,
    };
  }

  getName(): string {
    return "FAQSource";
  }
}