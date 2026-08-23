"use client";

import { AMENITIES, AMENITY_ICONS, AMENITY_LABELS, type Amenity } from "@/lib/data/stops";

interface AmenityFilterProps {
  selected: Amenity[];
  onChange: (amenities: Amenity[]) => void;
}

export default function AmenityFilter({ selected, onChange }: AmenityFilterProps) {
  function toggle(amenity: Amenity) {
    if (selected.includes(amenity)) {
      onChange(selected.filter((a) => a !== amenity));
    } else {
      onChange([...selected, amenity]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {AMENITIES.map((amenity) => {
        const active = selected.includes(amenity);
        const Icon = AMENITY_ICONS[amenity];
        return (
          <button
            key={amenity}
            type="button"
            onClick={() => toggle(amenity)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border-[var(--color-coral-500)] bg-[var(--color-coral-500)] text-white shadow-sm"
                : "border-black/10 bg-white text-[var(--foreground)]/70 hover:border-[var(--color-coral-400)]"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
            {AMENITY_LABELS[amenity]}
          </button>
        );
      })}
    </div>
  );
}
