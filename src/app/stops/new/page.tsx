"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import MapClient from "@/components/MapClient";
import AmenityFilter from "@/components/AmenityFilter";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { createStop } from "@/lib/data/fetchStops";
import type { Amenity } from "@/lib/data/stops";
import type { LatLng } from "@/lib/geo";

export default function NewStopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(() =>
    isSupabaseConfigured() ? undefined : null,
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!point) {
      setError("Toca el mapa para marcar la ubicación de la parada.");
      return;
    }
    if (amenities.length === 0) {
      setError("Selecciona al menos un servicio.");
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
      setError(err instanceof Error ? err.message : "No se pudo guardar la parada");
      setSubmitting(false);
    }
  }

  if (user === undefined) {
    return <p className="p-4 text-sm text-[var(--foreground)]/50">Cargando…</p>;
  }

  if (user === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-sm space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Inicia sesión para añadir una parada
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Las aportaciones quedan ligadas a tu cuenta para que puedas
            editarlas más adelante.
          </p>
          <a
            href="/login"
            className="mt-2 inline-block rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-medium text-white hover:bg-[var(--color-coral-600)]"
          >
            Entrar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-[50vh] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
        <MapClient
          stops={[]}
          onMapClick={setPoint}
          pendingPoint={point}
          className="h-full min-h-[50vh] w-full"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5"
      >
        <h1 className="text-xl font-bold text-[var(--foreground)]">Añadir una parada</h1>
        <p className="text-sm text-[var(--foreground)]/60">
          Toca el mapa para colocar un pin en la ubicación de la parada.
        </p>

        <label className="block text-sm font-medium text-[var(--foreground)]/70">
          Nombre
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 focus:border-[var(--color-coral-500)] focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--foreground)]/70">
          Dirección (opcional)
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 focus:border-[var(--color-coral-500)] focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--foreground)]/70">
          Notas (opcional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 focus:border-[var(--color-coral-500)] focus:outline-none"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-medium text-[var(--foreground)]/70">Servicios</p>
          <AmenityFilter selected={amenities} onChange={setAmenities} />
        </div>

        {error && <p className="text-sm text-[var(--color-coral-600)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-coral-600)] disabled:opacity-60"
        >
          {submitting ? "Guardando…" : "Guardar parada"}
        </button>
      </form>
    </div>
  );
}
