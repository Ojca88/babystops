import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AMENITY_ICONS, AMENITY_LABELS, type Stop } from "@/lib/data/stops";
import MapClient from "@/components/MapClient";

export default async function StopDetailPage({
  params,
}: PageProps<"/stops/[id]">) {
  const { id } = await params;
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
      <div className="min-h-[50vh] overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <MapClient
          stops={[typedStop]}
          center={{ lat: typedStop.lat, lng: typedStop.lng }}
          className="h-full min-h-[50vh] w-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{typedStop.name}</h1>
        {typedStop.address && <p className="text-slate-600">{typedStop.address}</p>}

        <div className="flex flex-wrap gap-2">
          {typedStop.amenities.map((a) => (
            <span
              key={a}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              <span>{AMENITY_ICONS[a]}</span>
              {AMENITY_LABELS[a]}
            </span>
          ))}
        </div>

        {typedStop.description && (
          <p className="whitespace-pre-wrap text-slate-700">{typedStop.description}</p>
        )}

        <p className="text-xs text-slate-400">
          Added {new Date(typedStop.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
