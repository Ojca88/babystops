import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PlaceSummaryRow } from "@/lib/data/places";
import PlacesWithBabyScore from "@/components/PlacesWithBabyScore";

export default async function LugaresPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="rounded-2xl bg-white/80 p-6 text-center text-sm text-[var(--foreground)]/70 shadow-sm ring-1 ring-black/5">
          Supabase todavía no está configurado, así que no podemos mostrar
          los lugares.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("place_summary")
    .select("id, name, category, lat, lng, address, features")
    .in("status", ["active", "needs_review"])
    .order("name");

  if (error) throw error;
  const places = (data ?? []) as PlaceSummaryRow[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-1 text-2xl font-bold text-[var(--foreground)]">Lugares</h1>
      <p className="mb-4 text-sm text-[var(--foreground)]/60">
        Ordenados por Baby Score según la edad de tu bebé — datos recogidos
        por el pipeline de ingesta.
      </p>
      <PlacesWithBabyScore places={places} />
    </div>
  );
}
