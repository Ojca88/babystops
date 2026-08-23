import Link from "next/link";
import { Baby, Milk, Sofa } from "lucide-react";
import TripSearchForm from "@/components/TripSearchForm";

export default function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-16 text-center sm:py-24">
      <div
        aria-hidden
        className="bg-blob absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl sm:h-96 sm:w-96"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[var(--color-teal-400)] opacity-20 blur-3xl sm:h-96 sm:w-96"
      />

      <div className="relative flex w-full flex-col items-center gap-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-[var(--color-coral-600)] shadow-sm ring-1 ring-black/5">
          <Baby className="h-4 w-4" strokeWidth={2.5} />
          Hecho por y para familias viajeras
        </span>

        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-6xl">
            Viajes por carretera,{" "}
            <span className="bg-gradient-to-r from-[var(--color-coral-500)] to-[var(--color-amber-500)] bg-clip-text text-transparent">
              a prueba de peques
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-[var(--foreground)]/70">
            Encuentra cambiadores, zonas de lactancia y áreas de descanso en
            tu ruta — recomendadas por familias que ya han pasado por ahí.
          </p>
        </div>

        <TripSearchForm />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--foreground)]/60">
          <span className="flex items-center gap-1.5">
            <Milk className="h-4 w-4 text-[var(--color-teal-600)]" /> Lactancia
          </span>
          <span className="flex items-center gap-1.5">
            <Baby className="h-4 w-4 text-[var(--color-coral-600)]" /> Cambiadores
          </span>
          <span className="flex items-center gap-1.5">
            <Sofa className="h-4 w-4 text-[var(--color-amber-500)]" /> Descanso
          </span>
        </div>

        <p className="text-sm text-[var(--foreground)]/60">
          ¿Solo estás curioseando?{" "}
          <Link
            href="/map"
            className="font-semibold text-[var(--color-teal-600)] hover:underline"
          >
            Explora el mapa completo
          </Link>
        </p>
      </div>
    </div>
  );
}
