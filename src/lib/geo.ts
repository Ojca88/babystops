export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Approximate distance from a point to the nearest segment of a route,
 * by projecting onto a local equirectangular plane. Good enough for
 * filtering stops within a few km of a road-trip route.
 */
export function distanceToRouteKm(point: LatLng, route: LatLng[]): number {
  if (route.length === 0) return Infinity;
  if (route.length === 1) return haversineKm(point, route[0]);

  const cosLat = Math.cos(toRad(point.lat));
  const project = (p: LatLng) => ({
    x: toRad(p.lng - point.lng) * cosLat * EARTH_RADIUS_KM,
    y: toRad(p.lat - point.lat) * EARTH_RADIUS_KM,
  });

  const p0 = { x: 0, y: 0 };
  let minKm = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const a = project(route[i]);
    const b = project(route[i + 1]);

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;

    let t = lenSq === 0 ? 0 : ((p0.x - a.x) * abx + (p0.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dist = Math.hypot(p0.x - cx, p0.y - cy);

    if (dist < minKm) minKm = dist;
  }

  return minKm;
}
