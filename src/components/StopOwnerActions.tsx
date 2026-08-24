"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { deleteStop } from "@/lib/data/fetchStops";

interface StopOwnerActionsProps {
  stopId: string;
  createdBy: string | null;
}

// Solo se muestra si el usuario logueado es quien creó la parada — RLS
// (0001_init.sql) ya lo impone en la base de datos, esto es solo la UI.
export default function StopOwnerActions({ stopId, createdBy }: StopOwnerActionsProps) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !createdBy) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsOwner(data.user?.id === createdBy);
    });
  }, [createdBy]);

  if (!isOwner) return null;

  async function handleDelete() {
    if (!confirm("¿Seguro que quieres borrar esta parada? No se puede deshacer.")) return;

    setDeleting(true);
    try {
      await deleteStop(stopId);
      router.push("/map");
      router.refresh();
    } catch {
      setDeleting(false);
      alert("No se ha podido borrar la parada.");
    }
  }

  return (
    <div className="flex gap-2 border-t border-black/5 pt-3">
      <Link
        href={`/stops/${stopId}/edit`}
        className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-[var(--foreground)]/70 transition hover:bg-black/5"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
        Editar
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-coral-500)]/30 px-3 py-1.5 text-sm font-medium text-[var(--color-coral-600)] transition hover:bg-[var(--color-coral-50)] disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        {deleting ? "Borrando…" : "Borrar"}
      </button>
    </div>
  );
}
