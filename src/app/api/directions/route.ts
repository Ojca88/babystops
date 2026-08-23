import { NextRequest, NextResponse } from "next/server";

interface OsrmResponse {
  code: string;
  routes: Array<{
    geometry: { coordinates: [number, number][] };
    distance: number;
    duration: number;
  }>;
}

// Server-side proxy for OSRM's public routing API (driving directions).
// Kept server-side so we can swap providers later without a client change.
export async function GET(request: NextRequest) {
  const originLat = request.nextUrl.searchParams.get("originLat");
  const originLng = request.nextUrl.searchParams.get("originLng");
  const destLat = request.nextUrl.searchParams.get("destLat");
  const destLng = request.nextUrl.searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: "Missing origin/destination coordinates" },
      { status: 400 },
    );
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;

  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Routing service unavailable" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as OsrmResponse;

  if (data.code !== "Ok" || data.routes.length === 0) {
    return NextResponse.json({ error: "No route found" }, { status: 404 });
  }

  const route = data.routes[0];

  return NextResponse.json({
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    // OSRM returns [lng, lat]; flip to [lat, lng] for consistency with the
    // rest of the app (and with Leaflet's LatLng convention).
    coordinates: route.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    })),
  });
}
