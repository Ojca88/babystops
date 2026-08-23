import {
  Accessibility,
  Baby,
  FerrisWheel,
  type LucideIcon,
  Milk,
  Sofa,
  Toilet,
  UtensilsCrossed,
} from "lucide-react";

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
  diaper_change: "Cambiador",
  nursing: "Zona de lactancia",
  family_restroom: "Baño familiar",
  food: "Comida",
  playground: "Parque infantil",
  rest_area: "Área de descanso",
  stroller_friendly: "Apto para carritos",
};

export const AMENITY_ICONS: Record<Amenity, LucideIcon> = {
  diaper_change: Baby,
  nursing: Milk,
  family_restroom: Toilet,
  food: UtensilsCrossed,
  playground: FerrisWheel,
  rest_area: Sofa,
  stroller_friendly: Accessibility,
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
