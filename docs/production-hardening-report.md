# BioLift Production Hardening Report

Date: 2026-03-13

## Verification Summary

- `npx tsc --noEmit`: pass
- `npm run lint`: pass
- `npm run build`: pass
  - Verified with placeholder env values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_WORKER_SECRET`, and `CRON_SECRET`

## System Stability

- Centralized environment validation was added in [lib/env.ts](/Users/priya/Desktop/biolift/lib/env.ts).
- Supabase server/browser client creation now uses validated env access in [lib/supabase/server.ts](/Users/priya/Desktop/biolift/lib/supabase/server.ts) and [lib/supabase/client.ts](/Users/priya/Desktop/biolift/lib/supabase/client.ts).
- Current user resolution now uses the request-scoped Supabase client on the common path and only falls back to the admin client for legacy profile repair cases in [lib/auth/currentProfile.ts](/Users/priya/Desktop/biolift/lib/auth/currentProfile.ts).
- API error handling was standardized through [lib/server/api.ts](/Users/priya/Desktop/biolift/lib/server/api.ts). User-facing failures now return `{ success: false, error: "..." }` instead of ad hoc payloads.

## Database Performance

- Added safe index migration [database/schema/022_production_hardening_indexes.sql](/Users/priya/Desktop/biolift/database/schema/022_production_hardening_indexes.sql).
- New indexes target the hottest request paths:
  - `workout_plans (user_id, is_active, created_at desc)` for active-plan resolution.
  - `workout_log_exercises (user_id, workout_log_id, exercise_order)` for dashboard/progress/session hydration.
  - `workout_log_sets (user_id, workout_log_id, workout_log_exercise_id, set_number)` for session set reads/upserts.
  - Partial queue indexes for pending-job claim scans and stale lock recovery.
- Existing RLS/FK coverage for `workout_logs`, `workout_log_exercises`, `workout_log_sets`, `ai_recommendations`, `training_load_state`, `recovery_state`, `muscle_fatigue_state`, `user_training_stats`, `exercise_volume_stats`, and `ai_job_queue` is present in the checked-in migrations.
- Live `EXPLAIN ANALYZE` was not possible from the repository alone, so `<50ms` remains a deployment-time verification item.

## API Performance

- Duplicate recommendation-cache reads were removed from:
  - [app/api/dashboard/summary/route.ts](/Users/priya/Desktop/biolift/app/api/dashboard/summary/route.ts)
  - [app/api/workout/today/route.ts](/Users/priya/Desktop/biolift/app/api/workout/today/route.ts)
  - [app/api/workout-planner/recommendations/route.ts](/Users/priya/Desktop/biolift/app/api/workout-planner/recommendations/route.ts)
  - [app/api/workout/session/route.ts](/Users/priya/Desktop/biolift/app/api/workout/session/route.ts)
- Dashboard summary query volume was reduced by only loading first-exercise metadata for the visible recent logs in [lib/workout-planner/service.ts](/Users/priya/Desktop/biolift/lib/workout-planner/service.ts).
- Exercise catalog and AI suggestion responses now omit unused `instructions` payloads to keep responses smaller.
- Critical mutation routes now await queue scheduling instead of fire-and-forget `.catch(() => {})`, which removes silent refresh failures.

## Dashboard Load Path

- `/api/dashboard/summary`, `/api/workout/today`, `/api/progress/overview`, and `/api/ranking/overview` now avoid unnecessary duplicate reads and return smaller payloads where possible.
- The ranking response no longer exposes other users' email addresses.
- The `<500ms` target could not be measured without a live Supabase dataset and network latency; it still needs real staging profiling after applying the SQL migration.

## AI Engine Safety

- Expensive AI recomputation is no longer triggered inline from user-facing APIs.
- Routes now schedule worker jobs through [scheduleAiJob](/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts) and only read cached/baseline results.
- Worker-only compute remains in:
  - [lib/workout-planner/workerQueue.ts](/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts)
  - [lib/workout-planner/trainingBrain.ts](/Users/priya/Desktop/biolift/lib/workout-planner/trainingBrain.ts)
  - [lib/workout-planner/recoveryEngine.ts](/Users/priya/Desktop/biolift/lib/workout-planner/recoveryEngine.ts)
  - [lib/workout-planner/trainingLoadEngine.ts](/Users/priya/Desktop/biolift/lib/workout-planner/trainingLoadEngine.ts)
  - [lib/workout-planner/muscleFatigueEngine.ts](/Users/priya/Desktop/biolift/lib/workout-planner/muscleFatigueEngine.ts)

## Worker Queue Health

- Added structured queue scheduling, retry, completion, batch, and cache-refresh logging in [lib/workout-planner/workerQueue.ts](/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts).
- Daily refresh enqueue now batches writes instead of serializing one insert per user.
- Retry behavior remains bounded by `max_attempts`; failed jobs are moved back to `pending` with backoff or to `failed` terminal status.
- Visibility-timeout recovery is still handled by stale `processing` reset logic plus the new partial lock index.

## Security Review

- Confirmed user-ownership checks are enforced through route context + RLS-backed table policies.
- Fixed data exposure in [lib/workout-planner/service.ts](/Users/priya/Desktop/biolift/lib/workout-planner/service.ts) and [app/dashboard/ranking/page.tsx](/Users/priya/Desktop/biolift/app/dashboard/ranking/page.tsx): public ranking data no longer includes `profiles.email`.
- Worker/cron endpoints now validate their shared secret through [getWorkerSecret](/Users/priya/Desktop/biolift/lib/env.ts).
- Admin routes still require [getAdminContext](/Users/priya/Desktop/biolift/lib/admin/server.ts) before privileged reads/writes.

## Logging And Observability

- Added structured logs for:
  - worker job schedule / dedupe / failure
  - worker cache refresh
  - worker batch completion
  - workout session load
  - workout session finish
- Logged metadata now includes `user_id`, `job_type`, and `duration_ms` on the new production-critical paths.

## Build And Dependency Surface

- Removed unused packages:
  - `@nextui-org/react`
  - `tailwind-merge`
- Replaced linted `<img>` hotspots with `next/image` in dashboard/admin surfaces and the exercise media component.
- Production build completes successfully.

## Dead Code / Deprecated Inventory

Marked as legacy/deprecated in code:

- [app/dashboard/diet/page.tsx](/Users/priya/Desktop/biolift/app/dashboard/diet/page.tsx)
  - `LEGACY`: dormant placeholder page not linked from active dashboard navigation.
- [app/api/dashboard/motivation/route.ts](/Users/priya/Desktop/biolift/app/api/dashboard/motivation/route.ts)
  - `LEGACY`: retained for backward compatibility; the main dashboard now inlines motivation data.
- [lib/runtime/runtimeMode.ts](/Users/priya/Desktop/biolift/lib/runtime/runtimeMode.ts)
  - `LEGACY`: synchronous hobby-mode AI execution path is deprecated.
- [lib/workout-planner/workerQueue.ts](/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts)
  - `LEGACY`: `checkRecommendationCacheTTL` and `runImmediateAIJobs` retained only for compatibility/debugging.

## Remaining Risks

- Live database latency was not benchmarked from this workspace. Query timing and dashboard `<500ms` must still be confirmed in staging with real data.
- SQL migration [database/schema/022_production_hardening_indexes.sql](/Users/priya/Desktop/biolift/database/schema/022_production_hardening_indexes.sql) must be applied before the index improvements take effect.
- Queue behavior was validated statically and through code-path review, not with a live worker under load.
- `npm ls --depth=0` still reports a few extraneous packages in `node_modules`; they appear to be install artifacts rather than declared dependencies, but the deployment image should be rebuilt from lockfile for a clean install.

## Production Launch Checklist

- Apply [database/schema/022_production_hardening_indexes.sql](/Users/priya/Desktop/biolift/database/schema/022_production_hardening_indexes.sql).
- Confirm production env values exist:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `AI_WORKER_SECRET` or `CRON_SECRET`
- Run a staging smoke test against live Supabase:
  - dashboard load
  - workout session start/save/delete/finish
  - plan generation
  - manual plan creation
  - recovery metrics update
  - ranking overview
- Run `EXPLAIN ANALYZE` for the four dashboard APIs and the worker claim query after the new indexes are applied.
- Verify worker cron / internal worker secret configuration in the deployment platform.
- Verify structured logs are visible in the deployment log sink.
- Rebuild the deployment image from the updated lockfile.
