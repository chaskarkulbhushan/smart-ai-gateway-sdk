import { describe, expect, it } from "vitest";
import {
  BrowserEmbeddingService,
  FAQSource,
  SmartAIGateway,
  type AskResult,
  type FAQEntry,
  type GatewayMetrics,
  type KnowledgeSource,
} from "smart-ai-gateway-sdk";

async function runDocumentedExample(): Promise<void> {
  const embeddingService = new BrowserEmbeddingService();
  const entries: FAQEntry[] = [
    {
      question: "How do I reset my password?",
      answer: "Use the password reset link on the sign-in page.",
    },
  ];
  const faqSource = new FAQSource({
    entries,
    embeddingService,
  });
  const source: KnowledgeSource = faqSource;
  const gateway = new SmartAIGateway({
    threshold: 0.85,
    sources: [source],
    estimatedLlmCostPerCall: 0.002,
  });

  const result: AskResult = await gateway.ask("How can I change my password?");
  console.log(result.answer, result.source, result.confidence, result.reason);

  const comparison = await gateway.ask("Compare OAuth2 with SAML");
  if (comparison.source === "llm") {
    void comparison.reason;
  }

  const metrics: GatewayMetrics = gateway.getMetrics();
  console.log(metrics.totalQueries, metrics.estimatedCostAvoidance);
}

describe("README usage example", () => {
  it("type-checks all documented package-root APIs without loading the model", () => {
    expect(runDocumentedExample).toBeTypeOf("function");
  });
});