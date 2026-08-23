-- babystops schema: crowdsourced baby-friendly stops along road-trip routes.

create extension if not exists "pgcrypto";

create type public.amenity as enum (
  'diaper_change',
  'nursing',
  'family_restroom',
  'food',
  'playground',
  'rest_area',
  'stroller_friendly'
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  address text,
  amenities public.amenity[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stops_lat_lng_idx on public.stops (lat, lng);
create index stops_amenities_idx on public.stops using gin (amenities);

alter table public.stops enable row level security;

-- Anyone (including anonymous visitors) can browse stops.
create policy "Stops are viewable by everyone"
  on public.stops for select
  to anon, authenticated
  using (true);

-- Only signed-in users can add stops, and only as themselves.
create policy "Authenticated users can add stops"
  on public.stops for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- Contributors can edit or remove their own submissions.
create policy "Users can update their own stops"
  on public.stops for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "Users can delete their own stops"
  on public.stops for delete
  to authenticated
  using ((select auth.uid()) = created_by);
