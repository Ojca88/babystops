import type { Evidence, FeatureStatus, ResolvedFeature } from "@/lib/domain/types";
import {
  CERTAINTY_FACTOR,
  CONFIDENCE_THRESHOLDS,
  CONTRADICTION_MARGIN,
  SOURCE_WEIGHTS,
  decayFactor,
} from "./config";

interface ScoredValue {
  value: string;
  score: number;
  lastVerifiedAt: Date;
}

export function resolveFeature(evidence: Evidence[], now: Date): ResolvedFeature {
  if (evidence.length === 0) {
    return { value: null, status: "UNKNOWN", confidenceScore: 0, lastVerifiedAt: null };
  }

  const scoredValues = scoreByValue(evidence, now).sort((a, b) => b.score - a.score);
  const winner = scoredValues[0];
  const runnerUp = scoredValues[1];

  let status = deriveStatus(winner.value, winner.score);

  if (runnerUp && Math.abs(winner.score - runnerUp.score) < CONTRADICTION_MARGIN) {
    status = "NEEDS_REVIEW";
  }

  return {
    value: winner.value,
    status,
    confidenceScore: winner.score,
    lastVerifiedAt: winner.lastVerifiedAt,
  };
}

function scoreByValue(evidence: Evidence[], now: Date): ScoredValue[] {
  const byValue = new Map<string, Evidence[]>();
  for (const e of evidence) {
    const group = byValue.get(e.value) ?? [];
    group.push(e);
    byValue.set(e.value, group);
  }

  return Array.from(byValue.entries()).map(([value, items]) => ({
    value,
    score: scoreValueGroup(items, now),
    lastVerifiedAt: latestDate(items),
  }));
}

function scoreValueGroup(items: Evidence[], now: Date): number {
  const bySource = new Map<string, Evidence[]>();
  for (const e of items) {
    const group = bySource.get(e.source) ?? [];
    group.push(e);
    bySource.set(e.source, group);
  }

  let total = 0;
  for (const [source, sourceItems] of bySource) {
    const weight = SOURCE_WEIGHTS[source as keyof typeof SOURCE_WEIGHTS];
    const avgFactor =
      sourceItems.reduce((sum, e) => sum + decayFactor(e.detectedAt, now) * CERTAINTY_FACTOR[e.certainty], 0) /
      sourceItems.length;
    total += weight * Math.sqrt(sourceItems.length) * avgFactor;
  }

  return Math.min(100, Math.round(total * 100) / 100);
}

function latestDate(items: Evidence[]): Date {
  return items.reduce((latest, e) => (e.detectedAt > latest ? e.detectedAt : latest), items[0].detectedAt);
}

function deriveStatus(value: string, score: number): FeatureStatus {
  if (value === "no") {
    return score > 0 ? "NOT_AVAILABLE" : "UNKNOWN";
  }
  if (score >= CONFIDENCE_THRESHOLDS.confirmed) return "CONFIRMED";
  if (score >= CONFIDENCE_THRESHOLDS.probable) return "PROBABLE";
  if (score > 0) return "UNCONFIRMED";
  return "UNKNOWN";
}
