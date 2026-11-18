import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

/** Configuration accepted by SmartAIGateway. */
export interface SmartAIGatewayOptions {
  /** Confidence boundary reserved for gateway routing; defaults to 0.85. */
  threshold?: number;
  /** Knowledge sources initialized by the gateway. At least one is required. */
  sources: KnowledgeSource[];
  /** Estimated cost of one avoided LLM call; defaults to 0. */
  estimatedLlmCostPerCall?: number;
}