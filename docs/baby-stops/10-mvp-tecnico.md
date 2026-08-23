# Documento 10 — MVP técnico

## Alcance (spec sección 51, aplicado a este repo)

**Imprescindible para el MVP:**

- Ruta Alicante ↔ Madrid (corredor único, doc. 8).
- Ingesta Google Places + OSM (doc. 3).
- Cálculo de desvío por lugar (doc. 2, `place_routes`).
- Perfil Baby por lugar + Baby Score (docs. 5-6).
- Filtros básicos (spec sección 20: trona, cambiador, carrito, baño,
  parking, tipo de desvío).
- Detalle del lugar con fuentes y evidencias (spec secciones 24-25).
- Enlaces a Google Maps / Waze (spec sección 48 — deep links, sin SDK).
- Aportaciones de comunidad: nuevo sitio, confirmar/corregir característica
  (doc. 7) — ya hay precedente en el repo (`stops/new`, ahora autenticado
  con Google vía el login que ya se migró).
- Guardar lugares (listas, spec sección 46).

**No imprescindible en esta fase** (se deja fuera explícitamente, igual que
pide el spec sección 51): gamificación avanzada más allá del contador de
reputación simple del doc. 7, chat, notificaciones, recomendaciones
personalizadas complejas más allá del perfil de edad (doc. 5), monetización,
perfiles sociales/seguidores, rankings de usuarios, subida de fotos (se deja
el modelo de datos listo — tabla `photos` — pero la UI de subida no es parte
de este MVP), scraping de web oficial vía LLM completo (empieza solo con el
paso de reglas del doc. 3; el paso LLM se activa si la Fase 1 muestra que
hace falta).

## Estructura de archivos propuesta

Se extiende el repo actual (Next.js App Router + Supabase, ya con Auth de
Google) en vez de crear un proyecto nuevo:

```
src/
  lib/
    supabase/            # ya existe — sin cambios
    sources/             # NUEVO — conectores de ingesta (doc. 1, 3)
      google-places.ts
      osm.ts
      official-website.ts
      reviews-nlp.ts
      types.ts           # RawEvidence, tipos compartidos
    resolution/          # NUEVO — motor de resolución (doc. 6)
      resolve-feature.ts
      config.ts          # pesos, umbrales, decaimiento — doc. 6
    scoring/             # NUEVO — Baby Score (doc. 5)
      baby-score.ts
      age-profiles.ts
    ai/                  # NUEVO
      extract-baby-features.ts   # único punto de entrada al LLM (doc. 1)
    data/
      stops.ts           # existente — se sustituye por places.ts (ver migración)
      places.ts          # NUEVO — reemplaza stops.ts
  app/
    login/, signup/...   # sin cambios (ya migrado a Google OAuth)
    stops/                # renombrar progresivamente a /places (ver nota)
    routes/
      new/page.tsx        # NUEVO — "¿Dónde vas?" (spec sección 21)
      [id]/page.tsx        # NUEVO — resultados de ruta (spec sección 22)
    places/
      [id]/page.tsx        # detalle de lugar (spec secciones 23-25)
    api/
      cron/refresh-stale/route.ts   # NUEVO — refresco priorizado (doc. 6, 9)
scripts/
  ingest-corridor.ts      # NUEVO — pipeline de ingesta ejecutable a mano (doc. 8)
supabase/
  migrations/
    0002_baby_stops_model.sql   # NUEVO — esquema del doc. 2
docs/
  baby-stops/             # estos 10 documentos
```

**Nota sobre `/stops` → `/places`:** no se renombra en el mismo cambio que
introduce el modelo de datos, para no romper enlaces existentes de golpe;
se propone mantener `/stops/*` como alias/redirect a `/places/*` durante una
migración, y decidir el nombre definitivo de cara al usuario (¿"paradas" o
"sitios"?) como parte del diseño de UI, no de este documento técnico.

## Capa de datos (contribución — spec secciones 26-30)

