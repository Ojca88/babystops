import { notFound } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AMENITY_ICONS, AMENITY_LABELS, type Stop } from "@/lib/data/stops";
import MapClient from "@/components/MapClient";

export default async function StopDetailPage({
  params,
}: PageProps<"/stops/[id]">) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="rounded-2xl bg-white/80 p-6 text-center text-sm text-[var(--foreground)]/70 shadow-sm ring-1 ring-black/5">
          Supabase todavía no está configurado, así que no podemos mostrar
          esta parada.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: stop, error } = await supabase
    .from("stops")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !stop) notFound();

  const typedStop = stop as Stop;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-h-[50vh] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
        <MapClient
          stops={[typedStop]}
          center={{ lat: typedStop.lat, lng: typedStop.lng }}
          className="h-full min-h-[50vh] w-full"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{typedStop.name}</h1>
        {typedStop.address && (
          <p className="text-[var(--foreground)]/60">{typedStop.address}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {typedStop.amenities.map((a) => {
            const Icon = AMENITY_ICONS[a];
            return (
              <span
                key={a}
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-teal-50)] px-3 py-1 text-sm font-medium text-[var(--color-teal-900)]"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {AMENITY_LABELS[a]}
              </span>
            );
          })}
        </div>

        {typedStop.description && (
          <p className="whitespace-pre-wrap text-[var(--foreground)]/80">
            {typedStop.description}
          </p>
        )}

        <p className="text-xs text-[var(--foreground)]/40">
          Añadida el {new Date(typedStop.created_at).toLocaleDateString("es-ES")}
        </p>
      </div>
    </div>
  );
}
