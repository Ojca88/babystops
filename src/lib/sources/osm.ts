import type { Evidence } from "@/lib/domain/types";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

// Tags OSM relevantes de Overpass — docs/baby-stops/03-fuentes-y-extraccion.md
export interface OsmTags {
  changing_table?: string; // 'yes' | 'no' | 'limited'
  highchair?: string; // 'yes' | 'no'
  kids_area?: string; // 'yes' | 'no'
  "kids_area:location"?: string; // 'indoor' | 'outdoor'
  "toilets:wheelchair"?: string; // 'yes'
  outdoor_seating?: string; // 'yes'
  wheelchair?: string; // 'yes' | 'limited' | 'no'
  amenity?: string;
  fee?: string;
  leisure?: string;
  [key: string]: string | undefined;
}

const WHEELCHAIR_TO_STROLLER_ACCESS: Record<string, string> = {
  yes: "easy",
  limited: "possible",
  no: "difficult",
};

export function mapOsmTagsToEvidence(tags: OsmTags, detectedAt: Date): Evidence[] {
  const evidence: Evidence[] = [];

  function push(featureType: Evidence["featureType"], value: string) {
    evidence.push({ featureType, value, source: "OSM", certainty: "explicit", detectedAt });
  }

  if (tags.changing_table !== undefined) {
    push("changing_table", tags.changing_table);
  }

  if (tags.highchair !== undefined) {
    push("highchair", tags.highchair);
  }

  if (tags.kids_area !== undefined) {
    const featureType = tags["kids_area:location"] === "indoor" ? "indoor_play_area" : "outdoor_play_area";
    push(featureType, tags.kids_area);
  }

  if (tags["toilets:wheelchair"] !== undefined) {
    push("accessible_restroom", tags["toilets:wheelchair"]);
  }

  if (tags.outdoor_seating !== undefined) {
    push("terrace", tags.outdoor_seating);
  }

  if (tags.wheelchair !== undefined) {
    const mapped = WHEELCHAIR_TO_STROLLER_ACCESS[tags.wheelchair];
    if (mapped) push("stroller_access", mapped);
  }

  if (tags.amenity === "parking") {
    push("nearby_parking", "yes");
    if (tags.fee === "no") push("free_parking", "yes");
  }

  if (tags.leisure === "playground") {
    push("nearby_playground", "yes");
  }

  return evidence;
}

export interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Consulta en vivo a Overpass — requiere red, no cubierta por tests
// unitarios. Respeta el uso justo documentado (User-Agent identificable,
// límite de tamaño de la consulta) — docs/baby-stops/04-limitaciones-legales.md
export async function queryOverpassNearby(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:25];
    (
      node(around:${radiusMeters},${lat},${lng})["amenity"];
      way(around:${radiusMeters},${lat},${lng})["amenity"];
      node(around:${radiusMeters},${lat},${lng})["leisure"="playground"];
    );
    out center tags;
  `;

  const response = await fetchWithRetry(() =>
    fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BabyStopsBot/0.1 (+https://babystops.app)",
      },
      body: `data=${encodeURIComponent(query)}`,
    }),
  );

  if (!response.ok) throw new Error(`Overpass falló: ${response.status}`);
  const data = (await response.json()) as { elements?: OverpassElement[] };
  return data.elements ?? [];
}
