"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-2 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <h1 className="text-xl font-bold text-[var(--foreground)]">Revisa tu email</h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Te hemos enviado un enlace de confirmación a {email}. Haz clic en
            él para terminar de crear tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg shadow-[var(--color-coral-500)]/5 ring-1 ring-black/5"
      >
        <h1 className="text-xl font-bold text-[var(--foreground)]">Regístrate</h1>

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
            minLength={6}
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
          {submitting ? "Registrando…" : "Registrarse"}
        </button>

        <p className="text-center text-sm text-[var(--foreground)]/60">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--color-teal-600)] hover:underline"
          >
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
