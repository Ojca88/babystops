import Link from "next/link";
import { Map, MapPinned, Plus } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  let user = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-extrabold text-[var(--foreground)] sm:text-lg"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blob text-white shadow-sm">
            <MapPinned className="h-4.5 w-4.5" strokeWidth={2.5} />
          </span>
          <span className="truncate">babystops</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link
            href="/map"
            aria-label="Ver mapa"
            className="flex items-center gap-1.5 rounded-full p-2 font-medium text-[var(--foreground)]/70 transition hover:bg-black/5 hover:text-[var(--color-coral-600)] sm:p-0 sm:hover:bg-transparent"
          >
            <Map className="h-5 w-5 sm:hidden" strokeWidth={2.25} />
            <span className="hidden sm:inline">Ver mapa</span>
          </Link>
          <Link
            href="/stops/new"
            aria-label="Añadir parada"
            className="flex items-center gap-1.5 rounded-full bg-[var(--color-coral-500)] p-2.5 font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-600)] sm:px-3.5 sm:py-1.5"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Añadir parada</span>
          </Link>

          {user ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="shrink-0 font-medium text-[var(--color-teal-600)] hover:underline"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
