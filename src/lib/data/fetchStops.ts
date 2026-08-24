import { createClient } from "@/lib/supabase/client";
import type { NewStop, Stop } from "./stops";

export async function fetchAllStops(): Promise<Stop[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Stop[];
}

export async function createStop(stop: NewStop, userId: string): Promise<Stop> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stops")
    .insert({ ...stop, created_by: userId })
    .select()
    .single();

  if (error) throw error;
  return data as Stop;
}

// RLS (0001_init.sql) solo permite esto si created_by = auth.uid() del
// usuario autenticado — no hace falta comprobar la propiedad aquí, la base
// de datos ya lo hace y devuelve 0 filas si no eres el dueño.
export async function updateStop(id: string, stop: NewStop): Promise<Stop> {
  const supabase = createClient();
  const { data, error } = await supabase.from("stops").update(stop).eq("id", id).select().single();

  if (error) throw error;
  return data as Stop;
}

export async function deleteStop(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stops").delete().eq("id", id);

  if (error) throw error;
}
