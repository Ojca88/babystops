import type { BabyFeatureType, FeatureStatus } from "@/lib/domain/types";

export interface FeatureInput {
  value: string;
  status: FeatureStatus;
  confidenceScore: number;
  sourceCount: number;
}

export type FeatureMap = Partial<Record<BabyFeatureType, FeatureInput>>;

export type ComponentKey = "food" | "hygiene" | "stroller" | "entertainment" | "car" | "evidence";

export type AgeProfile = Record<ComponentKey, number>;

export const AGE_PROFILES: Record<"general" | "0-6" | "6-12" | "1-2" | "2-4", AgeProfile> = {
  general: { food: 20, hygiene: 20, stroller: 20, entertainment: 20, car: 10, evidence: 10 },
  "0-6": { food: 15, hygiene: 30, stroller: 25, entertainment: 5, car: 15, evidence: 10 },
  "6-12": { food: 25, hygiene: 20, stroller: 15, entertainment: 10, car: 15, evidence: 15 },
  "1-2": { food: 20, hygiene: 15, stroller: 10, entertainment: 25, car: 15, evidence: 15 },
  "2-4": { food: 15, hygiene: 10, stroller: 5, entertainment: 35, car: 15, evidence: 20 },
};

export interface ComponentBreakdown {
  component: ComponentKey;
  points: number;
  maxPoints: number;
}

export interface BabyScoreResult {
  total: number;
  components: ComponentBreakdown[];
}

function confidenceFraction(features: FeatureMap, type: BabyFeatureType): number {
  const feature = features[type];
  if (!feature) return 0;
  if (feature.status === "NOT_AVAILABLE" || feature.status === "UNKNOWN" || feature.status === "NEEDS_REVIEW") {
    return 0;
  }
  return feature.confidenceScore / 100;
}

interface FeatureDef {
  weight: number;
  applicableWhen?: (features: FeatureMap) => boolean;
  score: (features: FeatureMap) => number;
  hasEvidence: (features: FeatureMap) => boolean;
  sourceCount: (features: FeatureMap) => number;
}

function hasFeatureEvidence(features: FeatureMap, type: BabyFeatureType): boolean {
  return features[type] !== undefined && features[type]?.status !== "UNKNOWN";
}

function simple(type: BabyFeatureType, weight: number): FeatureDef {
  return {
    weight,
    score: (features) => confidenceFraction(features, type),
    hasEvidence: (features) => hasFeatureEvidence(features, type),
    sourceCount: (features) => features[type]?.sourceCount ?? 0,
  };
}

function withMultiplier(
  type: BabyFeatureType,
  weight: number,
  multipliers: Record<string, number>,
): FeatureDef {
  return {
    weight,
    score: (features) => {
      const feature = features[type];
      if (!feature) return 0;
      const multiplier = multipliers[feature.value] ?? 0;
      return confidenceFraction(features, type) * multiplier;
    },
    hasEvidence: (features) => hasFeatureEvidence(features, type),
    sourceCount: (features) => features[type]?.sourceCount ?? 0,
  };
}

function bestOf(types: BabyFeatureType[], weight: number): FeatureDef {
  return {
    weight,
    score: (features) => Math.max(0, ...types.map((type) => confidenceFraction(features, type))),
    hasEvidence: (features) => types.some((type) => hasFeatureEvidence(features, type)),
    sourceCount: (features) => Math.max(0, ...types.map((type) => features[type]?.sourceCount ?? 0)),
  };
}

function componentFraction(defs: FeatureDef[], features: FeatureMap): number {
  const applicable = defs.filter((d) => !d.applicableWhen || d.applicableWhen(features));
  const inapplicableWeight = defs
    .filter((d) => d.applicableWhen && !d.applicableWhen(features))
    .reduce((sum, d) => sum + d.weight, 0);
  const applicableBaseWeight = applicable.reduce((sum, d) => sum + d.weight, 0);

  if (applicableBaseWeight === 0) return 0;

  return applicable.reduce((sum, d) => {
    const redistributedWeight = d.weight + inapplicableWeight * (d.weight / applicableBaseWeight);
    return sum + redistributedWeight * d.score(features);
  }, 0);
}

