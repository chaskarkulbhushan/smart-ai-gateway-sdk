# Spec Delta

## Purpose

Provides framework-agnostic, browser-first question routing that searches local knowledge before signaling that a host application should use its configured LLM.

## ADDED Requirements

### Requirement: Gateway initialization
The SDK MUST initialize its registered knowledge sources before answering questions, and repeated initialization MUST NOT duplicate source setup.

#### Scenario: Initialize the gateway
- **WHEN** an application initializes the gateway with registered sources
- **THEN** each source is initialized and the gateway becomes ready to answer questions

#### Scenario: Initialize repeatedly
- **WHEN** an application calls initialize more than once
- **THEN** completed source initialization is reused without duplicating setup

### Requirement: Shared lazy embedding generation
The SDK MUST generate embeddings with the configured model only when needed, and MUST reuse one model load for the lifetime of the application session.

#### Scenario: First embedding requested
- **WHEN** the first operation requires a text embedding
- **THEN** the SDK loads the model and returns an embedding for the text

#### Scenario: Concurrent embedding requests
- **WHEN** multiple operations request embeddings while the model is loading
- **THEN** they share the in-progress model load rather than starting additional downloads

### Requirement: Extensible knowledge sources
Applications MUST be able to register knowledge sources through a common contract, and adding a source MUST NOT require changes to gateway routing behavior.

#### Scenario: Register an additional source
- **WHEN** an application registers a source implementing the documented contract
- **THEN** the gateway initializes and queries it alongside other registered sources

### Requirement: Semantic FAQ search
The FAQ source MUST index question-and-answer entries locally and return the most semantically similar matching entry with a confidence value in the range from 0 to 1.

#### Scenario: Match a paraphrased FAQ question
- **GIVEN** the FAQ source has indexed a question and answer
- **WHEN** a semantically similar question is searched
- **THEN** the source returns the associated answer and its confidence score

#### Scenario: FAQ data is empty
- **GIVEN** the FAQ source has no entries
- **WHEN** it is searched
- **THEN** it returns no match without throwing an error

### Requirement: Best-result confidence routing
The SDK MUST evaluate results from all available sources, select the result with the highest confidence, and return a local answer when that confidence is greater than or equal to the configured threshold.

#### Scenario: Highest-confidence local result meets threshold
- **GIVEN** multiple sources return results and the highest confidence meets the threshold
- **WHEN** the gateway answers the question
- **THEN** it returns the highest-confidence answer with source `local` and identifies the matched source

#### Scenario: Confidence equals threshold
- **GIVEN** the best result confidence equals the configured threshold
- **WHEN** the gateway answers the question
- **THEN** it returns that result as a local answer

### Requirement: LLM escalation decision
When no source returns a result at or above the configured threshold, the SDK MUST return a standardized escalation result and MUST NOT call an external LLM provider.

#### Scenario: No source returns a result
- **WHEN** all sources return no result
- **THEN** the gateway returns an escalation result with source `llm`, confidence 0, and a reason indicating that no local answer was found

#### Scenario: Best result is below threshold
- **GIVEN** the best source result is below the configured threshold
- **WHEN** the gateway answers the question
- **THEN** it returns an escalation result and does not present the below-threshold answer as a local answer

#### Scenario: A source fails during search
- **GIVEN** one source fails while other sources remain available
- **WHEN** the gateway answers the question
- **THEN** it continues with the available results and does not fail the request because of that source

### Requirement: Standardized response and timing
Every completed question MUST return the documented response fields, and processing time MUST represent SDK processing through the routing decision, excluding any host-application LLM call.

#### Scenario: Return a local result
- **WHEN** a question is resolved locally
- **THEN** the response includes answer, source, confidence, matched source, reason, and processing time

#### Scenario: Return an escalation result
- **WHEN** a question is escalated
- **THEN** the response includes an empty answer, source `llm`, confidence, reason, and processing time, with no matched source

### Requirement: Request and cost metrics
The SDK MUST expose request counts, local resolution rate, escalation rate, average processing time, estimated avoided LLM calls, and estimated cost avoidance for the current gateway instance.

#### Scenario: Record local and escalated requests
- **WHEN** completed questions produce local and escalation results
- **THEN** total, local, and escalation counts and their rates reflect those results

#### Scenario: Estimate avoided calls and cost
- **WHEN** the SDK records a local answer
- **THEN** it counts one estimated LLM call avoided and adds the configured per-call estimate to cost avoidance

#### Scenario: Metrics before any request
- **WHEN** metrics are read before any question is answered
- **THEN** all counts and rates are zero and average processing time is zero

### Requirement: Browser-first privacy and performance
Question text and indexed knowledge MUST remain in the browser during SDK embedding and search operations, and local result ranking MUST complete in under 100 milliseconds after indexing and query embedding are available for the supported FAQ dataset target.

#### Scenario: Search local knowledge
- **WHEN** the SDK embeds and searches a question
- **THEN** it does not transmit the question or indexed knowledge to a remote service

#### Scenario: Rank an indexed FAQ query
- **GIVEN** the FAQ index and query embedding are ready
- **WHEN** the SDK ranks the supported FAQ dataset
- **THEN** ranking completes in under 100 milliseconds

### Requirement: Public package entry point
The SDK MUST expose its public gateway, source contracts, configuration, response, and metrics types through the package's single `index.ts` entry point.

#### Scenario: Consume the SDK from an application
- **WHEN** an external TypeScript application imports the package entry point
- **THEN** it can construct, initialize, and query the gateway using the documented public types