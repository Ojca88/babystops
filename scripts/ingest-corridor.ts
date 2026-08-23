#!/usr/bin/env tsx
// Pipeline de ingesta de un corredor (Fase 0/1 del POC) —
// docs/baby-stops/08-poc-alicante-madrid.md, 10-mvp-tecnico.md
//
// Uso: npx tsx scripts/ingest-corridor.ts "Alicante" "Madrid"
//
// Requiere GOOGLE_MAPS_API_KEY (solo Places API — el routing usa el OSRM
// gratuito que ya usa el resto de la app), SUPABASE_SERVICE_ROLE_KEY y
// NEXT_PUBLIC_SUPABASE_URL en el entorno (.env.local o exportadas).

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { geocode } from "@/lib/geo/geocode";
import { computeRoute, type ComputedRoute } from "@/lib/sources/routes";
import { searchPlacesText, getPlaceDetails, type GooglePlaceSearchResult } from "@/lib/sources/google-places";
import { mapPlaceDetailsToEvidence } from "@/lib/sources/google-places";
import { queryOverpassNearby, mapOsmTagsToEvidence } from "@/lib/sources/osm";
import { fetchOfficialWebsiteEvidence } from "@/lib/sources/official-website";
import { extractEvidenceFromReviews } from "@/lib/sources/reviews-nlp";
import { findDuplicate, type PlaceCandidate } from "@/lib/community/dedupe";
import { persistEvidence } from "@/lib/resolution/persist";
import { sampleEveryNMeters } from "@/lib/geo/sample-route";
import { nearestPointOnRoute } from "@/lib/geo/route-distance";
import type { Evidence } from "@/lib/domain/types";

const SAMPLE_INTERVAL_METERS = 20_000;
const SEARCH_RADIUS_METERS = 5_000;
const DISCOVERY_QUERIES = [
  "restaurante",
  "área de servicio",
  "gasolinera",
  "farmacia",
  "supermercado",
  "parque infantil",
  "hotel",
];

async function main() {
  const [origin, destination] = process.argv.slice(2);
  if (!origin || !destination) {
    console.error('Uso: npx tsx scripts/ingest-corridor.ts "Alicante" "Madrid"');
    process.exit(1);
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  console.log(`Calculando ruta ${origin} → ${destination}...`);
  const originPoint = await geocode(origin);
  const destinationPoint = await geocode(destination);
  const route = await computeRoute(originPoint, destinationPoint);
  const samplePoints = sampleEveryNMeters(route.points, SAMPLE_INTERVAL_METERS);
  console.log(`${samplePoints.length} puntos de muestreo a lo largo de ${(route.distanceMeters / 1000).toFixed(0)} km.`);

  const { data: routeRow, error: routeError } = await supabase
    .from("routes")
    .insert({
      origin,
      destination,
      origin_lat: route.originLat,
      origin_lng: route.originLng,
      destination_lat: route.destinationLat,
      destination_lng: route.destinationLng,
      geometry: JSON.stringify(route.points),
      distance_meters: Math.round(route.distanceMeters),
      duration_seconds: Math.round(route.durationSeconds),
    })
    .select("id")
    .single();
  if (routeError) throw routeError;

  console.log("Descubriendo lugares candidatos...");
  const discovered: GooglePlaceSearchResult[] = [];
  for (const point of samplePoints) {
    for (const query of DISCOVERY_QUERIES) {
      const results = await searchPlacesText(query, point, SEARCH_RADIUS_METERS);
      discovered.push(...results);
    }
  }

  const existingCandidates: PlaceCandidate[] = [];
  let processed = 0;
  let skippedDuplicates = 0;

  for (const candidate of discovered) {
    if (!candidate.location) continue;

    const placeCandidate: PlaceCandidate = {
      name: candidate.displayName?.text ?? "Sin nombre",
      lat: candidate.location.latitude,
      lng: candidate.location.longitude,
      googlePlaceId: candidate.id,
    };

    const duplicate = findDuplicate(placeCandidate, existingCandidates);
    if (duplicate.kind !== "none") {
      skippedDuplicates++;
      continue;
    }
    existingCandidates.push(placeCandidate);

    await ingestPlace(placeCandidate, routeRow.id, route, now, supabase);
    processed++;
    console.log(`  [${processed}] ${placeCandidate.name}`);
  }

  console.log(`\nHecho. ${processed} lugares ingeridos, ${skippedDuplicates} duplicados descartados.`);
}

async function ingestPlace(
  candidate: PlaceCandidate,
  routeId: string,
  route: ComputedRoute,
  now: Date,
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  const { data: place, error: insertError } = await supabase
    .from("places")
    .insert({
      name: candidate.name,
      category: "food", // por defecto — se corrige en revisión manual (doc. 10)
      subcategory: "unclassified",
      lat: candidate.lat,
      lng: candidate.lng,
      google_place_id: candidate.googlePlaceId,
      status: "needs_review",
      source_last_refreshed_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const evidence: Evidence[] = [];

  if (candidate.googlePlaceId) {
    const details = await getPlaceDetails(candidate.googlePlaceId);
    evidence.push(...mapPlaceDetailsToEvidence(details, now));

    const reviewTexts = ((details as { reviews?: Array<{ text?: { text: string } }> }).reviews ?? [])
      .map((r) => r.text?.text)
      .filter((text): text is string => Boolean(text));
    evidence.push(...(await extractEvidenceFromReviews(reviewTexts, now)));

    const websiteUri = (details as { websiteUri?: string }).websiteUri;
    if (websiteUri) {
      evidence.push(...(await fetchOfficialWebsiteEvidence(websiteUri, now)));
    }
  }

  const osmElements = await queryOverpassNearby(candidate.lat, candidate.lng, 100);
  for (const element of osmElements) {
    if (!element.tags) continue;
    evidence.push(...mapOsmTagsToEvidence(element.tags, now));
  }

  await persistEvidence(supabase, place.id, candidate.googlePlaceId ?? `${candidate.lat},${candidate.lng}`, evidence);

  const { distanceMeters, positionMeters } = nearestPointOnRoute(candidate, route.points);
  const positionSeconds = Math.round((positionMeters / route.distanceMeters) * route.durationSeconds);
  const detourSeconds = Math.round((distanceMeters / 1000) * 90); // ~90s/km, estimación (doc. 10)

  await supabase.from("place_routes").insert({
    place_id: place.id,
    route_id: routeId,
    distance_to_route_meters: distanceMeters,
    detour_seconds: detourSeconds,
    position_from_origin_seconds: positionSeconds,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
