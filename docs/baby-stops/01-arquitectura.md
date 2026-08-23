# Documento 1 — Arquitectura propuesta

## Principio rector

El spec lo dice explícitamente (sección 44): **datos estructurados primero,
reglas después, IA solo cuando hace falta interpretar texto libre.** Toda la
arquitectura se organiza para que esto sea fácil de cumplir y difícil de
saltarse por accidente.

## Vista general

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FUENTES EXTERNAS                             │
│  Google Places API   OpenStreetMap/Overpass   Web oficial   Reviews │
└───────────┬───────────────────┬────────────────────┬────────┬──────┘
            │                   │                    │        │
            ▼                   ▼                    ▼        ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    CAPA DE INGESTA (server-only)             │
     │  - Un "conector" por fuente (aislado, testeable)              │
     │  - Cada conector devuelve Evidence[], nunca escribe           │
     │    directamente el valor "resuelto" de una característica    │
     └───────────────────────────┬────────────────────────────────┘
                                  ▼
     ┌─────────────────────────────────────────────────────────────┐
     │              MOTOR DE RESOLUCIÓN (reglas + confianza)         │
     │  - Combina Evidence[] de todas las fuentes por característica │
     │  - Aplica pesos, antigüedad y contradicciones (doc. 6)        │
     │  - Solo llama al LLM cuando la evidencia es texto libre       │
     │    sin señal estructurada (doc. 3 / doc. 4)                   │
     └───────────────────────────┬────────────────────────────────┘
                                  ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                  POSTGRES (Supabase)                          │
     │  places · routes · place_routes · baby_features · evidence   │
     │  community_contributions · photos · profiles · saved_*       │
     └───────────────────────────┬────────────────────────────────┘
                                  ▼
     ┌─────────────────────────────────────────────────────────────┐
     │            NEXT.JS APP ROUTER (Vercel)                        │
     │  Server Components (lectura) · Server Actions (contribución)  │
     │  API routes solo para webhooks/cron de refresco               │
     └─────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Conectores de fuente (`lib/sources/*`)

Un módulo por fuente externa, cada uno con la misma forma de salida:

```ts
interface RawEvidence {
  placeRef: { googlePlaceId?: string; osmId?: string };
  featureType: BabyFeatureType | null; // null = evidencia general (ej. reseña sin mapear a una feature)
  source: "GOOGLE_PLACES" | "OSM" | "OFFICIAL_WEBSITE" | "REVIEW_NLP" | "COMMUNITY" | "AI_INFERENCE";
  sourceReference: string; // place_id, osm_id, url, id de contribución...
  rawValue: string;
  detectedAt: string;
}
```

- `lib/sources/google-places.ts` — Text Search / Nearby Search para descubrir
  lugares, Place Details para atributos estructurados.
- `lib/sources/osm.ts` — consultas Overpass por bounding box/corredor,
  traducción de tags OSM a `featureType`.
- `lib/sources/official-website.ts` — fetch + extracción (reglas simples de
  keyword primero; LLM solo si el HTML no tiene señales claras).
- `lib/sources/reviews-nlp.ts` — pasa las (máx. 5) reseñas de Google por un
  prompt de extracción estructurada (ver doc. 3).

Ningún conector escribe en `baby_features`. Todos escriben filas en
`evidence`. Esto es la separación más importante de todo el sistema: permite
recalcular el "valor resuelto" sin volver a llamar a las APIs externas.

### 2. Motor de resolución (`lib/resolution/*`)

Job (o función invocada tras la ingesta) que, por cada `(place_id,
feature_type)` con evidencia nueva, recalcula `baby_features.value`,
`confidence_score` y `status` según el algoritmo del doc. 6. Es puro:
entrada = filas de `evidence`, salida = una fila de `baby_features`. Fácil de
testear con fixtures, sin llamadas de red.

### 3. Base de datos — Supabase (Postgres)

Se mantiene Supabase (ya provisionado en este repo, con Auth ya migrado a
Google OAuth). El esquema crece de forma importante respecto al `stops`
actual — ver doc. 2. RLS sigue siendo la barrera de autorización para todo lo
que toca `community_contributions`, `photos` y `saved_*`; las tablas
"externas" (`places`, `baby_features`, `evidence`) son de lectura pública y
escritura solo por el backend (service role), nunca desde el cliente.

