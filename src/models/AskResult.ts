/** Standard response returned by a gateway question-routing decision. */
export interface AskResult {
  answer: string;
  source: "local" | "llm";
  confidence: number;
  matchedSource?: string;
  reason: string;
  processingTimeMs: number;
}