import { describe, expect, test } from "vitest";
import { nearestPointOnRoute } from "./route-distance";
import type { LatLng } from "./polyline";

// Un tramo recto aproximadamente norte-sur cerca de Madrid.
const ROUTE: LatLng[] = [
  { lat: 40.0, lng: -3.7 },
  { lat: 40.1, lng: -3.7 },
  { lat: 40.2, lng: -3.7 },
  { lat: 40.3, lng: -3.7 },
];

describe("nearestPointOnRoute", () => {
  test("a point exactly on the route has ~0 distance", () => {
    const result = nearestPointOnRoute({ lat: 40.1, lng: -3.7 }, ROUTE);

    expect(result.distanceMeters).toBeLessThan(1);
  });

  test("a point off to the side reports a positive perpendicular-ish distance", () => {
    // ~0.01 deg de longitud a esta latitud son unos 850 m
    const result = nearestPointOnRoute({ lat: 40.1, lng: -3.71 }, ROUTE);

    expect(result.distanceMeters).toBeGreaterThan(500);
    expect(result.distanceMeters).toBeLessThan(1200);
  });

  test("position along the route increases from origin to destination", () => {
    const nearOrigin = nearestPointOnRoute({ lat: 40.01, lng: -3.7 }, ROUTE);
    const nearEnd = nearestPointOnRoute({ lat: 40.29, lng: -3.7 }, ROUTE);

    expect(nearEnd.positionMeters).toBeGreaterThan(nearOrigin.positionMeters);
  });

  test("throws on an empty route", () => {
    expect(() => nearestPointOnRoute({ lat: 0, lng: 0 }, [])).toThrow();
  });
});
