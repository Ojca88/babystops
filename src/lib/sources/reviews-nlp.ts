import type { Evidence } from "@/lib/domain/types";
import { hasBabySignal } from "@/lib/ai/has-baby-signal";
import { extractBabyFeatures } from "@/lib/ai/extract-baby-features";
import { mapExtractionToEvidence } from "@/lib/ai/map-extraction-to-evidence";

// Máximo de reseñas por lugar impuesto por la propia API de Google Places —
// docs/baby-stops/04-limitaciones-legales.md
const MAX_REVIEWS = 5;

export async function extractEvidenceFromReviews(reviewTexts: string[], detectedAt: Date): Promise<Evidence[]> {
  const relevant = reviewTexts.slice(0, MAX_REVIEWS).filter(hasBabySignal);
  if (relevant.length === 0) return [];

  const results = await extractBabyFeatures(relevant);
  return mapExtractionToEvidence(results, "REVIEW_NLP", detectedAt);
}
