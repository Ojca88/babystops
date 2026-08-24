#!/usr/bin/env tsx
// Pipeline de ingesta de un corredor (Fase 0/1 del POC) —
// docs/baby-stops/08-poc-alicante-madrid.md, 10-mvp-tecnico.md
//
// Uso: npx tsx scripts/ingest-corridor.ts "Alicante" "Madrid"
//
// Requiere SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL. El routing
// usa el OSRM gratuito que ya usa el resto de la app. El descubrimiento usa
// OSM/Overpass (gratis, siempre activo) y, si hay GOOGLE_MAPS_API_KEY,
// también Google Places — pero Google es opcional: si falla o no está
// configurada, el pipeline sigue solo con OSM en vez de abortar.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { geocode } from "@/lib/geo/geocode";
import { computeRoute, type ComputedRoute } from "@/lib/sources/routes";
import { searchPlacesText, getPlaceDetails } from "@/lib/sources/google-places";
import { mapPlaceDetailsToEvidence } from "@/lib/sources/google-places";
import { queryOverpassNearby, mapOsmTagsToEvidence } from "@/lib/sources/osm";
import { discoverOsmPlacesNear } from "@/lib/sources/osm-discovery";
import { fetchOfficialWebsiteEvidence } from "@/lib/sources/official-website";
import { extractEvidenceFromReviews } from "@/lib/sources/reviews-nlp";
import { findDuplicate, type PlaceCandidate } from "@/lib/community/dedupe";
import { persistEvidence } from "@/lib/resolution/persist";
import { sampleEveryNMeters } from "@/lib/geo/sample-route";
import { nearestPointOnRoute } from "@/lib/geo/route-distance";
import type { Evidence } from "@/lib/domain/types";

const DEFAULT_DISCOVERY_QUERIES = [
  "restaurante",
  "área de servicio",
  "gasolinera",
  "farmacia",
  "supermercado",
  "parque infantil",
  "hotel",
];

// Configurable por variables de entorno — un proyecto de Google Cloud
// nuevo trae por defecto una cuota de 100 Text Search/día (no es un límite
// de velocidad, es un tope diario duro: ver docs/baby-stops/09-estimacion-costes.md).
// Ajusta esto para caber en tu cuota mientras la aumentas, o pide el
// aumento en https://cloud.google.com/docs/quotas/help/request_increase
const SAMPLE_INTERVAL_METERS = Number(process.env.INGEST_SAMPLE_INTERVAL_METERS ?? 20_000);
const SEARCH_RADIUS_METERS = 5_000; // radio para Google Text Search (limita resultados por consulta, ~20 máx.)
// OSM/Overpass devuelve TODO lo que coincida dentro del radio, sin límite
// por consulta — un radio igual al de Google (5km) puede devolver miles de
// nodos por punto en zonas urbanas. Se usa uno mucho más ajustado.
const OSM_DISCOVERY_RADIUS_METERS = Number(process.env.INGEST_OSM_RADIUS_METERS ?? 1_000);
const DISCOVERY_QUERIES = process.env.INGEST_DISCOVERY_QUERIES
  ? process.env.INGEST_DISCOVERY_QUERIES.split(",").map((q) => q.trim())
  : DEFAULT_DISCOVERY_QUERIES;
const MAX_TEXT_SEARCHES = Number(process.env.INGEST_MAX_TEXT_SEARCHES ?? 90); // margen bajo el tope de 100/día
const SKIP_GOOGLE = process.env.INGEST_SKIP_GOOGLE === "true" || !process.env.GOOGLE_MAPS_API_KEY;

