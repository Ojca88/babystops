-- Baby Stops: modelo de datos completo (docs/baby-stops/02-modelo-de-datos.md)
-- Sustituye el modelo mínimo de 0001_init.sql (tabla `stops`) por el modelo
-- evidence-first descrito en el análisis de viabilidad. `stops` se conserva
-- (no se borra) hasta verificar la migración de datos en producción.

create extension if not exists "pgcrypto";

-- Enums -----------------------------------------------------------------

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
  'NEEDS_REVIEW'
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

-- Tablas ------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.place_category not null,
  subcategory text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  phone text,
  website text,
  google_place_id text unique,
  osm_id bigint unique,
  google_maps_url text,
  status public.place_status not null default 'active',
  source_last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index places_lat_lng_idx on public.places (lat, lng);
create index places_category_idx on public.places (category);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  geometry text not null,
  distance_meters integer not null,
  duration_seconds integer not null,
  created_at timestamptz not null default now()
);

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

create table public.baby_features (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  feature_type public.baby_feature_type not null,
  value text not null,
  status public.feature_status not null default 'UNKNOWN',
  confidence_score numeric(5,2) not null default 0 check (confidence_score between 0 and 100),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (place_id, feature_type)
);
create index baby_features_place_idx on public.baby_features (place_id);
create index baby_features_stale_idx on public.baby_features (last_verified_at) where status = 'CONFIRMED';

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  feature_type public.baby_feature_type,
  source public.evidence_source not null,
  source_reference text not null,
  value text not null,
  raw_value text,
  certainty public.evidence_certainty not null default 'explicit',
  confidence_weight numeric(5,2) not null,
  detected_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index evidence_place_feature_idx on public.evidence (place_id, feature_type);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  child_age_months integer,
  reputation_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.community_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete set null,
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

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete set null,
  place_id uuid not null references public.places (id) on delete cascade,
  url text not null,
  category text,
  moderation_status public.moderation_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

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

-- RLS -----------------------------------------------------------------
-- places / baby_features / evidence / routes / place_routes: lectura
-- pública, escritura solo por service_role (bypassa RLS) — ningún usuario,
-- ni autenticado, escribe directamente el valor resuelto de una feature.

alter table public.places enable row level security;
create policy "Places are viewable by everyone"
  on public.places for select
  to anon, authenticated
  using (true);

alter table public.baby_features enable row level security;
create policy "Baby features are viewable by everyone"
  on public.baby_features for select
  to anon, authenticated
  using (true);

alter table public.evidence enable row level security;
create policy "Evidence is viewable by everyone"
  on public.evidence for select
  to anon, authenticated
  using (true);

alter table public.routes enable row level security;
create policy "Routes are viewable by everyone"
  on public.routes for select
  to anon, authenticated
  using (true);

alter table public.place_routes enable row level security;
create policy "Place routes are viewable by everyone"
  on public.place_routes for select
  to anon, authenticated
  using (true);

alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);
create policy "Users manage their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);
create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter table public.community_contributions enable row level security;
create policy "Contributions are viewable by everyone"
  on public.community_contributions for select
  to anon, authenticated
  using (true);
create policy "Authenticated users can submit contributions"
  on public.community_contributions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.photos enable row level security;
create policy "Approved photos are viewable by everyone"
  on public.photos for select
  to anon, authenticated
  using (moderation_status = 'APPROVED' or user_id = (select auth.uid()));
create policy "Authenticated users can upload photos"
  on public.photos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.saved_lists enable row level security;
create policy "Users view their own lists"
  on public.saved_lists for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users manage their own lists"
  on public.saved_lists for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.saved_places enable row level security;
create policy "Users view their own saved places"
  on public.saved_places for select
  to authenticated
  using (
    exists (
      select 1 from public.saved_lists l
      where l.id = saved_places.list_id and l.user_id = (select auth.uid())
    )
  );
create policy "Users manage their own saved places"
  on public.saved_places for all
  to authenticated
  using (
    exists (
      select 1 from public.saved_lists l
      where l.id = saved_places.list_id and l.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.saved_lists l
      where l.id = saved_places.list_id and l.user_id = (select auth.uid())
    )
  );

-- Vista de lectura para la app --------------------------------------------

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

-- Migración de datos desde `stops` -----------------------------------------
-- Cada `stop` existente se convierte en un `place` de origen comunidad, con
-- su contribución de alta ya aprobada, preservando la autoría original.

insert into public.places (name, category, subcategory, lat, lng, address, status, created_at)
select
  name,
  'food'::public.place_category, -- categoría por defecto; se corrige a mano si procede
  'community_stop',
  lat,
  lng,
  address,
  'active'::public.place_status,
  created_at
from public.stops;

insert into public.community_contributions (user_id, place_id, contribution_type, status, created_at, reviewed_at)
select
  s.created_by,
  p.id,
  'NEW_PLACE'::public.contribution_type,
  'APPROVED'::public.moderation_status,
  s.created_at,
  s.created_at
from public.stops s
join public.places p on p.name = s.name and p.lat = s.lat and p.lng = s.lng
where s.created_by is not null;

-- `stops` se deja tal cual (no se borra) hasta verificar esta migración en
-- producción — se elimina en una migración posterior.
