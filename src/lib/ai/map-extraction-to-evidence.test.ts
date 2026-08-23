import { describe, expect, test } from "vitest";
import { mapExtractionToEvidence } from "./map-extraction-to-evidence";
import type { FeatureExtractionResult } from "./map-extraction-to-evidence";

const NOW = new Date("2026-08-23T00:00:00Z");

function result(overrides: Partial<FeatureExtractionResult>): FeatureExtractionResult {
  return {
    featureType: "highchair",
    value: "yes",
    evidenceQuote: "nos pusieron una trona",
    confidence: "explicit",
    ...overrides,
  };
}

describe("mapExtractionToEvidence", () => {
  test("an explicit extraction from reviews keeps REVIEW_NLP as the source", () => {
    const evidence = mapExtractionToEvidence([result({ confidence: "explicit" })], "REVIEW_NLP", NOW);

    expect(evidence[0].source).toBe("REVIEW_NLP");
    expect(evidence[0].certainty).toBe("explicit");
  });

  test("an implied extraction from reviews is downgraded to AI_INFERENCE", () => {
    const evidence = mapExtractionToEvidence([result({ confidence: "implied" })], "REVIEW_NLP", NOW);

    expect(evidence[0].source).toBe("AI_INFERENCE");
    expect(evidence[0].certainty).toBe("implied");
  });

  test("an explicit extraction from the official website keeps OFFICIAL_WEBSITE as the source", () => {
    const evidence = mapExtractionToEvidence(
      [result({ confidence: "explicit" })],
      "OFFICIAL_WEBSITE",
      NOW,
    );

    expect(evidence[0].source).toBe("OFFICIAL_WEBSITE");
  });

  test("an implied extraction from the official website is also downgraded to AI_INFERENCE", () => {
    const evidence = mapExtractionToEvidence(
      [result({ confidence: "implied" })],
      "OFFICIAL_WEBSITE",
      NOW,
    );

    expect(evidence[0].source).toBe("AI_INFERENCE");
  });

  test("preserves feature type, value and carries the quote through as raw_value", () => {
    const evidence = mapExtractionToEvidence(
      [result({ featureType: "changing_table", value: "no", evidenceQuote: "no tienen cambiador" })],
      "REVIEW_NLP",
      NOW,
    );

    expect(evidence[0]).toMatchObject({
      featureType: "changing_table",
      value: "no",
      rawValue: "no tienen cambiador",
      detectedAt: NOW,
    });
  });

  test("an empty list of results produces no evidence", () => {
    expect(mapExtractionToEvidence([], "REVIEW_NLP", NOW)).toEqual([]);
  });
});
