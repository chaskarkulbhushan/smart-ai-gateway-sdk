# Tasks

## 1. Package and test foundation

- [x] 1.1 Add the browser-compatible Transformers.js dependency and update package scripts for testing; verify dependency installation and the existing tsup build succeed.
- [x] 1.2 Configure Vitest for strict TypeScript tests and add a test command; verify the test runner executes a minimal SDK test in CI-compatible headless mode.

## 2. Embedding and FAQ source

- [x] 2.1 Implement the injectable browser embedding service using `Xenova/all-MiniLM-L6-v2`, lazy shared loading, and the current WebAssembly runtime; keep the factory replaceable for future WebGPU runtimes and verify unit tests cover lazy initialization, concurrent load sharing, and loader failure handling without downloading the model.
- [x] 2.2 Implement FAQ indexing and cosine-based ranking with normalized confidence, empty-index behavior, and the shared embedding service; verify tests cover paraphrase fixtures, highest-score selection, confidence bounds, and empty input.
- [x] 2.3 Document embedding initialization and FAQ source construction in the package README; verify the documented TypeScript example type-checks against the public types.

## 3. Gateway and routing

- [x] 3.1 Implement gateway initialization and the pluggable knowledge-source contract; verify tests show a new fake source can be registered without changing gateway routing code and repeated initialization does not duplicate setup.
- [x] 3.2 Implement parallel source querying, deterministic highest-confidence selection, and per-source failure isolation; leave threshold decisions to gateway routing and verify tests cover highest-score selection, ties, no results, and mixed successful and failing sources.
- [x] 3.3 Implement standardized local and escalation responses with SDK processing time; verify response tests check all required fields, omitted matched source on escalation, and that no provider call is made.
- [x] 3.4 Document gateway configuration, response semantics, and host-owned LLM escalation in the README; verify the examples compile and clearly distinguish an escalation decision from a generated answer.

## 4. Metrics and public package API

- [x] 4.1 Implement instance-scoped metrics for counts, rates, avoided calls, average response time, and configured estimated cost; verify tests cover zero-query values, local/escalation ratios, concurrent requests, and cost calculations.
- [x] 4.2 Export the gateway, FAQ source, embedding service, options, response, metrics, and plugin contracts through `src/index.ts`; verify `npm run build` emits consumable ESM/CJS bundles and TypeScript declarations.
- [x] 4.3 Complete README documentation for metrics interpretation, local-only processing, supported browsers, and cost estimate configuration; verify each example imports only from the package entry point and passes type checking.

## 5. Browser and acceptance validation

- [ ] 5.1 Add browser smoke coverage for current evergreen Chromium, Firefox, and WebKit using the required WebAssembly backend and optional WebGPU path when available; verify embeddings and local FAQ search work without transmitting question or FAQ content to a remote service.
- [ ] 5.2 Add a repeatable ranking benchmark for the documented supported FAQ dataset after indexing and query embedding; verify local ranking remains below the 100 ms target on the agreed CI benchmark environment.
- [ ] 5.3 Run the complete test suite, strict type check, package build, and package-consumer smoke test; verify the built package can be imported from one entry point and all acceptance scenarios pass.