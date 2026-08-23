import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blob text-white shadow-sm">
        <MapPinOff className="h-8 w-8" strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        No hemos encontrado esta página
      </h1>
      <p className="max-w-sm text-sm text-[var(--foreground)]/60">
        Puede que el enlace esté roto o que la parada ya no exista.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-coral-600)]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
