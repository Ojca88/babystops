import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPlaceDetails, mapPlaceDetailsToEvidence } from "@/lib/sources/google-places";
import { persistEvidence } from "@/lib/resolution/persist";

const STALE_AFTER_MONTHS = 12;
const BATCH_SIZE = 50; // control de coste explícito — docs/baby-stops/09-estimacion-costes.md

// Refresco priorizado por antigüedad, no re-ingesta completa —
// docs/baby-stops/06-evidencias-confianza.md, 10-mvp-tecnico.md
// Configurar en Vercel Cron (vercel.json) con una cadencia semanal.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const staleBefore = new Date();
  staleBefore.setMonth(staleBefore.getMonth() - STALE_AFTER_MONTHS);

  const { data: staleFeatures, error } = await supabase
    .from("baby_features")
    .select("place_id, places(google_place_id)")
    .eq("status", "CONFIRMED")
    .lt("last_verified_at", staleBefore.toISOString())
    .order("last_verified_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  let refreshed = 0;

  for (const row of staleFeatures ?? []) {
    const googlePlaceId = (row as { places?: { google_place_id?: string } }).places?.google_place_id;
    if (!googlePlaceId) continue;

    const details = await getPlaceDetails(googlePlaceId);
    const evidence = mapPlaceDetailsToEvidence(details, now);
    await persistEvidence(supabase, row.place_id, googlePlaceId, evidence);
    refreshed++;
  }

  return NextResponse.json({ candidates: staleFeatures?.length ?? 0, refreshed });
}
