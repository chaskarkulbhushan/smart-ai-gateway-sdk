import type { GatewayMetrics } from "./GatewayMetrics.js";

/** Collects query metrics for one SmartAIGateway instance. */
export class MetricsCollector {
  private totalQueries = 0;
  private localAnswers = 0;
  private llmFallbacks = 0;
  private totalResponseTime = 0;
  private estimatedLlmCallsAvoided = 0;
  private estimatedCostAvoidance = 0;

  /**
   * Create a collector with the host's estimated cost per avoided LLM call.
   * @param estimatedLlmCostPerCall Cost estimate, defaults to zero.
   */
  constructor(private readonly estimatedLlmCostPerCall = 0) {}

  /** Record a local answer and its SDK processing duration. */
  recordLocalAnswer(processingTimeMs: number): void {
    this.totalQueries += 1;
    this.localAnswers += 1;
    this.totalResponseTime += processingTimeMs;
    this.estimatedLlmCallsAvoided += 1;
    this.estimatedCostAvoidance += this.estimatedLlmCostPerCall;
  }

  /** Record an escalation decision and its SDK processing duration. */
  recordEscalation(processingTimeMs: number): void {
    this.totalQueries += 1;
    this.llmFallbacks += 1;
    this.totalResponseTime += processingTimeMs;
  }

  /** Return a frozen snapshot without exposing mutable collector state. */
  getMetrics(): GatewayMetrics {
    const totalQueries = this.totalQueries;
    const metrics: GatewayMetrics = {
      totalQueries,
      localAnswers: this.localAnswers,
      llmFallbacks: this.llmFallbacks,
      localHitRate:
        totalQueries === 0 ? 0 : (this.localAnswers / totalQueries) * 100,
      llmEscalationRate:
        totalQueries === 0 ? 0 : (this.llmFallbacks / totalQueries) * 100,
      estimatedLlmCallsAvoided: this.estimatedLlmCallsAvoided,
      averageResponseTime:
        totalQueries === 0 ? 0 : this.totalResponseTime / totalQueries,
      estimatedCostAvoidance: this.estimatedCostAvoidance,
    };

    return Object.freeze(metrics);
  }
}