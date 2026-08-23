import { describe, expect, test } from "vitest";
import { resolveFeature } from "./resolve-feature";
import type { Evidence } from "@/lib/domain/types";

const NOW = new Date("2026-08-23T00:00:00Z");

function evidence(overrides: Partial<Evidence>): Evidence {
  return {
    featureType: "changing_table",
    value: "yes",
    source: "COMMUNITY",
    certainty: "explicit",
    detectedAt: NOW,
    ...overrides,
  };
}

describe("resolveFeature", () => {
  test("returns UNKNOWN with zero confidence when there is no evidence", () => {
    const result = resolveFeature([], NOW);

    expect(result).toEqual({
      value: null,
      status: "UNKNOWN",
      confidenceScore: 0,
      lastVerifiedAt: null,
    });
  });

  test("a single explicit official-website evidence resolves to PROBABLE at its source weight", () => {
    const result = resolveFeature(
      [evidence({ source: "OFFICIAL_WEBSITE", value: "yes" })],
      NOW,
    );

    expect(result.confidenceScore).toBe(40);
    expect(result.status).toBe("PROBABLE");
    expect(result.value).toBe("yes");
  });

  test("agreement between two independent sources reaches CONFIRMED", () => {
    const result = resolveFeature(
      [
        evidence({ source: "OFFICIAL_WEBSITE", value: "yes" }),
        evidence({ source: "GOOGLE_PLACES", value: "yes" }),
      ],
      NOW,
    );

    expect(result.confidenceScore).toBe(75);
    expect(result.status).toBe("CONFIRMED");
  });

  test("repeated evidence from the same source has diminishing returns (sqrt, not linear)", () => {
    const fourCommunityConfirmations = Array.from({ length: 4 }, () =>
      evidence({ source: "COMMUNITY", value: "yes" }),
    );

    const result = resolveFeature(fourCommunityConfirmations, NOW);

    // 20 * sqrt(4) = 40, not 20 * 4 = 80
    expect(result.confidenceScore).toBe(40);
    expect(result.status).toBe("PROBABLE");
  });

  test("evidence older than 12 months decays to 40% weight", () => {
    const thirteenMonthsAgo = new Date("2025-07-20T00:00:00Z");
    const result = resolveFeature(
      [
        evidence({
          source: "OFFICIAL_WEBSITE",
          value: "yes",
          detectedAt: thirteenMonthsAgo,
        }),
      ],
      NOW,
    );

    // 40 * 0.4 = 16
    expect(result.confidenceScore).toBe(16);
    expect(result.status).toBe("UNCONFIRMED");
  });

  test("implied evidence counts less than explicit evidence from the same source", () => {
    const explicit = resolveFeature(
      [evidence({ source: "REVIEW_NLP", value: "yes", certainty: "explicit" })],
      NOW,
    );
    const implied = resolveFeature(
      [evidence({ source: "REVIEW_NLP", value: "yes", certainty: "implied" })],
      NOW,
    );

    expect(explicit.confidenceScore).toBe(10);
    expect(implied.confidenceScore).toBe(6);
  });

  test("evidence of absence resolves to NOT_AVAILABLE, not UNCONFIRMED", () => {
    const result = resolveFeature(
      [evidence({ source: "OSM", value: "no" })],
      NOW,
    );

    expect(result.status).toBe("NOT_AVAILABLE");
    expect(result.value).toBe("no");
  });

  test("contradicting evidence within the 15-point margin needs review", () => {
    const result = resolveFeature(
      [
        evidence({ source: "OFFICIAL_WEBSITE", value: "yes" }), // 40
        evidence({ source: "GOOGLE_PLACES", value: "no" }), // 35
      ],
      NOW,
    );

    expect(result.status).toBe("NEEDS_REVIEW");
  });

  test("confidence score is capped at 100", () => {
    const result = resolveFeature(
      [
        evidence({ source: "OFFICIAL_WEBSITE", value: "yes" }), // 40
        evidence({ source: "GOOGLE_PLACES", value: "yes" }), // 35
        evidence({ source: "OSM", value: "yes" }), // 25
        evidence({ source: "COMMUNITY", value: "yes" }), // 20
      ],
      NOW,
    );

    expect(result.confidenceScore).toBe(100);
    expect(result.status).toBe("CONFIRMED");
  });
});
