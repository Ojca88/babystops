import { BABY_FEATURE_TYPES, type BabyFeatureType, type FeatureStatus } from "@/lib/domain/types";
import type { FeatureMap } from "./baby-score";

// Forma cruda que devuelve la columna `features` (jsonb) de la vista
// public.place_summary (supabase/migrations/0002_baby_stops_model.sql).
export type PlaceSummaryFeatures =
  | Partial<Record<string, { value: string; status: FeatureStatus; confidence: number }>>
  | null
  | undefined;

const KNOWN_FEATURE_TYPES = new Set<string>(BABY_FEATURE_TYPES);

// La vista no agrega cuántas fuentes distintas aportaron cada característica
// — se asume 1 (conservador: infravalora ligeramente el factor de
// diversidad del Baby Score en vez de sobreestimarlo) hasta que la vista
// se extienda para calcularlo de verdad.
const DEFAULT_SOURCE_COUNT = 1;

export function placeSummaryToFeatureMap(raw: PlaceSummaryFeatures): FeatureMap {
  const map: FeatureMap = {};
  if (!raw) return map;

  for (const [key, feature] of Object.entries(raw)) {
    if (!feature || !KNOWN_FEATURE_TYPES.has(key)) continue;

    map[key as BabyFeatureType] = {
      value: feature.value,
      status: feature.status,
      confidenceScore: feature.confidence,
      sourceCount: DEFAULT_SOURCE_COUNT,
    };
  }

  return map;
}
