import { describe, expect, test } from "vitest";
import { haversineDistanceMeters } from "./distance";

describe("haversineDistanceMeters", () => {
  test("returns ~0 for the same point", () => {
    expect(haversineDistanceMeters({ lat: 40.4168, lng: -3.7038 }, { lat: 40.4168, lng: -3.7038 })).toBeLessThan(1);
  });

  test("returns a known real-world distance (Madrid to Barcelona, ~504 km)", () => {
    const madrid = { lat: 40.4168, lng: -3.7038 };
    const barcelona = { lat: 41.3851, lng: 2.1734 };

    const distance = haversineDistanceMeters(madrid, barcelona);

    expect(distance / 1000).toBeGreaterThan(490);
    expect(distance / 1000).toBeLessThan(520);
  });

  test("is symmetric", () => {
    const a = { lat: 38.34, lng: -0.48 };
    const b = { lat: 39.47, lng: -0.38 };

    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 5);
  });
});
