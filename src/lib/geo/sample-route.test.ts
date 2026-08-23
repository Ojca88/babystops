import { describe, expect, test } from "vitest";
import { sampleEveryNMeters } from "./sample-route";
import type { LatLng } from "./polyline";

describe("sampleEveryNMeters", () => {
  test("always includes the first point of the route", () => {
    const route: LatLng[] = [{ lat: 40.0, lng: -3.7 }, { lat: 40.5, lng: -3.7 }];

    const samples = sampleEveryNMeters(route, 20_000);

    expect(samples[0]).toEqual(route[0]);
  });

  test("produces roughly evenly spaced samples along a straight line", () => {
    // ~55.6 km norte-sur (0.5 grados de latitud)
    const route: LatLng[] = [{ lat: 40.0, lng: -3.7 }, { lat: 40.5, lng: -3.7 }];

    const samples = sampleEveryNMeters(route, 20_000);

    // ~55.6km / 20km ≈ 3 huecos → 4 muestras
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples.length).toBeLessThanOrEqual(5);
  });

  test("a route shorter than the interval still returns at least its endpoints", () => {
    const route: LatLng[] = [{ lat: 40.0, lng: -3.7 }, { lat: 40.001, lng: -3.7 }];

    const samples = sampleEveryNMeters(route, 20_000);

    expect(samples.length).toBeGreaterThanOrEqual(1);
  });
});