// Pausa entre llamadas a Google Places — reparte las peticiones en el
// tiempo (defensa adicional, no es la causa del error de cuota diaria).
const DISCOVERY_THROTTLE_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const allCandidates = await discoverCandidates(samplePoints, origin, destination);

  // Carga lo que ya existe en la base de datos (de esta u otras ejecuciones)
  // para que el script sea re-ejecutable: sin esto, cualquier lugar ya
  // insertado antes revienta el insert siguiente por la restricción unique
  // de google_place_id/osm_id y aborta todo el proceso.
  const { data: existingPlacesInDb, error: existingPlacesError } = await supabase
    .from("places")
    .select("id, name, lat, lng, google_place_id, osm_id");
  if (existingPlacesError) throw existingPlacesError;

  const existingCandidates: PlaceCandidate[] = (existingPlacesInDb ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    googlePlaceId: p.google_place_id ?? undefined,
    osmId: p.osm_id ?? undefined,
  }));
  const alreadyInDbCount = existingCandidates.length;

  let processed = 0;
  let skippedDuplicates = 0;

  for (const candidate of allCandidates) {
    const duplicate = findDuplicate(candidate, existingCandidates);
    if (duplicate.kind !== "none") {
      skippedDuplicates++;
      continue;
    }
    existingCandidates.push(candidate);

    await ingestPlace(candidate, routeRow.id, route, now, supabase);
    processed++;
    console.log(`  [${processed}] ${candidate.name}`);
  }

  console.log(
    `\nHecho. ${processed} lugares nuevos ingeridos, ${skippedDuplicates} duplicados descartados ` +
      `(${alreadyInDbCount} ya estaban en la base de datos de antes).`,
  );
}

async function discoverCandidates(
  samplePoints: ComputedRoute["points"],
  origin: string,
  destination: string,
): Promise<PlaceCandidate[]> {
  console.log("Descubriendo lugares candidatos...");

  console.log("  vía OSM/Overpass (gratis, sin cuota)...");
  const candidatesFromOsm: PlaceCandidate[] = [];
  for (const [i, point] of samplePoints.entries()) {
    try {
      candidatesFromOsm.push(...(await discoverOsmPlacesNear(point.lat, point.lng, OSM_DISCOVERY_RADIUS_METERS)));
    } catch (error) {
      console.warn(`    aviso: Overpass falló en el punto ${i + 1}/${samplePoints.length}: ${(error as Error).message}`);
    }
  }
  console.log(`  ${candidatesFromOsm.length} candidatos de OSM.`);

  const candidatesFromGoogle: PlaceCandidate[] = [];
  if (SKIP_GOOGLE) {
    console.log("  Google Places desactivado (sin GOOGLE_MAPS_API_KEY o INGEST_SKIP_GOOGLE=true) — solo OSM.");
  } else {
    const plannedTextSearches = samplePoints.length * DISCOVERY_QUERIES.length;
    if (plannedTextSearches > MAX_TEXT_SEARCHES) {
      console.warn(
        `  aviso: el plan de Google (${plannedTextSearches} búsquedas) supera el límite de seguridad ` +
          `(${MAX_TEXT_SEARCHES}) — se omite Google Places esta vez, se sigue solo con OSM. Ajusta ` +
          `INGEST_SAMPLE_INTERVAL_METERS/INGEST_DISCOVERY_QUERIES/INGEST_MAX_TEXT_SEARCHES si quieres forzarlo.`,
      );
    } else {
      console.log("  vía Google Places...");
      let searchesDone = 0;
      for (const point of samplePoints) {
        for (const query of DISCOVERY_QUERIES) {
          try {
            const results = await searchPlacesText(query, point, SEARCH_RADIUS_METERS);
            for (const r of results) {
              if (!r.location) continue;
              candidatesFromGoogle.push({
                name: r.displayName?.text ?? "Sin nombre",
                lat: r.location.latitude,
                lng: r.location.longitude,
                googlePlaceId: r.id,
              });
            }
          } catch (error) {
            console.warn(`    aviso: Google Places falló ("${query}"): ${(error as Error).message}`);
          }
          searchesDone++;
          if (searchesDone % 10 === 0) console.log(`    búsquedas: ${searchesDone}/${plannedTextSearches}`);
          await sleep(DISCOVERY_THROTTLE_MS);
        }
      }
      console.log(`  ${candidatesFromGoogle.length} candidatos de Google.`);
    }
  }

  if (candidatesFromOsm.length === 0 && candidatesFromGoogle.length === 0) {
    console.warn(`  Sin candidatos de ninguna fuente para ${origin} → ${destination}.`);
  }

  return [...candidatesFromGoogle, ...candidatesFromOsm];
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
      osm_id: candidate.osmId,
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

  const sourceReference = candidate.googlePlaceId ?? candidate.osmId?.toString() ?? `${candidate.lat},${candidate.lng}`;
  await persistEvidence(supabase, place.id, sourceReference, evidence);

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
