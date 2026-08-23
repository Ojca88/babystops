export interface PlaceCandidate {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  googlePlaceId?: string;
  osmId?: number;
}

export type DuplicateMatch =
  | { kind: "exact"; place: PlaceCandidate }
  | { kind: "needs_review"; place: PlaceCandidate; similarity: number; distanceMeters: number }
  | { kind: "none" };

const DISTANCE_THRESHOLD_METERS = 50;
const SIMILARITY_THRESHOLD = 0.6;
const EARTH_RADIUS_METERS = 6_371_000;

export function findDuplicate(candidate: PlaceCandidate, existingPlaces: PlaceCandidate[]): DuplicateMatch {
  const exactMatch = existingPlaces.find(
    (place) =>
      (candidate.googlePlaceId && place.googlePlaceId === candidate.googlePlaceId) ||
      (candidate.osmId !== undefined && place.osmId === candidate.osmId),
  );
  if (exactMatch) return { kind: "exact", place: exactMatch };

  for (const place of existingPlaces) {
    const distanceMeters = haversineDistanceMeters(candidate, place);
    if (distanceMeters > DISTANCE_THRESHOLD_METERS) continue;

    const similarity = nameSimilarity(candidate.name, place.name);
    if (similarity > SIMILARITY_THRESHOLD) {
      return { kind: "needs_review", place, similarity, distanceMeters };
    }
  }

  return { kind: "none" };
}

function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/\b(centro|alicante|madrid|sucursal)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA.length === 0 || normB.length === 0) return 0;

  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  return 1 - distance / maxLength;
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}
