# Proposal

## Why

Applications currently need to send questions to a hosted LLM even when local product knowledge could answer them. A reusable browser-first gateway can resolve known questions locally, reducing avoidable provider calls, latency, and data exposure while giving applications consistent routing and cost metrics.

## What Changes

- Define a framework-agnostic TypeScript gateway that searches registered local knowledge sources before selecting an LLM escalation outcome.
- Add lazy, shared embedding generation using `Xenova/all-MiniLM-L6-v2`, plus an in-memory semantic FAQ source.
- Define an extensible knowledge-source contract, confidence-based result selection, standardized responses, and request metrics.
- Keep provider-specific LLM calls out of the MVP. An escalation result tells the host application that it may call its configured LLM; the SDK does not make that call.
- Expose the SDK through a single package entry point and document browser-first, dependency-injected use.

## Capabilities

### New Capabilities
- `smart-ai-gateway`: Local-first question routing across extensible knowledge sources, including FAQ semantic search, fallback decisions, and cost-avoidance metrics.

### Modified Capabilities

None.

## Impact

- Adds the public TypeScript API and implementation under the package's existing `src/index.ts` build entry.
- Introduces a browser-compatible embedding runtime/model dependency and tests for embeddings, source search, routing, and metrics.
- No changes to host application frameworks or provider-specific LLM integrations are required. The host application remains responsible for executing an escalation.
- Estimated cost avoidance will use an optional configured cost per avoided LLM call; it defaults to zero because actual provider pricing is application-specific.