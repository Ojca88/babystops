import type { EvidenceSource } from "@/lib/domain/types";

// Pesos base por fuente — docs/baby-stops/06-evidencias-confianza.md
export const SOURCE_WEIGHTS: Record<EvidenceSource, number> = {
  OFFICIAL_WEBSITE: 40,
  GOOGLE_PLACES: 35,
  OSM: 25,
  COMMUNITY: 20,
  REVIEW_NLP: 10,
  AI_INFERENCE: 5,
};

export const CERTAINTY_FACTOR = {
  explicit: 1.0,
  implied: 0.6,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  confirmed: 70,
  probable: 40,
} as const;

export const CONTRADICTION_MARGIN = 15;

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
const TWELVE_MONTHS_MS = SIX_MONTHS_MS * 2;

export function decayFactor(detectedAt: Date, now: Date): number {
  const ageMs = now.getTime() - detectedAt.getTime();
  if (ageMs < SIX_MONTHS_MS) return 1.0;
  if (ageMs < TWELVE_MONTHS_MS) return 0.7;
  return 0.4;
}
