import { describe, expect, it } from "vitest";
import { MetricsCollector } from "../analytics/MetricsCollector.js";

describe("MetricsCollector", () => {
  it("returns zero-valued metrics before any queries", () => {
    const collector = new MetricsCollector();

    expect(collector.getMetrics()).toEqual({
      totalQueries: 0,
      localAnswers: 0,
      llmFallbacks: 0,
      localHitRate: 0,
      llmEscalationRate: 0,
      estimatedLlmCallsAvoided: 0,
      averageResponseTime: 0,
      estimatedCostAvoidance: 0,
    });
  });

  it("records a local answer and an avoided call", () => {
    const collector = new MetricsCollector(0.002);

    collector.recordLocalAnswer(12);

    expect(collector.getMetrics()).toEqual({
      totalQueries: 1,
      localAnswers: 1,
      llmFallbacks: 0,
      localHitRate: 100,
      llmEscalationRate: 0,
      estimatedLlmCallsAvoided: 1,
      averageResponseTime: 12,
      estimatedCostAvoidance: 0.002,
    });
  });

  it("records an escalation without avoided-call or cost credit", () => {
    const collector = new MetricsCollector(0.002);

    collector.recordEscalation(8);

    expect(collector.getMetrics()).toEqual({
      totalQueries: 1,
      localAnswers: 0,
      llmFallbacks: 1,
      localHitRate: 0,
      llmEscalationRate: 100,
      estimatedLlmCallsAvoided: 0,
      averageResponseTime: 8,
      estimatedCostAvoidance: 0,
    });
  });

  it("calculates mixed-result rates and average response time", () => {
    const collector = new MetricsCollector();

    collector.recordLocalAnswer(10);
    collector.recordLocalAnswer(20);
    collector.recordEscalation(30);
    collector.recordEscalation(40);

    expect(collector.getMetrics()).toEqual({
      totalQueries: 4,
      localAnswers: 2,
      llmFallbacks: 2,
      localHitRate: 50,
      llmEscalationRate: 50,
      estimatedLlmCallsAvoided: 2,
      averageResponseTime: 25,
      estimatedCostAvoidance: 0,
    });
  });

  it("calculates an 80/20 split and configured cost avoidance", () => {
    const collector = new MetricsCollector(0.002);

    for (let index = 0; index < 8; index += 1) {
      collector.recordLocalAnswer(5);
    }
    collector.recordEscalation(10);
    collector.recordEscalation(10);

    const metrics = collector.getMetrics();
    expect(metrics.totalQueries).toBe(10);
    expect(metrics.localHitRate).toBe(80);
    expect(metrics.llmEscalationRate).toBe(20);
    expect(metrics.estimatedLlmCallsAvoided).toBe(8);
    expect(metrics.estimatedCostAvoidance).toBeCloseTo(0.016);
  });

  it("calculates one hundred percent local rate and cost for ten local answers", () => {
    const collector = new MetricsCollector(0.002);

    for (let index = 0; index < 10; index += 1) {
      collector.recordLocalAnswer(1);
    }

    const metrics = collector.getMetrics();
    expect(metrics.totalQueries).toBe(10);
    expect(metrics.localHitRate).toBe(100);
    expect(metrics.llmEscalationRate).toBe(0);
    expect(metrics.estimatedLlmCallsAvoided).toBe(10);
    expect(metrics.estimatedCostAvoidance).toBeCloseTo(0.02);
  });

  it("returns a frozen snapshot that does not change after later records", () => {
    const collector = new MetricsCollector(0.001);
    const snapshot = collector.getMetrics();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Reflect.set(snapshot, "totalQueries", 99)).toBe(false);

    collector.recordLocalAnswer(4);

    expect(snapshot.totalQueries).toBe(0);
    expect(collector.getMetrics().totalQueries).toBe(1);
  });

  it("remains correct after many query records", () => {
    const collector = new MetricsCollector();

    for (let index = 0; index < 1000; index += 1) {
      if (index % 5 === 0) {
        collector.recordEscalation(10);
      } else {
        collector.recordLocalAnswer(10);
      }
    }

    const metrics = collector.getMetrics();
    expect(metrics.totalQueries).toBe(1000);
    expect(metrics.localAnswers).toBe(800);
    expect(metrics.llmFallbacks).toBe(200);
    expect(metrics.localHitRate).toBe(80);
    expect(metrics.llmEscalationRate).toBe(20);
    expect(metrics.averageResponseTime).toBe(10);
  });
});