"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import StopForm from "@/components/StopForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { updateStop } from "@/lib/data/fetchStops";
import type { NewStop, Stop } from "@/lib/data/stops";

type StopState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "ready"; stop: Stop };

export default function EditStopPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null | undefined>(() =>
    isSupabaseConfigured() ? undefined : null,
  );
  const [stopState, setStopState] = useState<StopState>({ status: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return; // no logueado, o auth aún resolviendo — nada que cargar todavía

    const supabase = createClient();
    supabase
      .from("stops")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setStopState({ status: "not-found" });
          return;
        }
        const stop = data as Stop;
        setStopState(stop.created_by === user.id ? { status: "ready", stop } : { status: "forbidden" });
      });
  }, [user, params.id]);

  async function handleSubmit(stop: NewStop) {
    await updateStop(params.id, stop);
    router.push(`/stops/${params.id}`);
  }

  if (user === undefined) {
    return <p className="p-4 text-sm text-[var(--foreground)]/50">Cargando…</p>;
  }

  if (user === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-sm space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <h1 className="text-xl font-bold text-[var(--foreground)]">Inicia sesión para editar</h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Solo la cuenta que creó esta parada puede editarla.
          </p>
        </div>
      </div>
    );
  }

  if (stopState.status === "loading") {
    return <p className="p-4 text-sm text-[var(--foreground)]/50">Cargando…</p>;
  }

  if (stopState.status === "forbidden") {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="max-w-sm rounded-2xl bg-white p-6 text-center text-sm text-[var(--foreground)]/60 shadow-sm ring-1 ring-black/5">
          Solo quien creó esta parada puede editarla.
        </p>
      </div>
    );
  }

  if (stopState.status === "not-found") {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="rounded-2xl bg-white p-6 text-sm text-[var(--foreground)]/60 shadow-sm ring-1 ring-black/5">
          No se ha encontrado esta parada.
        </p>
      </div>
    );
  }

  const { stop } = stopState;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-4 text-xl font-bold text-[var(--foreground)]">Editar parada</h1>
      <StopForm
        initialValues={{
          name: stop.name,
          description: stop.description ?? "",
          address: stop.address ?? "",
          amenities: stop.amenities,
          point: { lat: stop.lat, lng: stop.lng },
        }}
        submitLabel="Guardar cambios"
        submittingLabel="Guardando…"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
