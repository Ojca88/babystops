import type { SupabaseClient } from "@supabase/supabase-js";
import type { BabyFeatureType, Evidence } from "@/lib/domain/types";
import { SOURCE_WEIGHTS } from "./config";
import { resolveFeature } from "./resolve-feature";

// Persiste evidencia nueva y recalcula baby_features — requiere DB real
// (service role), no cubierto por tests unitarios. La lógica de negocio
// (resolveFeature) sí lo está — ver resolve-feature.test.ts.

export async function persistEvidence(
  supabase: SupabaseClient,
  placeId: string,
  sourceReference: string,
  evidence: Evidence[],
): Promise<void> {
  if (evidence.length === 0) return;

  const { error } = await supabase.from("evidence").insert(
    evidence.map((e) => ({
      place_id: placeId,
      feature_type: e.featureType,
      source: e.source,
      source_reference: sourceReference,
      value: e.value,
      raw_value: e.rawValue ?? null,
      certainty: e.certainty,
      confidence_weight: SOURCE_WEIGHTS[e.source],
      detected_at: e.detectedAt.toISOString(),
    })),
  );
  if (error) throw error;

  const touchedFeatureTypes = [...new Set(evidence.map((e) => e.featureType))];
  await Promise.all(touchedFeatureTypes.map((featureType) => resolveAndPersistFeature(supabase, placeId, featureType)));
}

export async function resolveAndPersistFeature(
  supabase: SupabaseClient,
  placeId: string,
  featureType: BabyFeatureType,
): Promise<void> {
  const { data, error } = await supabase
    .from("evidence")
    .select("value, source, certainty, detected_at")
    .eq("place_id", placeId)
    .eq("feature_type", featureType);
  if (error) throw error;

  const evidence: Evidence[] = (data ?? []).map((row) => ({
    featureType,
    value: row.value,
    source: row.source,
    certainty: row.certainty,
    detectedAt: new Date(row.detected_at),
  }));

  const resolved = resolveFeature(evidence, new Date());

  const { error: upsertError } = await supabase.from("baby_features").upsert(
    {
      place_id: placeId,
      feature_type: featureType,
      value: resolved.value ?? "unknown",
      status: resolved.status,
      confidence_score: resolved.confidenceScore,
      last_verified_at: resolved.lastVerifiedAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "place_id,feature_type" },
  );
  if (upsertError) throw upsertError;
}