```ts
// src/lib/data/places.ts
export async function proposeNewPlace(input: NewPlaceInput, userId: string): Promise<{ placeId: string }> { ... }
export async function updateFeature(input: FeatureUpdateInput, userId: string): Promise<void> { ... }
export async function addComment(input: CommentInput, userId: string): Promise<void> { ... }
```

Mismo patrón que ya usa el repo para `stops` (`createStop` en
`src/lib/data/fetchStops.ts`): `"use client"` + `createClient()` del
navegador, con RLS (no Server Actions) como barrera de autorización — el
`insert` solo prospera si `user_id = auth.uid()`, igual que ya hace
`stops.created_by`. No se introduce un patrón nuevo.

## Script de ingesta (Fase 0/1 del doc. 8)

`scripts/ingest-corridor.ts`, ejecutado con `SUPABASE_SERVICE_ROLE_KEY`
(bypassa RLS por diseño — es el único proceso autorizado a escribir en
`places`/`baby_features`/`evidence` directamente, según el doc. 2):

```ts
async function ingestCorridor(origin: string, destination: string) {
  const route = await computeRoute(originPoint, destinationPoint); // OSRM, ya integrado en el repo
  const candidates = await discoverPlaces(route);                  // Google Places + OSM (doc. 3)
  const deduped = dedupePlaces(candidates);                        // doc. 7
  for (const place of deduped) {
    const evidence = await gatherEvidence(place);                  // doc. 3, todas las fuentes
    await persistEvidence(place, evidence);                        // service role, tabla evidence
    await resolveAndScoreFeatures(place.id);                       // doc. 6 + doc. 5
  }
  await persistRoute(route, deduped);                              // routes + place_routes
}
```

No corre en una petición HTTP de usuario — es un script de Node invocado
manualmente durante el POC (`npx tsx scripts/ingest-corridor.ts "Alicante"
"Madrid"`) y, más adelante, por el cron de refresco.

## Cron de refresco (doc. 6, priorización por antigüedad)

`app/api/cron/refresh-stale/route.ts` (Vercel Cron), semanal:

```sql
select id from places p
join baby_features bf on bf.place_id = p.id
where bf.status = 'CONFIRMED' and bf.last_verified_at < now() - interval '12 months'
order by bf.last_verified_at asc
limit 50; -- control de coste explícito, doc. 9
```

Re-ejecuta el pipeline de ingesta solo sobre esos lugares, no sobre todo el
dataset.

## Variables de entorno nuevas

| Variable | Server-only | Uso |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | sí | Places API (New) — routing/geocoding usan OSRM/Nominatim, sin key |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | script de ingesta + cron (bypassa RLS) |
| `ANTHROPIC_API_KEY` (o Vercel AI Gateway) | sí | extracción de características (doc. 3) |

Ninguna lleva prefijo `NEXT_PUBLIC_` — todas se usan exclusivamente en
scripts/Server Actions/rutas API, nunca en código de cliente.

## Orden de implementación recomendado

1. Migración `0002_baby_stops_model.sql` (doc. 2) + migración de datos desde
   `stops`.
2. `lib/sources/*` con fixtures (sin llamar a APIs reales todavía) + tests.
3. `lib/resolution/*` y `lib/scoring/*` — son funciones puras, se testean
   sin red antes de conectar nada externo.
4. `scripts/ingest-corridor.ts` conectado a Google/OSM reales → ejecutar
   Fase 0 del doc. 8 con 20-30 lugares.
5. UI de resultados de ruta + detalle de lugar, leyendo lo ya ingerido.
6. Server Actions de contribución (doc. 7).
7. Cron de refresco.

Este orden sigue la prioridad que pide el spec en su cierre (sección 58):
datos → fuentes → arquitectura → extracción → evidencias → IA → scoring →
comunidad → API → UI. La UI es lo último porque no hay nada que enseñar de
forma honesta hasta que el resto del pipeline produce datos reales — enseñar
UI con datos de ejemplo antes de validar la Fase 0 sería construir sobre un
supuesto no verificado.
