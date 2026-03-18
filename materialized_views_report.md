# BioLift Materialized Views — Strategy & Performance Report

## Heavy Dashboard Queries Identified

Before designing views, I traced the most expensive sequential query chains through [analytics.service.ts](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts) and [intelligenceEngine.ts](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/intelligenceEngine.ts):

### Chain 1 — Dashboard Load ([getDashboardSummary](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#5-154))
Every dashboard page triggers **4 parallel queries + 2 sequential queries**:
```
workout_logs       → filtered 7–60 days → up to 500 rows
goals              → filtered user
progress_entries   → heart_rate filter
user_training_stats → latest snapshot
  workout_log_exercises → IN(6 recent log IDs) → JOIN in JS
```
**Problem**: The `workout_log_exercises` JOIN is reconstructed in JavaScript via a Map — it's accurate but slow for 30 days of data.

### Chain 2 — Leaderboard Score Refresh ([refreshLeaderboardForUser](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#393-538))
Called after every session completion — **3 parallel queries + 1 final upsert**:
```
workout_logs         → 30-day history → up to 500 rows
workout_log_exercises → IN(all log IDs) → sum(total_volume_kg)
progress_entries     → 30 days
personal_records     → 90 days → max(estimated_1rm) + improvement calc
```
**Problem**: Volume sum in JS across potentially hundreds of exercises. PR improvement calculated with two `.filter()` passes in memory.

### Chain 3 — Ranking View ([getRankingOverview](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#539-573))
```
leaderboard → ORDER BY total_score DESC → LIMIT 100
  JOIN profiles  (for name + avatar)
  + window function in JS for positions
```
**Problem**: `DENSE_RANK()` computed in JavaScript. Profile JOIN on every single request.

### Chain 4 — Progress Overview ([getProgressOverview](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#155-364))
```
user_training_stats → up to 220 rows (6 months history)
exercise_volume_stats → JOIN exercises (by id) → name lookup
workout_logs + workout_log_exercises → volume aggregation per log
```
**Problem**: Two sequential JOIN steps, with exercise name resolved in a JS Map.

---

## Materialized Views Created

All 5 views are in [materialized_views.sql](file:///c:/Users/priya/Desktop/biolift/database/optimization/materialized_views.sql).

### View 1: `mv_user_workout_summary_30d`
Precomputes per workout-log: `total_volume_kg`, `exercise_count`, `first_exercise_name`.

| Attribute | Value |
|-----------|-------|
| Source tables | `workout_logs` ← `workout_log_exercises` |
| Replaces | The N+1 exercise JOIN in dashboard load |
| Refresh suggested | Every 30 minutes |
| Indexes | UNIQUE [(workout_log_id, user_id)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(user_id, workout_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(user_id, status, workout_date)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29) |

**Expected Gain**: Dashboard `recentActivity` construction drops from 2-query chain to 1 index scan.

---

### View 2: `mv_user_activity_streaks`
Precomputes streak days, activity counts (7d/14d), total duration, calories, avg completion — **all in a single row per user**.

| Attribute | Value |
|-----------|-------|
| Source tables | `workout_logs` |
| Replaces | JS [computeDateStreak()](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts#147-160) + aggregations in [refreshLeaderboardForUser](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#393-538) |
| Refresh suggested | Hourly |
| Indexes | UNIQUE [(user_id)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29) |

**Expected Gain**: Leaderboard score computation reads 1 row instead of aggregating 500 log rows in memory.

---

### View 3: `mv_leaderboard_ranked`
Precomputes `DENSE_RANK()` globally and per-tier, and snapshots `profiles.name + avatar_url`.

| Attribute | Value |
|-----------|-------|
| Source tables | `leaderboard` ← `profiles` |
| Replaces | [getRankingOverview()](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#539-573) JOIN + JS rank calculation |
| Refresh suggested | After every leaderboard upsert (trigger included) |
| Indexes | UNIQUE [(user_id)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(total_score DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(tier, total_score DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29) |
| RLS | Public SELECT (`USING (true)`) — matches source table policy |

**Expected Gain**: Ranking page goes from 2-table JOIN + JS DENSE_RANK to a single indexed scan.

---

### View 4: `mv_user_volume_by_muscle_7d`
Precomputes weekly training volume per muscle group per user for the past 180 days.

| Attribute | Value |
|-----------|-------|
| Source tables | `workout_log_exercises` ← `workout_logs` |
| Replaces | [getProgressOverview()](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/analytics.service.ts#155-364) exercise volume aggregation in JS |
| Refresh suggested | Hourly |
| Indexes | UNIQUE [(user_id, muscle_group, week_start)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(user_id, week_start DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29) |

**Expected Gain**: Progress page muscle volume chart reads from pre-aggregated weekly rows instead of scanning individual sets.

---

### View 5: `mv_user_personal_records_best`
Precomputes the single best `estimated_1rm` per user per exercise.

| Attribute | Value |
|-----------|-------|
| Source tables | `personal_records` |
| Replaces | [loadPersonalRecords()](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/intelligenceEngine.ts#477-506) chunked queries + JS max extraction |
| Refresh suggested | Every 30 minutes |
| Indexes | UNIQUE [(user_id, exercise_id)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29), [(user_id, estimated_1rm DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/progress/overview/route.ts#10-29) |

**Expected Gain**: Per-session AI analysis loads best 1RM per exercise in a single scan instead of chunked IN queries.

---

## RLS Policy Compatibility ✅

> [!IMPORTANT]
> Materialized views in PostgreSQL do **NOT** automatically inherit RLS from their source tables. This is by design — the snapshotted data is static at refresh time.

This solution handles RLS-safety through three mechanisms:

1. **`user_id` column** included in every view — enables row-level filtering
2. **RLS policies added directly** on each materialized view using the same `current_profile_id()` function as source tables
3. **Leaderboard view** uses `USING (true)` — matching the source `leaderboard` table's public read policy

No existing RLS policy is modified, dropped, or weakened.

---

## Refresh Strategy Summary

| View | Trigger | Frequency |
|------|---------|-----------|
| `mv_user_workout_summary_30d` | pg_cron / manual | Every 30 min |
| `mv_user_activity_streaks` | pg_cron / manual | Hourly |
| `mv_leaderboard_ranked` | DB Trigger on `leaderboard` INSERT/UPDATE | Immediate |
| `mv_user_volume_by_muscle_7d` | pg_cron / manual | Hourly |
| `mv_user_personal_records_best` | pg_cron / manual | Every 30 min |

### `refresh_analytics_views()` function
A single stored function is provided to refresh all 5 views with `CONCURRENTLY` (no read locks):

```sql
SELECT public.refresh_analytics_views();
```

Call this from a **Supabase Edge Function** scheduled via Dashboard → Cron Jobs, or from a custom webhook triggered after workout completion.

> [!TIP]
> `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index on the view. All 5 views have a UNIQUE index defined. Do not remove these unique indexes.

> [!NOTE]
> `ALTER MATERIALIZED VIEW ... ENABLE ROW LEVEL SECURITY` requires PostgreSQL 15+. Supabase projects support this. If on an older version, wrap access through a security definer function instead.

---

## Applying the Views

Run in Supabase SQL Editor (one statement at a time — CONCURRENTLY creates cannot run in transaction):

```bash
psql $DATABASE_URL -f database/optimization/materialized_views.sql
```

Or paste into Supabase Dashboard → SQL Editor and run each `CREATE MATERIALIZED VIEW` block individually.
