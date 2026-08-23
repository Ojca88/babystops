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
