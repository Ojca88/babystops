"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  if (!res.ok) throw new Error("No se pudo geocodificar la dirección");
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
  if (!res.ok) throw new Error("No se pudo calcular una ruta en coche");
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
    missingParams ? "Falta el origen o el destino." : "",
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

        if (!origin) throw new Error(`No hemos encontrado "${from}"`);
        if (!destination) throw new Error(`No hemos encontrado "${to}"`);

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
        setErrorMessage(err instanceof Error ? err.message : "Ha ocurrido un error");
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
    // Cualquiera de los servicios seleccionados, no todos a la vez —
    // exigir todos hacía casi imposible obtener resultados.
    return nearbyStops.filter((stop) =>
      selectedAmenities.some((a) => stop.amenities.includes(a)),
    );
  }, [nearbyStops, selectedAmenities]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--foreground)]">
          {from} <ArrowRight className="h-5 w-5 text-[var(--color-coral-500)]" /> {to}
        </h1>
        {routeSummary && (
          <p className="text-sm text-[var(--foreground)]/60">
            {routeSummary.distanceKm.toFixed(0)} km · unas{" "}
            {Math.round(routeSummary.durationMin / 60)}h {Math.round(routeSummary.durationMin % 60)}m
            en coche · paradas a menos de {BUFFER_KM} km de la ruta
          </p>
        )}
      </div>

      {status === "error" && (
        <p className="rounded-lg bg-[var(--color-coral-50)] p-3 text-sm text-[var(--color-coral-600)]">
          {errorMessage}
        </p>
      )}

      {status !== "error" && (
        <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[60vh] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
          {status === "loading" ? (
            <div className="flex h-full min-h-[60vh] items-center justify-center text-sm text-[var(--foreground)]/50">
              Buscando tu ruta…
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
            <p className="text-sm text-[var(--foreground)]/60">
              Todavía no hay paradas conocidas en esta ruta. Sé el primero en{" "}
              <Link
                href="/stops/new"
                className="font-medium text-[var(--color-teal-600)] hover:underline"
              >
                añadir una
              </Link>
              .
            </p>
          )}
          {filteredStops.map((stop) => (
            <a
              key={stop.id}
              href={`/stops/${stop.id}`}
              className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition hover:ring-[var(--color-coral-400)]"
            >
              <p className="font-semibold text-[var(--foreground)]">{stop.name}</p>
              {stop.address && (
                <p className="text-xs text-[var(--foreground)]/50">{stop.address}</p>
              )}
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {stop.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a];
                  return (
                    <span
                      key={a}
                      title={AMENITY_LABELS[a]}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-teal-50)] text-[var(--color-teal-600)]"
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                  );
                })}
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
    <Suspense
      fallback={<div className="p-4 text-sm text-[var(--foreground)]/50">Cargando…</div>}
    >
      <TripPlanner />
    </Suspense>
  );
}
