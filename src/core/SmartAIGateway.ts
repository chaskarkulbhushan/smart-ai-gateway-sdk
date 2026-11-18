import type { SmartAIGatewayOptions } from "../models/SmartAIGatewayOptions.js";
import type { AskResult } from "../models/AskResult.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";
import type { GatewayMetrics } from "../analytics/GatewayMetrics.js";
import { MetricsCollector } from "../analytics/MetricsCollector.js";
import { Router } from "./Router.js";

const DEFAULT_THRESHOLD = 0.85;

/** Validates gateway configuration and initializes its registered sources. */
export class SmartAIGateway {
  /** The validated confidence threshold reserved for future routing behavior. */
  readonly threshold: number;

  /** The validated cost estimate reserved for future metrics behavior. */
  readonly estimatedLlmCostPerCall: number;

  /** Registered source plugins. */
  readonly sources: readonly KnowledgeSource[];

  private readonly router: Router;
  private readonly metricsCollector: MetricsCollector;
  private initialized = false;
  private initializationPromise: Promise<void> | undefined;

  /**
   * Create a gateway configured with at least one source.
   * @param options Gateway configuration.
   * @throws {TypeError} When options or sources are missing or sources is not an array.
   * @throws {RangeError} When a numeric option is outside its supported range.
   */
  constructor(options: SmartAIGatewayOptions) {
    if (!options || !Array.isArray(options.sources)) {
      throw new TypeError("SmartAIGateway requires a sources array.");
    }
    if (options.sources.length === 0) {
      throw new RangeError("SmartAIGateway requires at least one source.");
    }

    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new RangeError("threshold must be a finite number between 0 and 1.");
    }

    const estimatedLlmCostPerCall = options.estimatedLlmCostPerCall ?? 0;
    if (!Number.isFinite(estimatedLlmCostPerCall) || estimatedLlmCostPerCall < 0) {
      throw new RangeError(
        "estimatedLlmCostPerCall must be a finite non-negative number.",
      );
    }

    this.threshold = threshold;
    this.estimatedLlmCostPerCall = estimatedLlmCostPerCall;
    this.sources = Object.freeze([...options.sources]);
    this.router = new Router([...this.sources]);
    this.metricsCollector = new MetricsCollector(this.estimatedLlmCostPerCall);
  }

  /**
   * Initialize all registered sources in parallel. Concurrent callers share the same run.
   * A rejected run clears its cached state so a later call can retry.
   */
  initialize(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    let initialization: Promise<void>;
    initialization = Promise.all(
      this.sources.map((source) => source.initialize()),
    )
      .then(() => {
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

  /**
   * Search local sources and return either the best local answer or an escalation decision.
   * @param question Question to route through the registered sources.
   */
  async ask(question: string): Promise<AskResult> {
    const startedAt = globalThis.performance.now();
    await this.initialize();
    const routedResult = await this.router.search(question);

    if (routedResult === null) {
      const processingTimeMs = Math.max(
        0,
        globalThis.performance.now() - startedAt,
      );
      this.metricsCollector.recordEscalation(processingTimeMs);
      return {
        answer: "",
        source: "llm",
        confidence: 0,
        reason: "No local answer found",
        processingTimeMs,
      };
    }

    if (routedResult.result.confidence >= this.threshold) {
      const processingTimeMs = Math.max(
        0,
        globalThis.performance.now() - startedAt,
      );
      this.metricsCollector.recordLocalAnswer(processingTimeMs);
      return {
        answer: routedResult.result.answer,
        source: "local",
        confidence: routedResult.result.confidence,
        matchedSource: routedResult.sourceName,
        reason: "Matched local source",
        processingTimeMs,
      };
    }

    const processingTimeMs = Math.max(
      0,
      globalThis.performance.now() - startedAt,
    );
    this.metricsCollector.recordEscalation(processingTimeMs);
    return {
      answer: "",
      source: "llm",
      confidence: routedResult.result.confidence,
      reason: "Best result below threshold",
      processingTimeMs,
    };
  }

  /** Return an immutable snapshot of metrics for this gateway instance. */
  getMetrics(): GatewayMetrics {
    return this.metricsCollector.getMetrics();
  }
}