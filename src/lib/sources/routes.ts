import type { LatLng } from "@/lib/geo/polyline";

export interface ComputedRoute {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

interface OsrmResponse {
  code: string;
  routes: Array<{
    geometry: { coordinates: [number, number][] };
    distance: number;
    duration: number;
  }>;
}

// El repo ya tiene un proxy de OSRM sin coste ni API key (src/app/api/directions/route.ts,
// usado por la búsqueda de viaje existente) — se reutiliza aquí en vez de
// depender de Google Routes API, que exigiría un segundo proyecto de Google
// Cloud con facturación solo para calcular la geometría de la ruta.
export async function computeRoute(origin: LatLng, destination: LatLng): Promise<ComputedRoute> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`OSRM falló: ${response.status}`);

  const data = (await response.json()) as OsrmResponse;
  if (data.code !== "Ok" || data.routes.length === 0) {
    throw new Error(`OSRM no encontró ruta entre ${JSON.stringify(origin)} y ${JSON.stringify(destination)}`);
  }

  const route = data.routes[0];

  return {
    originLat: origin.lat,
    originLng: origin.lng,
    destinationLat: destination.lat,
    destinationLng: destination.lng,
    points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
