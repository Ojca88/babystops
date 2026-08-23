"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so it can only load on the
// client. next/dynamic with ssr:false is itself only valid inside a
// client component, which is why this thin wrapper exists.
const MapClient = dynamic(() => import("./StopsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default MapClient;