const STROLLER_ACCESS_MULTIPLIERS = { easy: 1.0, possible: 0.6, difficult: 0.1 };
const PARKING_EASE_MULTIPLIERS = { easy: 1.0, medium: 0.5, difficult: 0.1 };

const FOOD_DEFS: FeatureDef[] = [
  simple("highchair", 0.3),
  simple("kids_menu", 0.2),
  simple("baby_food_options", 0.2),
  simple("warm_food", 0.15),
  simple("warm_bottle", 0.15),
];

const HYGIENE_DEFS: FeatureDef[] = [
  simple("changing_table", 0.5),
  simple("family_restroom", 0.3),
  simple("accessible_restroom", 0.2),
];

const STROLLER_DEFS: FeatureDef[] = [
  withMultiplier("stroller_access", 0.4, STROLLER_ACCESS_MULTIPLIERS),
  simple("stroller_space", 0.3),
  {
    weight: 0.3,
    applicableWhen: (features) => features.stairs_required?.value === "yes",
    score: (features) => confidenceFraction(features, "elevator"),
    hasEvidence: (features) => hasFeatureEvidence(features, "elevator"),
    sourceCount: (features) => features.elevator?.sourceCount ?? 0,
  },
];

const ENTERTAINMENT_DEFS: FeatureDef[] = [
  bestOf(["indoor_play_area", "outdoor_play_area"], 0.4),
  simple("nearby_playground", 0.3),
  simple("space_to_move", 0.3),
];

const CAR_DEFS: FeatureDef[] = [
  bestOf(["parking", "nearby_parking"], 0.5),
  withMultiplier("parking_ease", 0.3, PARKING_EASE_MULTIPLIERS),
  simple("free_parking", 0.2),
];

const ALL_CONTENT_DEFS: FeatureDef[] = [
  ...FOOD_DEFS,
  ...HYGIENE_DEFS,
  ...STROLLER_DEFS,
  ...ENTERTAINMENT_DEFS,
  ...CAR_DEFS,
];

function evidenceFraction(features: FeatureMap): number {
  const applicable = ALL_CONTENT_DEFS.filter((d) => !d.applicableWhen || d.applicableWhen(features));
  const withEvidence = applicable.filter((d) => d.hasEvidence(features));

  if (withEvidence.length === 0) return 0;

  const ratio = withEvidence.length / applicable.length;
  const hasMultiSource = withEvidence.some((d) => d.sourceCount(features) >= 2);
  const diversityFactor = hasMultiSource ? 1.0 : 0.7;

  return ratio * diversityFactor;
}

const COMPONENT_FRACTIONS: Record<ComponentKey, (features: FeatureMap) => number> = {
  food: (features) => componentFraction(FOOD_DEFS, features),
  hygiene: (features) => componentFraction(HYGIENE_DEFS, features),
  stroller: (features) => componentFraction(STROLLER_DEFS, features),
  entertainment: (features) => componentFraction(ENTERTAINMENT_DEFS, features),
  car: (features) => componentFraction(CAR_DEFS, features),
  evidence: evidenceFraction,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateBabyScore(
  features: FeatureMap,
  profile: AgeProfile = AGE_PROFILES.general,
): BabyScoreResult {
  const components: ComponentBreakdown[] = (Object.keys(COMPONENT_FRACTIONS) as ComponentKey[]).map((key) => {
    const fraction = COMPONENT_FRACTIONS[key](features);
    const maxPoints = profile[key];
    return { component: key, points: round2(fraction * maxPoints), maxPoints };
  });

  const total = round2(components.reduce((sum, c) => sum + c.points, 0));

  return { total, components };
}
