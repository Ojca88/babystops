export const AMENITIES = [
  "diaper_change",
  "nursing",
  "family_restroom",
  "food",
  "playground",
  "rest_area",
  "stroller_friendly",
] as const;

export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  diaper_change: "Diaper change",
  nursing: "Nursing area",
  family_restroom: "Family restroom",
  food: "Food",
  playground: "Playground",
  rest_area: "Rest area",
  stroller_friendly: "Stroller friendly",
};

export const AMENITY_ICONS: Record<Amenity, string> = {
  diaper_change: "🧷",
  nursing: "🍼",
  family_restroom: "🚻",
  food: "🍽️",
  playground: "🛝",
  rest_area: "🛋️",
  stroller_friendly: "🧸",
};

export interface Stop {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  amenities: Amenity[];
  created_by: string | null;
  created_at: string;
}

export interface NewStop {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  amenities: Amenity[];
}
