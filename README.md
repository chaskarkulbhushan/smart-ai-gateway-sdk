# Smart AI Gateway SDK

## Overview

Smart AI Gateway SDK is a browser-first, local-first TypeScript SDK. It searches registered knowledge sources and evaluates their confidence before returning a local answer or an escalation decision.

```text
User Question
    -> SmartAIGateway
    -> Registered Knowledge Sources
    -> Confidence Evaluation
    -> Local Answer OR Escalation Decision
```

The SDK returns escalation decisions but never calls an LLM or sends question text to an LLM provider.

## Installation

```sh
npm install smart-ai-gateway-sdk
```

## Quick Start

```ts
import {
  BrowserEmbeddingService,
  FAQSource,
  SmartAIGateway,
} from "smart-ai-gateway-sdk";

const embeddingService = new BrowserEmbeddingService();
const faqSource = new FAQSource({
  entries: [
    {
      question: "How do I reset my password?",
      answer: "Use the password reset link on the sign-in page.",
    },
  ],
  embeddingService,
});

const gateway = new SmartAIGateway({
  threshold: 0.85,
  sources: [faqSource],
  estimatedLlmCostPerCall: 0.002,
});

const result = await gateway.ask("How can I change my password?");
console.log(result.answer);

if (result.source === "llm") {
  console.log("Host application may escalate:", result.reason);
}
```

`ask()` initializes the gateway and its sources automatically. Local matching stays in the browser. The default embedding runtime may download uncached model and runtime assets the first time embeddings are requested; question and FAQ content are not sent to an LLM provider.

## How Routing Works

```text
Question
    -> Knowledge Sources (queried in parallel)
    -> Best Successful Result
    -> Threshold Evaluation
    -> Local Answer OR Escalation Decision
```

The Router ignores failed sources, chooses the highest-confidence result, and uses source registration order to break ties. A result equal to the threshold is local. If no source returns a result or the best confidence is below the threshold, the gateway returns an escalation decision.

## AskResult

`AskResult` has these fields:

| Field | Meaning |
| --- | --- |
| `answer` | Local answer, or an empty string when the host should consider escalation. |
| `source` | `"local"` for a local answer or `"llm"` for an escalation decision. |
| `confidence` | Winning source confidence, or `0` when no source returned a result. |
| `matchedSource` | Name of the selected source; omitted for escalation decisions. |
| `reason` | `"Matched local source"`, `"Best result below threshold"`, or `"No local answer found"`. |
| `processingTimeMs` | Time spent by the SDK through its routing decision; excludes any later host LLM request. |

Local answer:

```json
{
  "answer": "Use the password reset link on the sign-in page.",
  "source": "local",
  "confidence": 0.94,
  "matchedSource": "FAQSource",
  "reason": "Matched local source",
  "processingTimeMs": 4.2
}
```

Escalation decision:

```json
{
  "answer": "",
  "source": "llm",
  "confidence": 0.31,
  "reason": "Best result below threshold",
  "processingTimeMs": 3.1
}
```

## Escalation Does Not Mean LLM Call

`source === "llm"` means **the host application may call its preferred LLM provider**. It is not a generated answer and is not confirmation that a provider request occurred.

The gateway does not call OpenAI, Azure OpenAI, or Copilot, and does not perform an HTTP request or `fetch()` for LLM escalation. The default Transformers.js runtime may fetch model/runtime assets if they are not cached; that separate setup traffic does not contain FAQ or question text.

## Metrics

Read a frozen metrics snapshot with:

```ts
const metrics = gateway.getMetrics();
console.log(metrics.localHitRate, metrics.estimatedCostAvoidance);
```

| Metric | Meaning |
| --- | --- |
| `totalQueries` | Number of completed local or escalation decisions. |
| `localAnswers` | Number of queries answered locally. |
| `llmFallbacks` | Number of escalation decisions, not observed provider calls. |
| `localHitRate` | Local answers divided by total queries, as a percentage. |
| `llmEscalationRate` | Escalation decisions divided by total queries, as a percentage. |
| `estimatedLlmCallsAvoided` | Count of local answers, treated as estimated avoided calls. |
| `averageResponseTime` | Average SDK processing time in milliseconds. |
| `estimatedCostAvoidance` | Estimated avoided calls multiplied by the configured per-call estimate. |

Example snapshot after 100 decisions:

```ts
{
  totalQueries: 100,
  localAnswers: 82,
  llmFallbacks: 18,
  localHitRate: 82,
  llmEscalationRate: 18,
  estimatedLlmCallsAvoided: 82,
  averageResponseTime: 35.4,
  estimatedCostAvoidance: 0.164
}
```

The estimate can help a host application report local-resolution impact. It is not a billing record: the SDK does not observe whether an escalated request was sent or what a provider charged.

## Cost Avoidance

`estimatedLlmCostPerCall` defaults to `0`. Set it to the host's own estimated cost per request:

```ts
const gateway = new SmartAIGateway({
  threshold: 0.85,
  sources: [faqSource],
  estimatedLlmCostPerCall: 0.002,
});
```

Each local answer adds this estimate to `estimatedCostAvoidance`. Escalation decisions do not add to avoided cost.

## Browser Support

The current browser support target is current evergreen Chrome, Edge, Firefox, and Safari. Transformers.js currently uses the WebAssembly backend in browsers. WebGPU is a future runtime capability; it is not enabled by the installed Transformers.js version. Cross-browser smoke verification is tracked separately.

## Architecture

```text
Application
    -> SmartAIGateway
    -> Router
    -> KnowledgeSource[]
    -> FAQSource
    -> BrowserEmbeddingService
```

## Development

```sh
npm install
npm test
npm run build
```