### 4. Aplicación — Next.js App Router en Vercel

Se mantiene el stack actual:

- **Server Components** para todo lo que es lectura (resultados de ruta,
  detalle de parada, evidencias) — no hay razón para exponer esto como API
  pública todavía.
- **Server Actions** para contribuciones de comunidad (añadir sitio,
  confirmar característica, subir foto) — mismo patrón que ya usa el
  formulario de `stops/new`.
- **Rutas API** (`app/api/*`) reservadas para: (a) cron de refresco de datos
  (Vercel Cron), (b) webhook si en el futuro se necesita recibir eventos
  externos. No se expone la ingesta como API pública en el MVP.
- **Ingesta y motor de resolución corren como scripts server-side** (Node,
  ejecutados manualmente o por cron), **no** dentro de una petición HTTP de
  usuario — son procesos de minutos/horas, no de segundos.

### 5. IA

Un único punto de entrada `lib/ai/extract-baby-features.ts` que:

- Recibe texto libre (reseñas, extracto de web) + el conjunto de
  `featureType` candidatos.
- Devuelve extracción estructurada (`output_config.format` / structured
  outputs de la API de Claude, no parsing manual de JSON en texto libre).
- Se llama **solo** cuando no hay señal estructurada de Google/OSM para esa
  característica en ese lugar (regla, no excepción — ver doc. 3 y doc. 4
  sección "Cuándo NO llamar al LLM").

### 6. Mapas y rutas

- **Routing:** el repo ya tiene un proxy propio de OSRM sin coste ni API key
  (`src/app/api/directions/route.ts`), usado hoy por la búsqueda de viaje.
  Se reutiliza para calcular geometría, distancia y duración
  Alicante↔Madrid — no hace falta Google Routes API para esto.
- **Geocoding:** igualmente, `src/app/api/geocode/route.ts` ya envuelve
  Nominatim (OSM) — se reutiliza para resolver "Alicante"/"Madrid" a
  coordenadas.
- **Mapa de visualización:** se mantiene el stack actual del repo
  (`react-leaflet` + OpenStreetMap tiles, visto en `MapClient.tsx`).
- Google Maps Platform queda reducido a **solo Places API** — la única
  pieza que OSM no puede sustituir (categorización rica, ratings, reseñas,
  horarios). Esto simplifica el punto 1 del doc. 8 (bloqueos): un único
  API a habilitar en Google Cloud, no dos.

## Por qué esta arquitectura y no otra

- **No un microservicio de "scraping" separado**: con el volumen del MVP
  (cientos, no millones, de lugares) un monolito Next.js + scripts
  server-side es más simple de operar y de razonar que una cola de
  mensajes/workers distribuidos. Se revisita si el volumen crece 2-3 órdenes
  de magnitud (ver doc. 9, sección "Cuándo migrar").
- **Postgres, no un grafo o un vector store como fuente primaria**: el
  dominio es relacional (lugares, rutas, características, evidencias) con
  necesidades de filtrado exacto (RLS, `amenities @> ARRAY[...]`). No hay
  todavía un caso de uso que justifique una base vectorial (búsqueda
  semántica de reseñas podría añadirse después con `pgvector`, ya soportado
  por Supabase, sin cambiar de motor).
- **Evidence-first, no "un campo booleano por característica"**: es la única
  forma de cumplir simultáneamente los requisitos de trazabilidad (doc. 6),
  no perder información al contradecirse fuentes, y no violar las políticas
  de caché de Google (doc. 4) — si mañana Google cambia sus términos y hay
  que purgar su contenido, basta con borrar `evidence WHERE source =
  'GOOGLE_PLACES'` y recalcular; con un modelo "campo único" esa purga sería
  imposible de aislar.

## Qué NO se construye en el MVP (y por qué)

- **Pipeline de reentrenamiento de modelos propios**: no hace falta, un LLM
  de propósito general con extracción estructurada resuelve el caso de uso
  del spec (sección 44).
- **Servicio de geocoding propio**: se usa el que ya viene con Places/Routes.
- **CDN de imágenes propio**: Supabase Storage cubre las fotos de comunidad
  para el volumen del MVP.
