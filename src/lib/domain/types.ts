export const BABY_FEATURE_TYPES = [
  "highchair",
  "changing_table",
  "family_restroom",
  "accessible_restroom",
  "kids_menu",
  "baby_food_options",
  "warm_food",
  "warm_bottle",
  "nursing_space",
  "stroller_access",
  "stroller_space",
  "elevator",
  "stairs_required",
  "indoor_play_area",
  "outdoor_play_area",
  "nearby_playground",
  "outdoor_space",
  "space_to_move",
  "parking",
  "nearby_parking",
  "parking_ease",
  "free_parking",
  "gas_station",
  "terrace",
  "quiet_atmosphere",
  "pet_friendly",
  "accessibility",
  "air_conditioning",
  "heating",
  "covered_area",
  "shade",
  "benches",
  "picnic_tables",
  "nearby_supermarket",
  "nearby_pharmacy",
  "nearby_medical_center",
] as const;

export type BabyFeatureType = (typeof BABY_FEATURE_TYPES)[number];

export const EVIDENCE_SOURCES = [
  "GOOGLE_PLACES",
  "OSM",
  "OFFICIAL_WEBSITE",
  "REVIEW_NLP",
  "COMMUNITY",
  "AI_INFERENCE",
] as const;

export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export type EvidenceCertainty = "explicit" | "implied";

export type FeatureStatus =
  | "CONFIRMED"
  | "PROBABLE"
  | "UNCONFIRMED"
  | "NOT_AVAILABLE"
  | "UNKNOWN"
  | "NEEDS_REVIEW";

export interface Evidence {
  featureType: BabyFeatureType;
  value: string;
  source: EvidenceSource;
  certainty: EvidenceCertainty;
  detectedAt: Date;
  rawValue?: string;
}

export interface ResolvedFeature {
  value: string | null;
  status: FeatureStatus;
  confidenceScore: number;
  lastVerifiedAt: Date | null;
}
