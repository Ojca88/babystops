import { describe, expect, test } from "vitest";
import { mapOverpassElementToPlaceCandidate } from "./osm-discovery";
import type { OverpassElement } from "./osm";

describe("mapOverpassElementToPlaceCandidate", () => {
  test("maps a node with direct lat/lon", () => {
    const element: OverpassElement = {
      id: 123,
      lat: 40.4,
      lon: -3.7,
      tags: { name: "Restaurante El Camino" },
    };

    const candidate = mapOverpassElementToPlaceCandidate(element);

    expect(candidate).toEqual({ name: "Restaurante El Camino", lat: 40.4, lng: -3.7, osmId: 123 });
  });

  test("maps a way using its center point", () => {
    const element: OverpassElement = {
      id: 456,
      center: { lat: 38.34, lon: -0.48 },
      tags: { name: "Área de Servicio Font de la Figuera" },
    };

    const candidate = mapOverpassElementToPlaceCandidate(element);

    expect(candidate).toEqual({
      name: "Área de Servicio Font de la Figuera",
      lat: 38.34,
      lng: -0.48,
      osmId: 456,
    });
  });

  test("skips elements without a name — not usable as a place candidate", () => {
    const element: OverpassElement = { id: 789, lat: 40.4, lon: -3.7, tags: { amenity: "fuel" } };

    expect(mapOverpassElementToPlaceCandidate(element)).toBeNull();
  });

  test("skips elements without resolvable coordinates", () => {
    const element: OverpassElement = { id: 999, tags: { name: "Sin coordenadas" } };

    expect(mapOverpassElementToPlaceCandidate(element)).toBeNull();
  });
});
