import type { KnowledgeResult } from "../models/KnowledgeResult.js";

export interface KnowledgeSource {
  initialize(): Promise<void>;
  search(query: string): Promise<KnowledgeResult | null>;
  getName(): string;
}