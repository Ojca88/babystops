import Link from "next/link";
import TripSearchForm from "@/components/TripSearchForm";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Road trips, sorted for tiny humans.
        </h1>
        <p className="mx-auto max-w-xl text-lg text-slate-600">
          Find diaper-change tables, nursing spots, and rest stops along your
          route — crowdsourced by parents who&apos;ve been there.
        </p>
      </div>

      <TripSearchForm />

      <p className="text-sm text-slate-500">
        Just exploring?{" "}
        <Link href="/map" className="font-medium text-blue-600 hover:underline">
          Browse the full map
        </Link>
      </p>
    </div>
  );
}
