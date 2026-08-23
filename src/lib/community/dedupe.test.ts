import { describe, expect, test } from "vitest";
import { findDuplicate } from "./dedupe";
import type { PlaceCandidate } from "./dedupe";

const madridRestaurant: PlaceCandidate = {
  id: "existing-1",
  name: "Restaurante El Faro",
  lat: 40.4168,
  lng: -3.7038,
  googlePlaceId: "ChIJ_madrid_faro",
};

describe("findDuplicate", () => {
  test("returns no match against an empty list", () => {
    const result = findDuplicate(
      { name: "Anything", lat: 0, lng: 0 },
      [],
    );

    expect(result.kind).toBe("none");
  });

  test("matches exactly on google_place_id, regardless of name/location differences", () => {
    const candidate: PlaceCandidate = {
      name: "El Faro (sucursal centro)",
      lat: 40.42,
      lng: -3.7,
      googlePlaceId: "ChIJ_madrid_faro",
    };

    const result = findDuplicate(candidate, [madridRestaurant]);

    expect(result).toEqual({ kind: "exact", place: madridRestaurant });
  });

  test("matches exactly on osm_id", () => {
    const withOsm: PlaceCandidate = { ...madridRestaurant, googlePlaceId: undefined, osmId: 12345 };
    const candidate: PlaceCandidate = { name: "Distinto nombre", lat: 1, lng: 1, osmId: 12345 };

    const result = findDuplicate(candidate, [withOsm]);

    expect(result).toEqual({ kind: "exact", place: withOsm });
  });

  test("flags as needs_review when very close and the name is similar", () => {
    const candidate: PlaceCandidate = {
      name: "Restaurante El Faro Centro",
      lat: 40.41682, // ~2m away
      lng: -3.70381,
    };

    const result = findDuplicate(candidate, [madridRestaurant]);

    expect(result.kind).toBe("needs_review");
  });

  test("does not flag as duplicate when close but the name is unrelated", () => {
    const candidate: PlaceCandidate = {
      name: "Farmacia Nueva Salud",
      lat: 40.41682,
      lng: -3.70381,
    };

    const result = findDuplicate(candidate, [madridRestaurant]);

    expect(result.kind).toBe("none");
  });

  test("does not flag as duplicate when the name matches but they are far apart (a chain)", () => {
    const candidate: PlaceCandidate = {
      name: "Restaurante El Faro",
      lat: 41.3851, // Barcelona, ~500km away
      lng: 2.1734,
    };

    const result = findDuplicate(candidate, [madridRestaurant]);

    expect(result.kind).toBe("none");
  });
});
