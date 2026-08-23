"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MapClient from "@/components/MapClient";
import AmenityFilter from "@/components/AmenityFilter";
import { fetchAllStops } from "@/lib/data/fetchStops";
import type { Amenity, Stop } from "@/lib/data/stops";

export default function MapPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);

  useEffect(() => {
    fetchAllStops()
      .then(setStops)
      .catch((err) => setError(err.message ?? "No se pudieron cargar las paradas"))
      .finally(() => setLoading(false));
  }, []);

  const filteredStops = useMemo(() => {
    if (selectedAmenities.length === 0) return stops;
    // Cualquiera de los servicios seleccionados, no todos a la vez —
    // exigir todos hacía casi imposible obtener resultados.
    return stops.filter((stop) =>
      selectedAmenities.some((a) => stop.amenities.includes(a)),
    );
  }, [stops, selectedAmenities]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Explora las paradas</h1>
        <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--color-coral-50)] p-3 text-sm text-[var(--color-coral-600)]">
          No se pudieron cargar las paradas: {error}. ¿Has conectado Supabase?
        </p>
      )}

      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--foreground)]/50">
            Cargando paradas…
          </div>
        ) : (
          <MapClient stops={filteredStops} className="h-full min-h-[60vh] w-full" />
        )}
      </div>

      {!loading && filteredStops.length === 0 && !error && (
        <p className="text-center text-sm text-[var(--foreground)]/60">
          Todavía no hay paradas que coincidan.{" "}
          <Link
            href="/stops/new"
            className="font-medium text-[var(--color-teal-600)] hover:underline"
          >
            Añade la primera
          </Link>
          .
        </p>
      )}
    </div>
  );
}
