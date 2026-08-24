"use client";

import { useState } from "react";
import MapClient from "@/components/MapClient";
import AmenityFilter from "@/components/AmenityFilter";
import type { Amenity, NewStop } from "@/lib/data/stops";
import type { LatLng } from "@/lib/geo";

export interface StopFormInitialValues {
  name: string;
  description: string;
  address: string;
  amenities: Amenity[];
  point: LatLng;
}

interface StopFormProps {
  initialValues?: StopFormInitialValues;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (stop: NewStop) => Promise<void>;
}

// Compartido entre /stops/new y /stops/[id]/edit — misma validación, mismos
// campos, distinto destino (crear vs. actualizar) que decide quien lo usa.
export default function StopForm({ initialValues, submitLabel, submittingLabel, onSubmit }: StopFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [amenities, setAmenities] = useState<Amenity[]>(initialValues?.amenities ?? []);
  const [point, setPoint] = useState<LatLng | null>(initialValues?.point ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await onSubmit({
        name,
        description: description || undefined,
        address: address || undefined,
        amenities,
        lat: point.lat,
        lng: point.lng,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la parada");
      setSubmitting(false);
    }
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
          {submitting ? submittingLabel : submitLabel}
        </button>
      </form>
    </div>
  );
}
