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
      .catch((err) => setError(err.message ?? "Failed to load stops"))
      .finally(() => setLoading(false));
  }, []);

  const filteredStops = useMemo(() => {
    if (selectedAmenities.length === 0) return stops;
    return stops.filter((stop) =>
      selectedAmenities.every((a) => stop.amenities.includes(a)),
    );
  }, [stops, selectedAmenities]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Browse stops</h1>
        <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load stops: {error}. Have you connected Supabase yet?
        </p>
      )}

      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-2xl ring-1 ring-slate-200">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading stops…
          </div>
        ) : (
          <MapClient stops={filteredStops} className="h-full min-h-[60vh] w-full" />
        )}
      </div>

      {!loading && filteredStops.length === 0 && !error && (
        <p className="text-center text-sm text-slate-500">
          No stops match yet.{" "}
          <Link href="/stops/new" className="font-medium text-blue-600 hover:underline">
            Add the first one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
