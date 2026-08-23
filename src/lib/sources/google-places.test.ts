import { describe, expect, test } from "vitest";
import { mapPlaceDetailsToEvidence } from "./google-places";
import type { GooglePlaceDetails } from "./google-places";

const NOW = new Date("2026-08-23T00:00:00Z");

describe("mapPlaceDetailsToEvidence", () => {
  test("wheelchair-accessible entrance maps to easy stroller access", () => {
    const details: GooglePlaceDetails = {
      accessibilityOptions: { wheelchairAccessibleEntrance: true },
    };

    const evidence = mapPlaceDetailsToEvidence(details, NOW);

    expect(evidence).toContainEqual({
      featureType: "stroller_access",
      value: "easy",
      source: "GOOGLE_PLACES",
      certainty: "explicit",
      detectedAt: NOW,
    });
  });

  test("a free parking lot maps to both parking and free_parking", () => {
    const details: GooglePlaceDetails = {
      parkingOptions: { freeParkingLot: true },
    };

    const evidence = mapPlaceDetailsToEvidence(details, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "parking", value: "yes" }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "free_parking", value: "yes" }),
    );
  });

  test("a paid-only parking lot maps to parking=yes but free_parking=no", () => {
    const details: GooglePlaceDetails = {
      parkingOptions: { paidParkingLot: true },
    };

    const evidence = mapPlaceDetailsToEvidence(details, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "parking", value: "yes" }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "free_parking", value: "no" }),
    );
  });

  test("outdoor seating maps to terrace and outdoor_space", () => {
    const details: GooglePlaceDetails = { outdoorSeating: true };

    const evidence = mapPlaceDetailsToEvidence(details, NOW);

    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "terrace", value: "yes" }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({ featureType: "outdoor_space", value: "yes" }),
    );
  });

  test("a generic restroom=true never implies changing_table (too weak a signal)", () => {
    const details: GooglePlaceDetails = { restroom: true };

    const evidence = mapPlaceDetailsToEvidence(details, NOW);

    expect(evidence).toEqual([]);
  });

  test("no relevant fields produces no evidence", () => {
    expect(mapPlaceDetailsToEvidence({}, NOW)).toEqual([]);
  });
});
