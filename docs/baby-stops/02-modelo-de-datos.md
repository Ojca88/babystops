# Documento 2 — Modelo de datos

## Punto de partida: qué hay hoy

El repo ya tiene una tabla `stops` (migración
`supabase/migrations/0001_init.sql`) con un modelo muy simple: nombre,
coordenadas, dirección y un array de `amenity` enum, escrita solo por el
usuario autenticado que la crea. Es el germen de `places` +
`community_contributions`, pero no separa fuentes ni tiene el resto de
entidades del spec (rutas, evidencias, fotos, listas...).

**Propuesta de migración:** no es un `ALTER` incremental razonable — el
modelo cambia de forma (una tabla → diez). Se propone una migración nueva
(`0002_baby_stops_model.sql`) que:

1. Crea el esquema nuevo completo (tablas de abajo).
2. Migra los datos de `stops` a `places` + `community_contributions` (cada
   fila existente de `stops` se convierte en un `place` con
   `source = 'COMMUNITY'` y una `community_contribution` de tipo
   `NEW_PLACE` ya `APPROVED`, preservando `created_by` → `user_id`).
3. Deja `stops` como tabla obsoleta (no se borra en la misma migración, por
   si hace falta revertir; se elimina en una migración posterior una vez
   verificado).

**Esto no se ejecuta en este documento** — es la propuesta para el MVP
técnico (doc. 10), que es donde se escribirá y aplicará la migración real.

## Enums

```sql
create type public.place_category as enum (
  'food', 'rest', 'baby_needs', 'lodging', 'road_service'
);

create type public.place_status as enum (
  'active', 'closed', 'duplicate', 'needs_review'
);

create type public.baby_feature_type as enum (
  'highchair', 'changing_table', 'family_restroom', 'accessible_restroom',
  'kids_menu', 'baby_food_options', 'warm_food', 'warm_bottle',
  'nursing_space', 'stroller_access', 'stroller_space', 'elevator',
  'stairs_required', 'indoor_play_area', 'outdoor_play_area',
  'nearby_playground', 'outdoor_space', 'space_to_move', 'parking',
  'nearby_parking', 'parking_ease', 'free_parking', 'gas_station',
  'terrace', 'quiet_atmosphere', 'pet_friendly', 'accessibility',
  'air_conditioning', 'heating', 'covered_area', 'shade', 'benches',
  'picnic_tables', 'nearby_supermarket', 'nearby_pharmacy',
  'nearby_medical_center'
);

create type public.feature_status as enum (
  'CONFIRMED', 'PROBABLE', 'UNCONFIRMED', 'NOT_AVAILABLE', 'UNKNOWN',
  'NEEDS_REVIEW' -- evidencia contradictoria sin ganador claro (doc. 6)
);

create type public.evidence_source as enum (
  'GOOGLE_PLACES', 'OSM', 'OFFICIAL_WEBSITE', 'REVIEW_NLP', 'COMMUNITY',
  'AI_INFERENCE'
);

create type public.evidence_certainty as enum ('explicit', 'implied');

create type public.contribution_type as enum (
  'NEW_PLACE', 'FEATURE_UPDATE', 'CORRECTION', 'PHOTO', 'COMMENT'
);

create type public.moderation_status as enum (
  'PENDING', 'APPROVED', 'REJECTED', 'CONFLICTING', 'NEEDS_REVIEW'
);
```

## Tablas

