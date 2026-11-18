import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";

describe("cosineSimilarity", () => {
  it("returns 1 for vectors pointing in the same direction", () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1 for vectors pointing in opposite directions", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it("returns 0 when either vector is zero", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("throws a meaningful error when vector lengths differ", () => {
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(
      "Cannot compare vectors with different lengths (1 and 2).",
    );
  });
});