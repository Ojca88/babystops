import { createClient } from "@/lib/supabase/client";
import type { BabyFeatureType } from "@/lib/domain/types";

export interface NewPlaceInput {
  name: string;
  lat: number;
  lng: number;
  category: "food" | "rest" | "baby_needs" | "lodging" | "road_service";
  comment?: string;
}

export interface FeatureUpdateInput {
  placeId: string;
  featureType: BabyFeatureType;
  value: string;
  comment?: string;
}

export interface CommentInput {
  placeId: string;
  comment: string;
}

// Flujo de contribución de comunidad — docs/baby-stops/07-comunidad.md
// Mismo patrón que `createStop` (src/lib/data/fetchStops.ts): inserción
// directa desde cliente, RLS exige user_id = auth.uid().

export async function proposeNewPlace(input: NewPlaceInput, userId: string): Promise<{ placeId: string }> {
  const supabase = createClient();

  const { data: place, error: placeError } = await supabase
    .from("places")
    .insert({
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      category: input.category,
      subcategory: "community",
      status: "needs_review",
    })
    .select("id")
    .single();
  if (placeError) throw placeError;

  const { error: contributionError } = await supabase.from("community_contributions").insert({
    user_id: userId,
    place_id: place.id,
    contribution_type: "NEW_PLACE",
    comment: input.comment,
  });
  if (contributionError) throw contributionError;

  return { placeId: place.id };
}

export async function updateFeature(input: FeatureUpdateInput, userId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("community_contributions").insert({
    user_id: userId,
    place_id: input.placeId,
    contribution_type: "FEATURE_UPDATE",
    feature_type: input.featureType,
    value: input.value,
    comment: input.comment,
  });
  if (error) throw error;
}

export async function addComment(input: CommentInput, userId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("community_contributions").insert({
    user_id: userId,
    place_id: input.placeId,
    contribution_type: "COMMENT",
    comment: input.comment,
  });
  if (error) throw error;
}
