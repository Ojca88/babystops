"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import MapClient from "@/components/MapClient";
import AmenityFilter from "@/components/AmenityFilter";
import { createClient } from "@/lib/supabase/client";
import { createStop } from "@/lib/data/fetchStops";
import type { Amenity } from "@/lib/data/stops";
import type { LatLng } from "@/lib/geo";

export default function NewStopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!point) {
      setError("Click the map to set the stop's location.");
      return;
    }
    if (amenities.length === 0) {
      setError("Select at least one amenity.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const stop = await createStop(
        {
          name,
          description: description || undefined,
          address: address || undefined,
          lat: point.lat,
          lng: point.lng,
          amenities,
        },
        user.id,
      );
      router.push(`/stops/${stop.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stop");
      setSubmitting(false);
    }
  }

  if (user === undefined) {
    return <p className="p-4 text-sm text-slate-500">Loading…</p>;
  }

  if (user === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-sm space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Log in to add a stop</h1>
          <p className="text-sm text-slate-600">
            Contributions are tied to your account so you can edit them later.
          </p>
          <a
            href="/login"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Log in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-[50vh] overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <MapClient
          stops={[]}
          onMapClick={setPoint}
          pendingPoint={point}
          className="h-full min-h-[50vh] w-full"
        />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-slate-900">Add a stop</h1>
        <p className="text-sm text-slate-500">
          Click the map to drop a pin at the stop&apos;s location.
        </p>

        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Address (optional)
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Notes (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Amenities</p>
          <AmenityFilter selected={amenities} onChange={setAmenities} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save stop"}
        </button>
      </form>
    </div>
  );
}
