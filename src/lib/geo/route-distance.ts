import type { LatLng } from "./polyline";

export interface NearestPointResult {
  distanceMeters: number;
  positionMeters: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

// Proyección plana local (equirectangular) — suficiente para el volumen del
// MVP (cientos de lugares, un corredor), evita depender de PostGIS.
// docs/baby-stops/02-modelo-de-datos.md
function toLocalMeters(point: LatLng, origin: LatLng): { x: number; y: number } {
  return {
    x: (point.lng - origin.lng) * metersPerDegreeLng(origin.lat),
    y: (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
  };
}

export function nearestPointOnRoute(point: LatLng, route: LatLng[]): NearestPointResult {
  if (route.length === 0) throw new Error("nearestPointOnRoute: la ruta no puede estar vacía");
  if (route.length === 1) {
    const p = toLocalMeters(point, route[0]);
    return { distanceMeters: Math.hypot(p.x, p.y), positionMeters: 0 };
  }

  let cumulativeDistance = 0;
  let best: NearestPointResult = { distanceMeters: Infinity, positionMeters: 0 };

  for (let i = 0; i < route.length - 1; i++) {
    const segmentStart = route[i];
    const segmentEnd = route[i + 1];

    const a = toLocalMeters(segmentStart, segmentStart);
    const b = toLocalMeters(segmentEnd, segmentStart);
    const p = toLocalMeters(point, segmentStart);

    const segmentVector = { x: b.x - a.x, y: b.y - a.y };
    const segmentLengthSquared = segmentVector.x ** 2 + segmentVector.y ** 2;

    const t =
      segmentLengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * segmentVector.x + (p.y - a.y) * segmentVector.y) / segmentLengthSquared));

    const closest = { x: a.x + t * segmentVector.x, y: a.y + t * segmentVector.y };
    const distanceMeters = Math.hypot(p.x - closest.x, p.y - closest.y);
    const segmentLength = Math.sqrt(segmentLengthSquared);

    if (distanceMeters < best.distanceMeters) {
      best = { distanceMeters, positionMeters: cumulativeDistance + t * segmentLength };
    }

    cumulativeDistance += segmentLength;
  }

  return best;
}
