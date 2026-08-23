"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MapClient from "@/components/MapClient";
import AmenityFilter from "@/components/AmenityFilter";
import { fetchAllStops } from "@/lib/data/fetchStops";
import { distanceToRouteKm, type LatLng } from "@/lib/geo";
import { AMENITY_ICONS, AMENITY_LABELS, type Amenity, type Stop } from "@/lib/data/stops";

const BUFFER_KM = 5;

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

async function geocode(query: string): Promise<GeocodeResult | null> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Geocoding failed");
  const results: GeocodeResult[] = await res.json();
  return results[0] ?? null;
}

async function fetchRoute(origin: LatLng, destination: LatLng) {
  const params = new URLSearchParams({
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    destLat: String(destination.lat),
    destLng: String(destination.lng),
  });
  const res = await fetch(`/api/directions?${params.toString()}`);
  if (!res.ok) throw new Error("Could not find a driving route");
  return (await res.json()) as {
    distanceKm: number;
    durationMin: number;
    coordinates: LatLng[];
  };
}

function TripPlanner() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const missingParams = !from || !to;

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    missingParams ? "error" : "loading",
  );
  const [errorMessage, setErrorMessage] = useState(
    missingParams ? "Missing origin or destination." : "",
  );
  const [route, setRoute] = useState<LatLng[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [nearbyStops, setNearbyStops] = useState<Stop[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);

  useEffect(() => {
    if (missingParams) return;

    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");
        const [origin, destination, allStops] = await Promise.all([
          geocode(from),
          geocode(to),
          fetchAllStops(),
        ]);

        if (!origin) throw new Error(`Couldn't find "${from}"`);
        if (!destination) throw new Error(`Couldn't find "${to}"`);

        const routeData = await fetchRoute(origin, destination);
        if (cancelled) return;

        const withinBuffer = allStops.filter(
          (stop) =>
            distanceToRouteKm({ lat: stop.lat, lng: stop.lng }, routeData.coordinates) <=
            BUFFER_KM,
        );

        setRoute(routeData.coordinates);
        setRouteSummary({ distanceKm: routeData.distanceKm, durationMin: routeData.durationMin });
        setNearbyStops(withinBuffer);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [from, to, missingParams]);

  const filteredStops = useMemo(() => {
    if (selectedAmenities.length === 0) return nearbyStops;
    return nearbyStops.filter((stop) =>
      selectedAmenities.every((a) => stop.amenities.includes(a)),
    );
  }, [nearbyStops, selectedAmenities]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {from} → {to}
        </h1>
        {routeSummary && (
          <p className="text-sm text-slate-600">
            {routeSummary.distanceKm.toFixed(0)} km · about{" "}
            {Math.round(routeSummary.durationMin / 60)}h {Math.round(routeSummary.durationMin % 60)}m
            driving · showing stops within {BUFFER_KM} km of the route
          </p>
        )}
      </div>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}

      {status !== "error" && (
        <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[60vh] overflow-hidden rounded-2xl ring-1 ring-slate-200">
          {status === "loading" ? (
            <div className="flex h-full min-h-[60vh] items-center justify-center text-sm text-slate-500">
              Finding your route…
            </div>
          ) : (
            <MapClient
              stops={filteredStops}
              route={route}
              className="h-full min-h-[60vh] w-full"
            />
          )}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          {status === "ready" && filteredStops.length === 0 && (
            <p className="text-sm text-slate-500">
              No known stops along this route yet. Be the first to{" "}
              <Link href="/stops/new" className="font-medium text-blue-600 hover:underline">
                add one
              </Link>
              .
            </p>
          )}
          {filteredStops.map((stop) => (
            <a
              key={stop.id}
              href={`/stops/${stop.id}`}
              className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-400"
            >
              <p className="font-semibold text-slate-900">{stop.name}</p>
              {stop.address && <p className="text-xs text-slate-500">{stop.address}</p>}
              <p className="mt-1 flex flex-wrap gap-1 text-sm">
                {stop.amenities.map((a) => (
                  <span key={a} title={AMENITY_LABELS[a]}>
                    {AMENITY_ICONS[a]}
                  </span>
                ))}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading…</div>}>
      <TripPlanner />
    </Suspense>
  );
}
