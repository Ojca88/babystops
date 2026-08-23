# babystops

A road-trip planner for parents: find diaper-change tables, nursing spots,
family restrooms, and other baby-friendly stops along a driving route, or
add ones you've discovered yourself.

## Stack

- **Next.js** (App Router, Turbopack) + Tailwind CSS
- **Supabase** — Postgres database + auth (crowdsourced stops, RLS-protected)
- **Leaflet / OpenStreetMap** — map rendering (no API key required)
- **OSRM** — driving directions, proxied server-side (no API key required)
- **Nominatim** — address geocoding, proxied server-side

## Getting started

```bash
npm install
vercel link          # link to the Vercel project (if not already linked)
vercel env pull       # pulls Supabase + other env vars into .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

Schema lives in `supabase/migrations/`. Apply it to a linked Supabase
project with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

`supabase/seed.sql` has a few sample stops for local development.

### Environment variables

See `.env.local.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## How it works

- `/` — trip search (origin + destination)
- `/trip` — driving route + stops within 5 km of it, filterable by amenity
- `/map` — browse every submitted stop on one map
- `/stops/new` — add a stop (requires login); click the map to place a pin
- `/stops/[id]` — stop detail page
- `/login`, `/signup` — Supabase email/password auth

Routing and geocoding are proxied through `/api/directions` and
`/api/geocode` so the provider can be swapped later without touching the
frontend.
