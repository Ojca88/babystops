"use client";

import { useMemo, useState } from "react";
import { AGE_PROFILES, calculateBabyScore } from "@/lib/scoring/baby-score";
import { placeSummaryToFeatureMap } from "@/lib/scoring/place-summary-to-feature-map";
import type { PlaceSummaryRow } from "@/lib/data/places";

type AgeKey = keyof typeof AGE_PROFILES;

const AGE_OPTIONS: { key: AgeKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "0-6", label: "0-6 meses" },
  { key: "6-12", label: "6-12 meses" },
  { key: "1-2", label: "1-2 años" },
  { key: "2-4", label: "2-4 años" },
];

const COMPONENT_LABELS: Record<string, string> = {
  food: "Alimentación",
  hygiene: "Higiene",
  stroller: "Carrito",
  entertainment: "Entretenimiento",
  car: "Coche",
  evidence: "Fiabilidad",
};

const FEATURE_LABELS: Partial<Record<string, string>> = {
  highchair: "Trona",
  changing_table: "Cambiador",
  family_restroom: "Baño familiar",
  accessible_restroom: "Baño accesible",
  kids_menu: "Menú infantil",
  baby_food_options: "Comida para bebé",
  warm_food: "Calientan comida",
  warm_bottle: "Calientan biberón",
  nursing_space: "Zona de lactancia",
  stroller_access: "Acceso con carrito",
  stroller_space: "Espacio para carrito",
  nearby_playground: "Parque cercano",
  indoor_play_area: "Zona de juegos interior",
  outdoor_play_area: "Zona de juegos exterior",
  space_to_move: "Espacio para moverse",
  parking: "Parking",
  nearby_parking: "Parking cercano",
  free_parking: "Parking gratis",
  terrace: "Terraza",
};

interface Props {
  places: PlaceSummaryRow[];
}

export default function PlacesWithBabyScore({ places }: Props) {
  const [ageKey, setAgeKey] = useState<AgeKey>("general");

  const scored = useMemo(() => {
    const profile = AGE_PROFILES[ageKey];
    return places
      .map((place) => {
        const featureMap = placeSummaryToFeatureMap(place.features);
        const score = calculateBabyScore(featureMap, profile);
        const confirmedFeatures = Object.entries(featureMap)
          .filter(([, f]) => f.status === "CONFIRMED" || f.status === "PROBABLE")
          .map(([key]) => key);
        return { place, score, confirmedFeatures };
      })
      .sort((a, b) => b.score.total - a.score.total);
  }, [places, ageKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Edad del bebé">
        {AGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setAgeKey(opt.key)}
            aria-pressed={ageKey === opt.key}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              ageKey === opt.key
                ? "bg-[var(--color-coral-500)] text-white"
                : "bg-white text-[var(--foreground)]/70 ring-1 ring-black/10 hover:bg-black/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {scored.length === 0 && (
        <p className="rounded-2xl bg-white/70 p-4 text-sm text-[var(--foreground)]/50 shadow-sm ring-1 ring-black/5">
          Todavía no hay lugares con datos.
        </p>
      )}

      <ul className="space-y-3">
        {scored.map(({ place, score, confirmedFeatures }) => (
          <li key={place.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-[var(--foreground)]">{place.name}</h3>
                {place.address && <p className="truncate text-xs text-[var(--foreground)]/50">{place.address}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-teal-100)] px-2.5 py-1 text-sm font-bold text-[var(--color-teal-600)]">
                {score.total}/100
              </span>
            </div>

            {confirmedFeatures.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {confirmedFeatures.map((key) => (
                  <span key={key} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-[var(--foreground)]/70">
                    {FEATURE_LABELS[key] ?? key}
                  </span>
                ))}
              </div>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-[var(--foreground)]/50">Desglose del Baby Score</summary>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--foreground)]/60 sm:grid-cols-3">
                {score.components.map((c) => (
                  <li key={c.component}>
                    {COMPONENT_LABELS[c.component] ?? c.component}: {c.points}/{c.maxPoints}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
