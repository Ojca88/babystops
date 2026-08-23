"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function TripSearchForm() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!from.trim() || !to.trim()) return;
    const params = new URLSearchParams({ from, to });
    router.push(`/trip?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl flex-col gap-3 rounded-2xl bg-white p-5 shadow-lg shadow-[var(--color-coral-500)]/5 ring-1 ring-black/5 sm:flex-row sm:items-end"
    >
      <label className="flex-1 text-left text-sm font-medium text-[var(--foreground)]/70">
        Origen
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Madrid"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-base focus:border-[var(--color-coral-500)] focus:outline-none"
          required
        />
      </label>

      <label className="flex-1 text-left text-sm font-medium text-[var(--foreground)]/70">
        Destino
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Valencia"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-base focus:border-[var(--color-coral-500)] focus:outline-none"
          required
        />
      </label>

      <button
        type="submit"
        className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-coral-500)] px-5 py-2 font-semibold text-white transition hover:bg-[var(--color-coral-600)]"
      >
        <Search className="h-4 w-4" strokeWidth={2.5} />
        Buscar paradas
      </button>
    </form>
  );
}
