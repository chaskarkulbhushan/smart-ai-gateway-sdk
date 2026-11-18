# Design

## Context

The repository is a minimal TypeScript package scaffold. `package.json` builds `src/index.ts` with tsup, strict TypeScript options are enabled, and there is no implementation, test suite, or existing capability spec. See `proposal.md` for motivation and `specs/smart-ai-gateway/spec.md` for the behavior contract.

## Goals / Non-Goals

**Goals:**
- Keep the public API framework-agnostic and consumable from a single package entry point.
- Keep question embedding and knowledge retrieval in the browser, with an injectable boundary around model loading for tests and future runtimes.
- Make the gateway resilient to individual source failures and deterministic when selecting results.
- Make estimated cost metrics interpretable and configurable by the host application.

**Non-Goals:**
- Calling or selecting a provider-specific LLM, or returning a generated LLM answer.
- Persisting a vector index on a server, synchronizing indexes, or adding authentication and tenant isolation.
- Training or fine-tuning the embedding model.

## Decisions

### Component architecture

```text
Host application
      |
      v
SmartAIGateway -----> Metrics collector
      |
      v
Router --parallel--> KnowledgeSource[]
                         |
                         v
                   FAQSource (MVP)
                         |
                         v
                  EmbeddingService
                         |
                         v
          Transformers.js + local model
```

`SmartAIGateway` owns initialization, request timing, result routing, and metrics. The router depends only on the source contract. `FAQSource` owns FAQ indexing and semantic ranking. The embedding service owns model lifecycle and is shared by the default source instances. Additional sources are registered in configuration and do not require gateway changes.

### Public TypeScript contracts and data models

The types below are the proposed public surface; implementations remain behind these contracts.

```ts
export interface KnowledgeSource {
  initialize(): Promise<void>;
  search(query: string): Promise<KnowledgeResult | null>;
  getName(): string;
}

export interface KnowledgeResult {
  answer: string;
  confidence: number;
}

export interface FAQEntry {
  question: string;
  answer: string;
}

export interface EmbeddingService {
  initialize(): Promise<void>;
  getEmbedding(text: string): Promise<number[]>;
}

export type EmbeddingModelFactory = (
  modelId: string
) => Promise<(text: string) => Promise<number[]>>;

export interface BrowserEmbeddingServiceOptions {
  modelFactory?: EmbeddingModelFactory;
}

export declare class BrowserEmbeddingService implements EmbeddingService {
  constructor(options?: BrowserEmbeddingServiceOptions);
  initialize(): Promise<void>;
  getEmbedding(text: string): Promise<number[]>;
}

export interface FAQSourceOptions {
  entries: FAQEntry[];
  embeddingService?: EmbeddingService;
}

export declare class FAQSource implements KnowledgeSource {
  constructor(options: FAQSourceOptions);
  initialize(): Promise<void>;
  search(query: string): Promise<KnowledgeResult | null>;
  getName(): string;
}

export interface SmartAIGatewayOptions {
  threshold?: number;
  sources: KnowledgeSource[];
  estimatedLlmCostPerCall?: number;
}

export interface AskResult {
  answer: string;
  source: "local" | "llm";
  confidence: number;
  matchedSource?: string;
  reason: string;
  processingTimeMs: number;
}

export interface GatewayMetrics {
  totalQueries: number;
  localAnswers: number;
  llmFallbacks: number;
  localHitRate: number;
  llmEscalationRate: number;
  estimatedLlmCallsAvoided: number;
  averageResponseTime: number;
  estimatedCostAvoidance: number;
}

export declare class SmartAIGateway {
  constructor(options: SmartAIGatewayOptions);
  initialize(): Promise<void>;
  ask(question: string): Promise<AskResult>;
  getMetrics(): GatewayMetrics;
}
```

The constructor defaults `threshold` to `0.85` and `estimatedLlmCostPerCall` to `0`. Threshold and confidence values are finite numbers in `[0, 1]`; invalid configuration is rejected during construction. A source returns its best result or `null`. A source result's confidence is normalized to `[0, 1]` so heterogeneous plugins use the same threshold contract.

For `FAQSource`, each FAQ entry's question is embedded during source initialization. At search time, the query is embedded and compared to indexed vectors with cosine similarity. The FAQ source maps cosine similarity from `[-1, 1]` to confidence `[0, 1]` using `(similarity + 1) / 2`; it returns the entry with the highest score. Empty FAQ input yields no result. Indexes remain in memory for the gateway/source lifetime.

`AskResult.source === "llm"` means escalation is selected, not that an LLM call occurred. The MVP returns an empty `answer`, the best available confidence (or `0` when no result exists), and a reason; the host application then decides whether and how to call its LLM. The SDK does not transmit the question to a provider. `matchedSource` is omitted on escalations.

