import Link from "next/link";
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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900">
          🍼 babystops
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/map" className="text-slate-600 hover:text-slate-900">
            Browse map
          </Link>
          <Link href="/stops/new" className="text-slate-600 hover:text-slate-900">
            Add a stop
          </Link>

          {user ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
