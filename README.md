# BioLift (Next.js + Supabase)

BioLift is a smart fitness companion built with Next.js and Supabase.  
This repo contains the migrated Next.js app with authentication, dashboards, and a growing set of feature pages.

## Stack

- Next.js (App Router)
- Supabase Auth + Postgres
- Tailwind CSS (custom day/night theme)
- Framer Motion + Lucide icons
- Recharts (progress analytics)

## Getting Started

Install deps:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## App Routes

- `/signin` / `/signup` / `/forgot-password` / `/reset-password`
- `/dashboard` (user)
- `/dashboard/workout`
- `/dashboard/workouts`
- `/dashboard/ranking`
- `/dashboard/progress`
- `/dashboard/diet`
- `/dashboard/social`
- `/dashboard/shop`
- `/dashboard/profile`
- `/admin/dashboard`

## Database

SQL files are organized under `database/` by category:

- `database/schema/` (core tables, triggers)
- `database/rls/` (row-level security)
- `database/permissions/` (grants)
- `database/security_checks/` (verification queries)
- `database/progress/` (progress + workout_exercises additions)

Note: the `database/` folder is gitignored by default in this repo.

## Progress & Ranking

- Manual entries for body weight and workouts are on `/dashboard/progress`.
- Ranking eligibility requires 14 days of body-weight logs.

## Build

```bash
npm run build
```

If you see image host errors, add remote domains in `next.config.ts`.

## Notes

- Exercise media lookups are disabled until assets are added.
- Sample data can be inserted via SQL in `database/progress/`.