```sql
-- PLACE ------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.place_category not null,
  subcategory text not null, -- 'restaurant' | 'service_area' | 'playground' | ... (texto libre validado en la app; ver doc. 3)
  lat double precision not null,
  lng double precision not null,
  address text,
  phone text,
  website text,
  google_place_id text unique,
  osm_id bigint unique,
  google_maps_url text,
  status public.place_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index places_lat_lng_idx on public.places (lat, lng);
create index places_category_idx on public.places (category);

-- ROUTE --------------------------------------------------------------
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  geometry text not null, -- JSON de [{lat,lng}, ...] (puntos de la ruta OSRM — ver doc. 10, ya no Google Routes)
  distance_meters integer not null,
  duration_seconds integer not null,
  created_at timestamptz not null default now()
);

-- PLACE_ROUTE ----------------------------------------------------------
create table public.place_routes (
  place_id uuid not null references public.places (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  distance_to_route_meters numeric not null,
  detour_seconds integer not null,
  position_from_origin_seconds integer not null,
  computed_at timestamptz not null default now(),
  primary key (place_id, route_id)
);
create index place_routes_route_position_idx
  on public.place_routes (route_id, position_from_origin_seconds);

-- BABY_FEATURE (valor resuelto actual) --------------------------------
create table public.baby_features (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  feature_type public.baby_feature_type not null,
  value text not null, -- 'yes' | 'no' | 'limited' | 'unknown' | valor específico del feature
  status public.feature_status not null default 'UNKNOWN',
  confidence_score numeric(5,2) not null default 0 check (confidence_score between 0 and 100),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (place_id, feature_type)
);
create index baby_features_place_idx on public.baby_features (place_id);

-- EVIDENCE (histórico, nunca se sobreescribe) -------------------------
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  feature_type public.baby_feature_type, -- null = evidencia general no mapeada
  source public.evidence_source not null,
  source_reference text not null,
  value text not null, -- valor normalizado: 'yes' | 'no' | 'limited' | valor específico del feature
  raw_value text, -- cita/extracto textual que sustenta la evidencia (solo presente en evidencia derivada de LLM — doc. 3, "¿Por qué decimos esto?")
  certainty public.evidence_certainty not null default 'explicit',
  confidence_weight numeric(5,2) not null,
  detected_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index evidence_place_feature_idx on public.evidence (place_id, feature_type);

-- PROFILES (extiende auth.users) --------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  child_age_months integer,
  reputation_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- COMMUNITY_CONTRIBUTION -----------------------------------------------
create table public.community_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  contribution_type public.contribution_type not null,
  feature_type public.baby_feature_type,
  value text,
  comment text,
  status public.moderation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index community_contributions_place_idx on public.community_contributions (place_id);
create index community_contributions_status_idx on public.community_contributions (status);

-- PHOTO ------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  url text not null,
  category text, -- 'entrance' | 'bathroom' | 'changing_table' | 'kids_area' | 'highchair' | 'parking' | 'terrace' | 'stroller_space'
  moderation_status public.moderation_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

-- SAVED_LIST / SAVED_PLACE ---------------------------------------------
create table public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.saved_places (
  list_id uuid not null references public.saved_lists (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);
```

## RLS — quién puede leer/escribir qué

Siguiendo el mismo patrón que ya usa `stops` (y las reglas del checklist de
seguridad de Supabase: `TO authenticated` + predicado de propiedad, `WITH
CHECK` en updates, `SELECT` policy explícita para que los `UPDATE`
funcionen):

| Tabla | Lectura | Escritura |
|---|---|---|
| `places`, `baby_features`, `evidence`, `routes`, `place_routes` | pública (`anon`, `authenticated`) | **solo `service_role`** (backend de ingesta/resolución) — RLS habilitada, sin policies de insert/update para `anon`/`authenticated` |
| `community_contributions` | pública (para mostrar "confirmado por N familias") | `authenticated`, `user_id = auth.uid()` en insert; nadie edita una contribución ya enviada (solo el moderador vía `service_role`) |
| `photos` | pública si `moderation_status = 'APPROVED'`; el autor ve las suyas en cualquier estado | `authenticated`, `user_id = auth.uid()` en insert |
| `profiles` | pública (para mostrar nivel de reputación) | el propio usuario, `id = auth.uid()`, insert+update |
| `saved_lists`, `saved_places` | solo el dueño (`user_id = auth.uid()` / vía join) | solo el dueño |

Ejemplo concreto (community_contributions), evitando los dos errores más
comunes de RLS en Supabase (falta `WITH CHECK`, y usar `auth.role()` en vez
de `TO`):

```sql
alter table public.community_contributions enable row level security;

create policy "Contributions are viewable by everyone"
  on public.community_contributions for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can submit contributions"
  on public.community_contributions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
```

`places`/`baby_features`/`evidence` **no** llevan policy de insert/update
para `anon`/`authenticated` — solo `service_role` (que **bypassa RLS por
diseño**, no necesita policy) puede escribirlas. Esto es intencional: ningún
usuario, ni siquiera autenticado, escribe directamente el "valor resuelto"
de una característica — solo puede proponer una `community_contribution`,
que el motor de resolución convierte en evidencia.

## Vistas de lectura para la app

Para no obligar a la UI a hacer 4 joins por parada, se propone una vista
`security_invoker` (obligatorio en Postgres 15+ para que la vista respete
RLS, según el checklist de seguridad de Supabase):

```sql
create view public.place_summary
  with (security_invoker = true) as
select
  p.*,
  coalesce(
    jsonb_object_agg(bf.feature_type, jsonb_build_object(
      'value', bf.value, 'status', bf.status, 'confidence', bf.confidence_score
    )) filter (where bf.feature_type is not null),
    '{}'::jsonb
  ) as features
from public.places p
left join public.baby_features bf on bf.place_id = p.id
group by p.id;
```

## Por qué no PostGIS (todavía)

`distance_to_route_meters` y el filtrado geográfico del MVP se calculan en
el momento de la ingesta (doc. 3) usando la geometría de la ruta ya
descargada, no con consultas espaciales en vivo — para el volumen del MVP
(cientos de lugares, dos rutas) un `double precision` + fórmula de
haversine/proyección en el script de ingesta es suficiente y evita añadir
una extensión más. Si el producto escala a "toda España" con búsquedas
espaciales en vivo (sección 52 del spec), migrar `lat/lng` a una columna
`geography(Point, 4326)` con PostGIS es la extensión natural — no rompe el
modelo, solo añade una columna e índices GiST.
