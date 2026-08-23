import type { LatLng } from "./polyline";

const EARTH_RADIUS_METERS = 6_371_000;

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

// Muestrea la polyline de una ruta cada `intervalMeters` — paso 1 del
// descubrimiento de lugares. docs/baby-stops/08-poc-alicante-madrid.md
export function sampleEveryNMeters(route: LatLng[], intervalMeters: number): LatLng[] {
  if (route.length === 0) return [];

  const samples: LatLng[] = [route[0]];
  let distanceSinceLastSample = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const segmentStart = route[i];
    const segmentEnd = route[i + 1];
    const segmentLength = haversineDistanceMeters(segmentStart, segmentEnd);
    if (segmentLength === 0) continue;

    let distanceIntoSegment = 0;
    while (distanceSinceLastSample + (segmentLength - distanceIntoSegment) >= intervalMeters) {
      const remainingToNextSample = intervalMeters - distanceSinceLastSample;
      distanceIntoSegment += remainingToNextSample;
      samples.push(interpolate(segmentStart, segmentEnd, distanceIntoSegment / segmentLength));
      distanceSinceLastSample = 0;
    }

    distanceSinceLastSample += segmentLength - distanceIntoSegment;
  }

  return samples;
}
