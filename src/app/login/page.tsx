"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg shadow-[var(--color-coral-500)]/5 ring-1 ring-black/5"
      >
        <h1 className="text-xl font-bold text-[var(--foreground)]">Entrar</h1>

        <label className="block text-sm font-medium text-[var(--foreground)]/70">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 focus:border-[var(--color-coral-500)] focus:outline-none"
          />
        </label>

        <label className="block text-sm font-medium text-[var(--foreground)]/70">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 focus:border-[var(--color-coral-500)] focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-[var(--color-coral-600)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[var(--color-coral-500)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--color-coral-600)] disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>

        <p className="text-center text-sm text-[var(--foreground)]/60">
          ¿No tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--color-teal-600)] hover:underline"
          >
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}
