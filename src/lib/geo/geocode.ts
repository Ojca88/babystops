import type { LatLng } from "./polyline";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Mismo servicio (Nominatim/OSM) que ya usa src/app/api/geocode/route.ts
// para la búsqueda de viaje existente — reutilizado aquí para el pipeline
// de ingesta, sin depender de una API de pago.
export async function geocode(query: string): Promise<LatLng> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "babystops/0.1 (road-trip planner for parents)",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Geocoding falló para "${query}": ${response.status}`);

  const results = (await response.json()) as NominatimResult[];
  if (results.length === 0) throw new Error(`No se encontraron coordenadas para "${query}"`);

  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}
