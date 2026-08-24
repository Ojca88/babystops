"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import StopForm from "@/components/StopForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { createStop } from "@/lib/data/fetchStops";
import type { NewStop } from "@/lib/data/stops";

export default function NewStopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(() =>
    isSupabaseConfigured() ? undefined : null,
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSubmit(stop: NewStop) {
    if (!user) return;
    const created = await createStop(stop, user.id);
    router.push(`/stops/${created.id}`);
  }

  if (user === undefined) {
    return <p className="p-4 text-sm text-[var(--foreground)]/50">Cargando…</p>;
  }

  if (user === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-sm space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Inicia sesión para añadir una parada
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Las aportaciones quedan ligadas a tu cuenta para que puedas
            editarlas más adelante.
          </p>
          <a
            href="/login"
            className="mt-2 inline-block rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-medium text-white hover:bg-[var(--color-coral-600)]"
          >
            Entrar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-4 text-xl font-bold text-[var(--foreground)]">Añadir una parada</h1>
      <StopForm submitLabel="Guardar parada" submittingLabel="Guardando…" onSubmit={handleSubmit} />
    </div>
  );
}