Metrics are scoped to one gateway instance. `llmFallbacks` counts escalation decisions, not confirmed provider calls. `estimatedLlmCallsAvoided` equals `localAnswers`; `estimatedCostAvoidance` equals that count multiplied by the configured estimated cost per call. Rates and average response time are `0` when no requests have completed. `getMetrics()` returns a snapshot, not mutable internal state. Processing time includes SDK embedding and routing work and excludes any later host LLM request.

### Initialization, source failures, and routing

`initialize()` is idempotent and shares in-progress initialization. The embedding model is loaded lazily on the first embedding-dependent initialization or search, not at module import. A module-level shared load promise prevents concurrent callers from loading/downloading duplicate model instances in one application runtime. Use Transformers.js with model `Xenova/all-MiniLM-L6-v2`; keep model loading behind an injectable factory so tests do not download assets. The installed `@xenova/transformers` 2.17.2 runtime uses WebAssembly in browsers. The factory abstraction allows a future WebGPU-capable runtime to be substituted without changing the embedding service or downstream consumers; the runtime must not substitute a hosted embedding service.

The router invokes registered sources concurrently and waits for all results before selecting the highest confidence. If a source rejects, its result is treated as unavailable and the other results are still considered. If every source returns no result or fails, routing returns the standard escalation response. Ties are resolved by source registration order, making results deterministic. The configured threshold is inclusive.

```text
Question --> Gateway.ask --> Router --> all registered sources
                                  |          |
                                  |          +--> result / no result / failure
                                  v
                         highest confidence
                           /           \
                 score >= threshold   score < threshold or none
                        |                         |
                  local response          escalation response
                        |                         |
                        +------> metrics <--------+
                                      |
                                      v
                               return to host
                                      |
                           host may call its LLM
```

### Request sequence

```text
Application       Gateway       Router       FAQSource       EmbeddingService
     |                |             |              |                  |
     |--initialize--->|             |              |                  |
     |                |--initialize--------------->|                  |
     |                |             |              |--embed FAQs----->|
     |                |             |              |<--vectors--------|
     |<--ready--------|             |              |                  |
     |                |             |              |                  |
     |--ask(question)>|             |              |                  |
     |                |--search all sources------->|                  |
     |                |             |              |--embed query---->|
     |                |             |              |<--query vector---|
     |                |             |<--top match---|                  |
     |                |<--best result / none-------|                  |
     |                |--threshold decision         |                  |
     |                |--record metrics             |                  |
     |<--AskResult----|             |              |                  |
     |                |             |              |                  |
     |--optional host-owned LLM call (only after escalation)---------->
```

The source contract's `search(query)` allows future integrations to use their own local data and retrieval strategy. The shared embedding service is used by sources that need this model; sources that do not need embeddings remain valid plugins.

### Alternatives considered

- **Provider-specific fallback inside the gateway:** Rejected because actual LLM integration is explicitly out of MVP scope and would couple the SDK to provider credentials, networking, and provider response formats. The escalation result keeps that responsibility with the host.
- **A required embedding service parameter on every source search:** Rejected because it would force non-semantic sources to depend on embeddings and complicate future plugin types. Embedding-dependent sources receive the shared service through their own construction.
- **Sequential source queries:** Rejected because latency would grow with each source. Parallel querying reduces wall-clock time; source failures are isolated and ties remain deterministic.
- **Raw cosine score as confidence:** Rejected because cosine can be negative and is not expressed on the same `[0, 1]` scale required by the public threshold contract. FAQ scores are mapped to `[0, 1]`; other sources must return normalized confidence.

## Risks / Trade-offs

- [Model download and inference increase startup time and memory use] → Load lazily, share the model instance, expose initialization, and benchmark supported browsers and FAQ sizes.
- [A transformed cosine score is not a calibrated probability] → Document it as a ranking confidence, make threshold configurable, and use representative FAQ tests to choose application thresholds.
- [A future WebGPU-capable runtime may vary across browsers and devices] → Keep runtime selection behind `EmbeddingModelFactory`; the current implementation remains on the installed WebAssembly backend.
- [Parallel source search can increase simultaneous CPU work] → Keep the source contract asynchronous, benchmark target workloads, and allow applications to register only needed sources.
- [Cost avoidance is an estimate, not a billing record] → Make per-call cost configurable and default to zero; identify the metric as estimated and count local resolutions rather than claiming provider calls were observed.
- [A fallback result contains no generated answer] → Clearly identify escalation in `source` and `reason`; host applications own provider invocation and final answer display.
- [Bundler duplication could create multiple module-level model singletons] → Document one package/runtime instance per application and test the normal package entry point; a future shared worker may be considered if multi-bundle deployments require it.

## Migration Plan

This is a new package capability with no existing consumers or persisted data to migrate. Implement and test the public API, publish the package entry point and declarations, then let each host application opt in by registering sources and routing questions through the gateway. Rollback consists of returning the host application to its previous request path; no server or database rollback is required.
