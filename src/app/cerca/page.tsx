"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LocateFixed } from "lucide-react";
import { fetchAllStops } from "@/lib/data/fetchStops";
import { AMENITY_ICONS, AMENITY_LABELS, type Amenity, type Stop } from "@/lib/data/stops";
import { haversineKm, type LatLng } from "@/lib/geo";
import AmenityFilter from "@/components/AmenityFilter";

type Status = "idle" | "locating" | "loading" | "ready" | "error";

export default function CercaPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  async function handleLocate() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    setStatus("locating");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setHere({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("loading");
        try {
          setStops(await fetchAllStops());
          setStatus("ready");
        } catch {
          setStatus("error");
          setErrorMessage("No se han podido cargar las paradas.");
        }
      },
      () => {
        setStatus("error");
        setErrorMessage("No hemos podido acceder a tu ubicación — actívala en los ajustes del navegador.");
      },
    );
  }

  const nearby = useMemo(() => {
    if (!here) return [];
    return stops
      .filter((s) => amenities.every((a) => s.amenities.includes(a)))
      .map((s) => ({ stop: s, distanceKm: haversineKm(here, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);
  }, [here, stops, amenities]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-4">
      <h1 className="mb-1 text-2xl font-bold text-[var(--foreground)]">Necesito parar ya</h1>
      <p className="mb-4 text-sm text-[var(--foreground)]/60">
        Te decimos qué paradas tienes más cerca ahora mismo, ordenadas por
        distancia.
      </p>

      {status !== "ready" && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <button
            type="button"
            onClick={handleLocate}
            disabled={status === "locating" || status === "loading"}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-coral-600)] disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" strokeWidth={2.5} />
            {status === "locating"
              ? "Localizando…"
              : status === "loading"
                ? "Buscando paradas…"
                : "Usar mi ubicación"}
          </button>
          {status === "error" && errorMessage && (
            <p className="mt-3 text-sm text-[var(--color-coral-600)]">{errorMessage}</p>
          )}
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-[var(--foreground)]/70">¿Qué necesitas?</p>
            <AmenityFilter selected={amenities} onChange={setAmenities} />
          </div>

          {nearby.length === 0 && (
            <p className="rounded-2xl bg-white/70 p-4 text-sm text-[var(--foreground)]/50 shadow-sm ring-1 ring-black/5">
              No hay paradas registradas cerca con esos servicios.
            </p>
          )}

          <ul className="space-y-2.5">
            {nearby.map(({ stop, distanceKm }) => (
              <li key={stop.id}>
                <Link
                  href={`/stops/${stop.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-[var(--color-coral-400)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--foreground)]">{stop.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {stop.amenities.slice(0, 4).map((a) => {
                        const Icon = AMENITY_ICONS[a];
                        return (
                          <span
                            key={a}
                            title={AMENITY_LABELS[a]}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-teal-50)] text-[var(--color-teal-600)]"
                          >
                            <Icon className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]/70">
                    {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
