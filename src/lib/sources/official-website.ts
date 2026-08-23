import type { BabyFeatureType, Evidence } from "@/lib/domain/types";
import { hasBabySignal } from "@/lib/ai/has-baby-signal";
import { extractBabyFeatures } from "@/lib/ai/extract-baby-features";
import { mapExtractionToEvidence } from "@/lib/ai/map-extraction-to-evidence";

// Paso 2 del pipeline (reglas, sin LLM) — docs/baby-stops/03-fuentes-y-extraccion.md
const KEYWORD_RULES: Array<{ keyword: string; featureType: BabyFeatureType; value: string }> = [
  { keyword: "trona", featureType: "highchair", value: "yes" },
  { keyword: "cambiador", featureType: "changing_table", value: "yes" },
  { keyword: "menu infantil", featureType: "kids_menu", value: "yes" },
  { keyword: "parque infantil", featureType: "outdoor_play_area", value: "yes" },
  { keyword: "zona infantil", featureType: "indoor_play_area", value: "yes" },
  { keyword: "acceso para carritos", featureType: "stroller_access", value: "easy" },
  { keyword: "acceso con carrito", featureType: "stroller_access", value: "easy" },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function extractKeywordSignals(text: string, detectedAt: Date): Evidence[] {
  const normalized = normalize(text);

  return KEYWORD_RULES.filter((rule) => normalized.includes(rule.keyword)).map((rule) => ({
    featureType: rule.featureType,
    value: rule.value,
    source: "OFFICIAL_WEBSITE",
    certainty: "explicit",
    detectedAt,
  }));
}

const MIN_CONTENT_LENGTH = 500;

export async function analyzeOfficialWebsiteText(text: string, detectedAt: Date): Promise<Evidence[]> {
  const ruleBasedEvidence = extractKeywordSignals(text, detectedAt);
  if (ruleBasedEvidence.length > 0) return ruleBasedEvidence;

  if (text.length < MIN_CONTENT_LENGTH || !hasBabySignal(text)) return [];

  const results = await extractBabyFeatures([text]);
  return mapExtractionToEvidence(results, "OFFICIAL_WEBSITE", detectedAt);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetch en vivo de la web oficial — requiere red, no cubierto por tests
// unitarios. Respeta el fair-use de doc. 4 (identificarse con User-Agent,
// no insistir si la web bloquea el acceso).
export async function fetchOfficialWebsiteEvidence(url: string, detectedAt: Date): Promise<Evidence[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "BabyStopsBot/0.1 (+https://babystops.app)" },
  });
  if (!response.ok) return [];

  const html = await response.text();
  return analyzeOfficialWebsiteText(stripHtml(html), detectedAt);
}
