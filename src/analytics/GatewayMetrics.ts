/** Immutable snapshot of query-resolution and estimated cost metrics. */
export interface GatewayMetrics {
  readonly totalQueries: number;
  readonly localAnswers: number;
  readonly llmFallbacks: number;
  readonly localHitRate: number;
  readonly llmEscalationRate: number;
  readonly estimatedLlmCallsAvoided: number;
  readonly averageResponseTime: number;
  readonly estimatedCostAvoidance: number;
}