"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      className="flex w-full max-w-xl flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end"
    >
      <label className="flex-1 text-sm font-medium text-slate-700">
        From
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Portland, OR"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          required
        />
      </label>

      <label className="flex-1 text-sm font-medium text-slate-700">
        To
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Seattle, WA"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
          required
        />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition hover:bg-blue-700"
      >
        Find stops
      </button>
    </form>
  );
}
