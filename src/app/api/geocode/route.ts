import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for Nominatim (OpenStreetMap) geocoding. Kept out of
// the client so we control the required User-Agent header and can add
// caching/rate-limiting later without a frontend change.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "babystops/0.1 (road-trip planner for parents)",
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 502 },
    );
  }

  const results = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return NextResponse.json(
    results.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    })),
  );
}
