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
        return (
          <button
            key={amenity}
            type="button"
            onClick={() => toggle(amenity)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-400"
            }`}
          >
            <span className="mr-1">{AMENITY_ICONS[amenity]}</span>
            {AMENITY_LABELS[amenity]}
          </button>
        );
      })}
    </div>
  );
}
