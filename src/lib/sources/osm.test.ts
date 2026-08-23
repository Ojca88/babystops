import { describe, expect, test } from "vitest";
import { mapOsmTagsToEvidence } from "./osm";

const NOW = new Date("2026-08-23T00:00:00Z");

describe("mapOsmTagsToEvidence", () => {
  test("changing_table tag maps directly", () => {
    const evidence = mapOsmTagsToEvidence({ changing_table: "yes" }, NOW);

    expect(evidence).toContainEqual({
      featureType: "changing_table",
      value: "yes",
      source: "OSM",
      certainty: "explicit",
      detectedAt: NOW,
    });
  });

  test("changing_table=no is evidence of absence, not silence", () => {
    const evidence = mapOsmTagsToEvidence({ changing_table: "no" }, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "changing_table", value: "no" }),
    );
  });

  test("highchair tag maps directly", () => {
    const evidence = mapOsmTagsToEvidence({ highchair: "yes" }, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "highchair", value: "yes" }),
    );
  });

  test("wheelchair=yes/limited/no maps to the three stroller_access levels", () => {
    expect(mapOsmTagsToEvidence({ wheelchair: "yes" }, NOW)).toContainEqual(
      expect.objectContaining({ featureType: "stroller_access", value: "easy" }),
    );
    expect(mapOsmTagsToEvidence({ wheelchair: "limited" }, NOW)).toContainEqual(
      expect.objectContaining({ featureType: "stroller_access", value: "possible" }),
    );
    expect(mapOsmTagsToEvidence({ wheelchair: "no" }, NOW)).toContainEqual(
      expect.objectContaining({ featureType: "stroller_access", value: "difficult" }),
    );
  });

  test("outdoor_seating=yes maps to terrace", () => {
    const evidence = mapOsmTagsToEvidence({ outdoor_seating: "yes" }, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "terrace", value: "yes" }),
    );
  });

  test("free parking (amenity=parking, fee=no) maps to free_parking", () => {
    const evidence = mapOsmTagsToEvidence({ amenity: "parking", fee: "no" }, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "free_parking", value: "yes" }),
    );
  });

  test("an untagged feature produces no evidence — absence of a tag is not evidence of 'no'", () => {
    const evidence = mapOsmTagsToEvidence({}, NOW);

    expect(evidence).toEqual([]);
  });

  test("unrelated tags are ignored without throwing", () => {
    const evidence = mapOsmTagsToEvidence({ name: "Bar Pepe", cuisine: "spanish" }, NOW);

    expect(evidence).toEqual([]);
  });
});
