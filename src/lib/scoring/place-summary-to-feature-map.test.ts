import { describe, expect, test } from "vitest";
import { placeSummaryToFeatureMap } from "./place-summary-to-feature-map";
import type { PlaceSummaryFeatures } from "./place-summary-to-feature-map";

describe("placeSummaryToFeatureMap", () => {
  test("maps a raw place_summary features object into a FeatureMap", () => {
    const raw: PlaceSummaryFeatures = {
      highchair: { value: "yes", status: "CONFIRMED", confidence: 85 },
      changing_table: { value: "no", status: "NOT_AVAILABLE", confidence: 40 },
    };

    const map = placeSummaryToFeatureMap(raw);

    expect(map.highchair).toEqual({ value: "yes", status: "CONFIRMED", confidenceScore: 85, sourceCount: 1 });
    expect(map.changing_table).toEqual({ value: "no", status: "NOT_AVAILABLE", confidenceScore: 40, sourceCount: 1 });
  });

  test("ignores keys that are not a recognized baby feature type", () => {
    const raw = {
      highchair: { value: "yes", status: "CONFIRMED", confidence: 85 },
      not_a_real_feature: { value: "yes", status: "CONFIRMED", confidence: 85 },
    } as PlaceSummaryFeatures;

    const map = placeSummaryToFeatureMap(raw);

    expect(Object.keys(map)).toEqual(["highchair"]);
  });

  test("an empty features object maps to an empty FeatureMap", () => {
    expect(placeSummaryToFeatureMap({})).toEqual({});
  });

  test("handles null/undefined input as an empty FeatureMap", () => {
    expect(placeSummaryToFeatureMap(null)).toEqual({});
    expect(placeSummaryToFeatureMap(undefined)).toEqual({});
  });
});
