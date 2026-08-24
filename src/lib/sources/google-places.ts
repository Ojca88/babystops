import type { Evidence } from "@/lib/domain/types";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

// Subconjunto de campos de Google Places API (New) Place Details que se
// mapean por regla directa, sin LLM — docs/baby-stops/03-fuentes-y-extraccion.md
export interface GooglePlaceDetails {
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  parkingOptions?: { freeParkingLot?: boolean; paidParkingLot?: boolean };
  outdoorSeating?: boolean;
  restroom?: boolean;
}

export function mapPlaceDetailsToEvidence(details: GooglePlaceDetails, detectedAt: Date): Evidence[] {
  const evidence: Evidence[] = [];

  function push(featureType: Evidence["featureType"], value: string) {
    evidence.push({ featureType, value, source: "GOOGLE_PLACES", certainty: "explicit", detectedAt });
  }

  if (details.accessibilityOptions?.wheelchairAccessibleEntrance === true) {
    push("stroller_access", "easy");
  }

  if (details.parkingOptions?.freeParkingLot === true) {
    push("parking", "yes");
    push("free_parking", "yes");
  } else if (details.parkingOptions?.paidParkingLot === true) {
    push("parking", "yes");
    push("free_parking", "no");
  }

  if (details.outdoorSeating === true) {
    push("terrace", "yes");
    push("outdoor_space", "yes");
  }

  // `restroom` es una señal demasiado débil (spec: "no implica cambiador") —
  // deliberadamente no genera evidencia de ningún tipo.

  return evidence;
}

export interface GooglePlaceSearchResult {
  id: string; // google_place_id
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
}

function requireApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY no está configurada");
  return apiKey;
}

// Llamadas en vivo a Places API (New) — requieren red y GOOGLE_MAPS_API_KEY,
// no cubiertas por tests unitarios. docs/baby-stops/08-poc-alicante-madrid.md
export async function searchPlacesText(
  query: string,
  center: { lat: number; lng: number },
  radiusMeters: number,
): Promise<GooglePlaceSearchResult[]> {
  const response = await fetchWithRetry(() =>
    fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": requireApiKey(),
        "X-Goog-FieldMask": "places.id,places.displayName,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusMeters },
        },
      }),
    }),
  );

  if (!response.ok) {
    throw new Error(`Places Text Search falló: ${response.status} — ${await response.text()}`);
  }
  const data = (await response.json()) as { places?: GooglePlaceSearchResult[] };
  return data.places ?? [];
}

const DETAILS_FIELD_MASK = [
  "displayName",
  "formattedAddress",
  "location",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "accessibilityOptions",
  "parkingOptions",
  "outdoorSeating",
  "restroom",
  "reviews",
].join(",");

export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
  const response = await fetchWithRetry(() =>
    fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": requireApiKey(),
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    }),
  );

  if (!response.ok) {
    throw new Error(`Place Details falló para ${placeId}: ${response.status} — ${await response.text()}`);
  }
  return (await response.json()) as GooglePlaceDetails;
}
