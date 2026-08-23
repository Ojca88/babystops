import { describe, expect, test } from "vitest";
import { calculateBabyScore, AGE_PROFILES } from "./baby-score";
import type { FeatureMap } from "./baby-score";

function confirmed(value: string, sourceCount = 1) {
  return { value, status: "CONFIRMED" as const, confidenceScore: 100, sourceCount };
}

describe("calculateBabyScore", () => {
  test("an empty feature map scores zero on every component", () => {
    const result = calculateBabyScore({});

    expect(result.total).toBe(0);
    for (const component of result.components) {
      expect(component.points).toBe(0);
    }
  });

  test("a feature with status NOT_AVAILABLE contributes zero to its content component, never negative", () => {
    const features: FeatureMap = {
      highchair: { value: "no", status: "NOT_AVAILABLE", confidenceScore: 95, sourceCount: 1 },
    };

    const result = calculateBabyScore(features);
    const food = result.components.find((c) => c.component === "food")!;

    // Confirmed absence is still real evidence (small credit on "evidence"),
    // but it must never inflate the "does it have a highchair" content score.
    expect(food.points).toBe(0);
  });

  test("only highchair confirmed contributes its share of the Alimentación component", () => {
    const features: FeatureMap = { highchair: confirmed("yes") };

    const result = calculateBabyScore(features);
    const alimentacion = result.components.find((c) => c.component === "food")!;

    // highchair is 6/20 of Alimentación at full confidence
    expect(alimentacion.points).toBeCloseTo(6, 1);
  });

  test("stroller_access value multiplier scales the points (difficult scores far less than easy)", () => {
    const easy = calculateBabyScore({ stroller_access: confirmed("easy") });
    const difficult = calculateBabyScore({ stroller_access: confirmed("difficult") });

    const easyPoints = easy.components.find((c) => c.component === "stroller")!.points;
    const difficultPoints = difficult.components.find((c) => c.component === "stroller")!.points;

    // Same weight in both cases (identical fixtures otherwise) — only the
    // easy/difficult multiplier (1.0 vs 0.1) should differ, so the ratio
    // between the two must match that multiplier ratio exactly.
    expect(easyPoints).toBeGreaterThan(difficultPoints);
    expect(difficultPoints).toBeCloseTo(easyPoints * 0.1, 1);
  });

  test("elevator weight is redistributed when there are no stairs to climb", () => {
    const withoutStairs: FeatureMap = {
      stairs_required: { value: "no", status: "CONFIRMED", confidenceScore: 100, sourceCount: 1 },
      stroller_access: confirmed("easy"),
    };

    const result = calculateBabyScore(withoutStairs);
    const stroller = result.components.find((c) => c.component === "stroller")!;

    // stroller_access alone should absorb elevator's redistributed weight:
    // (8 + 6*(8/14)) / 20 * 100% confidence ≈ 11.43, not the base 8/20*100% = 8
    expect(stroller.points).toBeGreaterThan(8);
  });

  test("indoor and outdoor play area share one slot — the best of the two counts", () => {
    const result = calculateBabyScore({ outdoor_play_area: confirmed("yes") });
    const entertainment = result.components.find((c) => c.component === "entertainment")!;

    // outdoor_play_area alone covers the 8/20 "play area" slot
    expect(entertainment.points).toBeCloseTo(8, 1);
  });

  test("evidencia/fiabilidad rewards coverage and multi-source diversity", () => {
    const singleSource = calculateBabyScore({ highchair: confirmed("yes", 1) });
    const multiSource = calculateBabyScore({ highchair: confirmed("yes", 2) });

    const singleEvidence = singleSource.components.find((c) => c.component === "evidence")!.points;
    const multiEvidence = multiSource.components.find((c) => c.component === "evidence")!.points;

    expect(multiEvidence).toBeGreaterThan(singleEvidence);
  });

  test("a fully confirmed, multi-source place scores 100", () => {
    const features: FeatureMap = {
      highchair: confirmed("yes", 2),
      kids_menu: confirmed("yes", 2),
      baby_food_options: confirmed("yes", 2),
      warm_food: confirmed("yes", 2),
      warm_bottle: confirmed("yes", 2),
      changing_table: confirmed("yes", 2),
      family_restroom: confirmed("yes", 2),
      accessible_restroom: confirmed("yes", 2),
      stroller_access: confirmed("easy", 2),
      stroller_space: confirmed("yes", 2),
      stairs_required: { value: "no", status: "CONFIRMED", confidenceScore: 100, sourceCount: 2 },
      outdoor_play_area: confirmed("yes", 2),
      nearby_playground: confirmed("yes", 2),
      space_to_move: confirmed("yes", 2),
      parking: confirmed("yes", 2),
      parking_ease: confirmed("easy", 2),
      free_parking: confirmed("yes", 2),
    };

    const result = calculateBabyScore(features);

    expect(result.total).toBe(100);
  });

  test("age profiles reweight components (0-6 months favors hygiene over entertainment)", () => {
    const features: FeatureMap = { changing_table: confirmed("yes") };

    const general = calculateBabyScore(features);
    const infant = calculateBabyScore(features, AGE_PROFILES["0-6"]);

    const generalHygiene = general.components.find((c) => c.component === "hygiene")!.points;
    const infantHygiene = infant.components.find((c) => c.component === "hygiene")!.points;

    expect(infantHygiene).toBeGreaterThan(generalHygiene);
  });
});
