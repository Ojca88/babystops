import type { PlaceCandidate } from "@/lib/community/dedupe";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import type { OverpassElement } from "./osm";

export function mapOverpassElementToPlaceCandidate(element: OverpassElement): PlaceCandidate | null {
  const name = element.tags?.name;
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  return { name, lat, lng, osmId: element.id };
}

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Categorías de descubrimiento (spec sección 4) — más amplias que las de
// queryOverpassNearby (osm.ts), que solo enriquece un lugar ya conocido.
// docs/baby-stops/03-fuentes-y-extraccion.md
function buildDiscoveryQuery(lat: number, lng: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${lat},${lng}`;
  const amenityFilter = '["amenity"~"^(restaurant|cafe|fast_food|pharmacy|fuel)$"]';
  const shopFilter = '["shop"~"^(supermarket|convenience)$"]';
  return `
    [out:json][timeout:60];
    (
      node(${around})${amenityFilter};
      way(${around})${amenityFilter};
      node(${around})${shopFilter};
      way(${around})${shopFilter};
      node(${around})["leisure"="playground"];
      node(${around})["highway"="rest_area"];
      way(${around})["highway"="rest_area"];
      node(${around})["tourism"="picnic_site"];
      node(${around})["tourism"="hotel"];
      way(${around})["tourism"="hotel"];
    );
    out center tags;
  `;
}

// Descubrimiento en vivo vía Overpass — gratis, sin cuota de Google, no
// cubierto por tests unitarios (la lógica de mapeo sí lo está, arriba).
export async function discoverOsmPlacesNear(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<PlaceCandidate[]> {
  const response = await fetchWithRetry(() =>
    fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BabyStopsBot/0.1 (+https://babystops.app)",
      },
      body: `data=${encodeURIComponent(buildDiscoveryQuery(lat, lng, radiusMeters))}`,
    }),
  );

  if (!response.ok) throw new Error(`Overpass (descubrimiento) falló: ${response.status}`);
  const data = (await response.json()) as { elements?: OverpassElement[] };

  return (data.elements ?? [])
    .map(mapOverpassElementToPlaceCandidate)
    .filter((c): c is PlaceCandidate => c !== null);
}
