import type { BabyFeatureType, Evidence, EvidenceCertainty } from "@/lib/domain/types";

export interface FeatureExtractionResult {
  featureType: BabyFeatureType;
  value: string;
  evidenceQuote: string;
  confidence: EvidenceCertainty;
}

export type LlmEvidenceOrigin = "REVIEW_NLP" | "OFFICIAL_WEBSITE";

// Una extracción "implied" (no una cita explícita) se degrada a AI_INFERENCE
// en vez de mantener la fuente original — docs/baby-stops/06-evidencias-confianza.md
export function mapExtractionToEvidence(
  results: FeatureExtractionResult[],
  origin: LlmEvidenceOrigin,
  detectedAt: Date,
): Evidence[] {
  return results.map((result) => ({
    featureType: result.featureType,
    value: result.value,
    source: result.confidence === "explicit" ? origin : "AI_INFERENCE",
    certainty: result.confidence,
    detectedAt,
    rawValue: result.evidenceQuote,
  }));
}
