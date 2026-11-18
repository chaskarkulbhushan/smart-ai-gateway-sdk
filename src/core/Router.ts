import type { KnowledgeResult } from "../models/KnowledgeResult.js";
import type { KnowledgeSource } from "../sources/KnowledgeSource.js";

/** A source result selected by the router. */
export interface RouterResult {
  result: KnowledgeResult;
  sourceName: string;
}

/** Queries knowledge sources and selects the highest-confidence successful result. */
export class Router {
  private readonly sources: readonly KnowledgeSource[];

  /**
   * Create a router with sources in deterministic tie-break order.
   * @param sources Registered knowledge sources.
   */
  constructor(sources: KnowledgeSource[]) {
    this.sources = Object.freeze([...sources]);
  }

  /**
   * Search every source in parallel and return the highest-confidence result.
   * Failed sources and sources without a result are ignored.
   * @param query User query to pass to each source.
   */
  async search(query: string): Promise<RouterResult | null> {
    const results = await Promise.allSettled(
      this.sources.map((source) =>
        Promise.resolve().then(async () => {
          const result = await source.search(query);
          if (result === null) {
            return null;
          }

          return {
            result,
            sourceName: source.getName(),
          } satisfies RouterResult;
        }),
      ),
    );

    let bestResult: RouterResult | null = null;
    for (const outcome of results) {
      if (outcome.status !== "fulfilled" || outcome.value === null) {
        continue;
      }

      if (
        bestResult === null ||
        outcome.value.result.confidence > bestResult.result.confidence
      ) {
        bestResult = outcome.value;
      }
    }

    return bestResult;
  }
}