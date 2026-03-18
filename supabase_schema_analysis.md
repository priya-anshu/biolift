# BioLift Supabase Database Schema Analysis

A complete reference of every table, its columns, relationships, indexes, triggers, and RLS policies — along with optimization notes and missing elements.

---

## Database Architecture Overview

The DB is organized across four areas:
- **Core Identity**: `profiles`, `users`, `admin_emails`
- **Workout Execution**: `workout_plans`, `workout_plan_exercises`, `workout_logs`, `workout_log_exercises`, `workout_log_sets`, `exercises`, `calendar_status`
- **AI & Intelligence**: `ai_job_queue`, `ai_recommendations`, `user_training_stats`, `exercise_volume_stats`, `recovery_metrics`, `injury_flags`
- **Platform**: `leaderboard`, `motivational_messages`, `api_rate_limits`, `ranking_edit_requests`, `goals`, `profile_settings`, `progress_entries`, `workouts`

---

## Table Reference Map

### Identity Layer

#### `profiles` (Core user identity)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | gen_random_uuid() |
| `auth_user_id` | uuid UNIQUE | Links to `auth.users` |
| `email` | text UNIQUE | |
| `name` | text | |
| `avatar_url` | text | |
| `role` | text | DEFAULT 'user' — enum: `user` / `admin` |
| `created_at`, `updated_at` | timestamptz | auto-managed by trigger |

**RLS**: Users can only read/update their own row (`auth_user_id = auth.uid()`). Admins can update any row.

#### `users` (App-level extension of profiles, 1-to-1)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | FK → `profiles(id)` ON DELETE CASCADE |
| `preferred_language` | text | DEFAULT 'en' — enum: en/hi/bi |
| `timezone` | text | DEFAULT 'Asia/Kolkata' |
| `created_at`, `updated_at` | timestamptz | |

**Trigger**: `trg_sync_users_from_profiles` — inserts into `users` when a profile is created.

---

### Workout Planning Layer

#### `workout_plans`
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `user_id` | uuid NOT NULL | FK → `users` |
| `name` | text | |
| `goal` | text CHECK | fat_loss / hypertrophy / strength / general_fitness |
| `experience_level` | text CHECK | beginner / intermediate / advanced |
| `workout_days_per_week` | smallint | 1–7 |
| `muscle_split` | jsonb | |
| `planning_mode` | text | smart / manual |
| `created_by` | text | system / user |
| `visibility` | text | public / private |
| `is_active` | boolean | DEFAULT true |
| `notes` | text | |
| `created_at`, `updated_at` | timestamptz | |

**Indexes**: `user_id`, `is_active`, `goal`, `created_at DESC`  
**RLS**: Owner or admin can CRUD. Public visibility allows SELECT by anyone.

#### `workout_plan_exercises`
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `plan_id` | uuid NOT NULL | FK → `workout_plans` CASCADE |
| `day_index` | smallint | 1–7 |
| `exercise_order` | smallint | ≥1 |
| `exercise_id` | uuid | optional FK → `exercises` SET NULL |
| `exercise_name`, `muscle_group` | text | |
| `sets` | smallint | 1–10 |
| `reps_min`, `reps_max` | smallint | 1–60 constraint |
| `rest_seconds` | smallint | 15–300 |
| `tempo`, `rpe`, `notes` | misc | |
| `difficulty_level` | text | beginner/intermediate/advanced |
| `equipment_required` | text[] | |
| `visibility`, `created_by` | text | |
| `created_at`, `updated_at` | timestamptz | |
| UNIQUE | — | [(plan_id, day_index, exercise_order)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |

**RLS**: Inherits from plan owner via subquery JOIN.

#### `workout_logs`
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `user_id` | uuid NOT NULL | FK → `users` |
| `plan_id` | uuid | optional FK → `workout_plans` SET NULL |
| `workout_date` | date | NOT NULL |
| `status` | text | planned/in_progress/completed/missed/rest_day |
| `completion_percentage` | numeric(5,2) | 0–100 |
| `total_exercises`, `exercises_completed` | integer | |
| `total_duration_minutes`, `calories_burned` | integer | |
| `source` | text | planner / manual |
| `notes` | text | |
| `created_at`, `updated_at` | timestamptz | |

**Indexes**: [(user_id, workout_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), `plan_id`, `status`

#### `workout_log_exercises` (Set execution rows per exercise per session)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `workout_log_id` | uuid NOT NULL | FK → `workout_logs` CASCADE |
| `user_id` | uuid NOT NULL | FK → `users` CASCADE |
| `plan_exercise_id` | uuid | optional FK → `workout_plan_exercises` |
| `exercise_id` | uuid | optional FK → `exercises` |
| `exercise_name`, `muscle_group` | text | |
| `exercise_order` | smallint | ≥1 |
| `planned_sets/reps/rest/tempo/rpe` | misc | |
| `completed_sets`, `total_reps`, `total_volume_kg` | numeric | |
| `status` | text | planned/in_progress/completed/skipped |
| `completed` | boolean | |
| UNIQUE | — | [(workout_log_id, exercise_order)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(workout_log_id, plan_exercise_id)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |

**Indexes**: [(user_id, status, created_at)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), `exercise_id`, `plan_exercise_id`, [(workout_log_id, exercise_order)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)

#### `workout_log_sets` (Granular per-set captures)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `workout_log_exercise_id` | uuid NOT NULL | Composite FK |
| `workout_log_id` | uuid NOT NULL | FK → `workout_logs` |
| `user_id` | uuid NOT NULL | FK → `users` |
| `set_number` | smallint | 1–30 |
| `actual_reps`, `actual_weight_kg`, `actual_rpe` | numeric | |
| `set_status` | text | completed/failed/skipped/warmup |
| `performed_at` | timestamptz | |
| UNIQUE | — | [(workout_log_exercise_id, set_number)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |

**Indexes**: [(workout_log_exercise_id, set_number)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(workout_log_id, performed_at DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, performed_at DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)  
**Note**: Uses a composite 3-column FK [(workout_log_exercise_id, workout_log_id, user_id)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) for cascaded delete integrity.

#### `exercises` (Global exercise catalog)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| [slug](file:///c:/Users/priya/Desktop/biolift/lib/services/workout/utils.ts#20-29) | text UNIQUE | |
| `name` | text | |
| `target_muscle`, `secondary_muscles` | text / text[] | |
| `difficulty_level` | text | beginner/intermediate/advanced |
| `equipment_required` | text[] | |
| `cloudinary_image_id`, `cloudinary_gif_id` | text | Asset references only |
| `visibility` | text | public / private |
| `created_by` | uuid | FK → `profiles` SET NULL |

**Indexes**: `difficulty_level`, `target_muscle`, `visibility`  
**RLS**: Public exercises are globally readable. Only owner or admin can mutate.

#### `calendar_status`
Per-day workout completion / rest / missed tracking.
- UNIQUE [(user_id, status_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- Enum status: `completed / missed / rest_day / planned`
- Holds optional `workout_log_id` for rich data linkage

---

### AI & Intelligence Layer

#### `ai_job_queue` (Background AI worker queue, priority-based)
| Column | Type | Notes |
|--------|------|-------|
| [id](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) | uuid PK | |
| `user_id` | uuid NOT NULL | FK → `users` |
| `job_type` | text CHECK | session_finished / daily_refresh / plan_updated / etc. |
| `status` | text CHECK | pending / processing / completed / failed / cancelled |
| [priority](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts#109-124) | smallint | 1 (urgent) → 9 (background) |
| `payload` | jsonb | |
| `attempts`, `max_attempts` | smallint | |
| `processing_timeout_seconds` | integer | 60–3600 |
| `run_after` | timestamptz | Delayed job scheduling |
| `dedupe_key` | text | Deduplicate active jobs |
| `locked_by`, `locked_at` | text/timestamptz | Worker identity |

**Unique Index**: `ai_job_queue_dedupe_active_idx` on `dedupe_key` WHERE status IN ('pending', 'processing') — ensures exactly-once active scheduling.  
**Key Index**: [(status, priority, created_at, run_after)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) — the job claim index.  
**RLS**: Admin-only via `is_current_user_admin()`.  
**Ownership**: Server uses `claim_ai_jobs(worker_id, limit)` function with `FOR UPDATE SKIP LOCKED` for safe concurrent claim.

#### `ai_recommendations` (Cached AI intelligence results)
| Column | Type | Notes |
|--------|------|-------|
| `user_id`, `plan_id` | uuid | FK |
| `workout_date`, `day_index`, `lookback_days` | date/smallint | |
| `result_json` | jsonb | Full AI result cached |
| UNIQUE | — | [(user_id, plan_id, workout_date, day_index, lookback_days)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |

**RLS**: Owner or admin access only.

#### `recovery_metrics`
Daily sleep/HRV/soreness/fatigue/readiness inputs per user.
- UNIQUE [(user_id, metric_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- Used by AI engine to determine training load adjustments.
- Indexed by [(user_id, metric_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, readiness_score DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)

#### `injury_flags`
Tracking active injuries that restrict certain movements/exercises.
- Status enum: active / monitoring / recovering / resolved
- Injury types: acute_pain / strain / sprain / joint_irritation / overuse / post_surgery / other
- Contains `load_cap_percentage`, `restricted_movements[]`, `rehab_protocol jsonb`
- Conditional index: [(user_id, flagged_on DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) WHERE `status != 'resolved'`

#### `user_training_stats` (Weekly snapshot aggregates)
- UNIQUE [(user_id, snapshot_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- Stores: `workouts_completed_7d`, `weekly_volume_kg`, `streak_days`, `fatigue_score`, `readiness_score`, `consistency_score`

#### `exercise_volume_stats` (Per-exercise weekly volume)
- UNIQUE [(user_id, exercise_id, week_start_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- Stores: `sets_completed`, `reps_completed`, `weekly_volume_kg`, `best_weight_kg`, `best_estimated_1rm`

---

### Platform Layer

#### `leaderboard`
- UNIQUE `user_id` (one row per user)
- Scores: `total_score`, `strength_score`, `stamina_score`, `consistency_score`, `improvement_score`
- Tier: Bronze/Silver/Gold/Platinum/Diamond
- `fair_play_locked` flag for suspicious activity
- Indexed by `total_score DESC`, [(tier, position)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- UNIQUE partial index on `position` WHERE `position IS NOT NULL`
- **RLS**: Globally readable (`USING (true)`). Admin-only write.

#### `personal_records` (referenced by session route)
- Detected automatically when a new 1RM is achieved
- Linked to `workout_log_set_id`

#### `motivational_messages`
- Language / goal_focus backed quote bank
- Indexed by [(is_active, priority DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(language, goal_focus)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832)
- Admin-only write, public read for active messages

#### `api_rate_limits`
- PK: `rate_key` text
- `consume_rate_limit(key, limit, window_secs)` DB function for horizontal scaling
- Background cleanup: `cleanup_expired_rate_limits(max_age_hours)`

---

## Row Level Security Summary

| Table | RLS Strategy |
|-------|-------------|
| `profiles` | `auth_user_id = auth.uid()` — own row only |
| `users` | `id = current_profile_id()` — own row only |
| `exercises` | Public exercises readable globally; CRUD restricted to creator or admin |
| `workout_plans` | Owner or admin CRUD; public visibility allows SELECT |
| `workout_plan_exercises` | Inherits plan ownership via JOIN subquery |
| `workout_logs` | Owner or admin |
| `workout_log_exercises` | Owner or admin |
| `workout_log_sets` | Owner or admin |
| `recovery_metrics` | Owner or admin |
| `injury_flags` | Owner or admin |
| `ai_recommendations` | Owner or admin |
| `ai_job_queue` | Admin-only |
| `user_training_stats` | Owner SELECT; admin write |
| `exercise_volume_stats` | Owner SELECT; admin write |
| `leaderboard` | Public SELECT; admin-only INSERT/UPDATE/DELETE |
| `calendar_status` | Owner or admin |
| `motivational_messages` | Active messages public SELECT; admin writes |

---

## Key DB Functions

| Function | Purpose |
|----------|---------|
| `current_profile_id()` | Maps `auth.uid()` → `profiles.id` (STABLE, SECURITY DEFINER) |
| `is_current_user_admin()` | Checks admin_emails OR profile role = admin |
| `consume_rate_limit(key, limit, secs)` | Sliding-window rate limiter using DB upsert |
| `cleanup_expired_rate_limits()` | Prune stale rate limit rows |
| `claim_ai_jobs(worker_id, limit)` | Atomic SELECT + UPDATE with `FOR UPDATE SKIP LOCKED` |
| `touch_updated_at()` | Universal trigger function for `updated_at` maintenance |
| `sync_users_from_profiles()` | Trigger that auto-inserts into `users` on profile creation |
| `handle_new_user()` | Trigger runs on `auth.users` insert → populates `profiles` |

---

## Existing Indexes Summary

| Table | Indexed Columns |
|-------|----------------|
| `workout_plans` | `user_id`, `is_active`, `goal`, `created_at DESC` |
| `workout_logs` | [(user_id, workout_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), `plan_id`, `status` |
| `workout_log_exercises` | [(workout_log_id, exercise_order)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, status, created_at)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), `exercise_id`, `plan_exercise_id` |
| `workout_log_sets` | [(workout_log_exercise_id, set_number)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(workout_log_id, performed_at)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, performed_at)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |
| `ai_job_queue` | [(status, priority, created_at, run_after)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, created_at DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), dedupe partial |
| `ai_recommendations` | [(user_id, generated_at DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, plan_id, workout_date, day_index, lookback_days)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |
| `recovery_metrics` | [(user_id, metric_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, readiness_score, metric_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |
| `injury_flags` | [(user_id, status, flagged_on)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), partial WHERE not resolved |
| `user_training_stats` | [(user_id, snapshot_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |
| `exercise_volume_stats` | [(user_id, week_start_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), [(user_id, exercise_id, week_start_date)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832) |
| `leaderboard` | `total_score DESC`, [(tier, position)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), unique partial on `position` |
| `calendar_status` | [(user_id, status_date DESC)](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832), `status` |
| `exercises` | `difficulty_level`, `target_muscle`, `visibility` |
| `api_rate_limits` | `updated_at` |

---

## Optimization Opportunities

### ⚠️ Potential Missing Index
`personal_records` table is referenced in the session route but its exact schema/indexes were not found in the scanned files — may need verification.

### ⚠️ `workout_log_exercises.workout_log_id` Join Heavy
The session route does a full re-read of `workout_log_exercises` after every set save. Consider a partial filter index: [(workout_log_id) WHERE status != 'completed'](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#783-832).

### ⚠️ `ai_recommendations` Cache Staleness
No TTL column or expiry mechanism exists. The cache can grow unboundedly. Adding a `expires_at` column with a background cleanup job is recommended.

### ✅ Job Queue is Well-Indexed
The `ai_job_queue` uses `FOR UPDATE SKIP LOCKED` with a composite status/priority/created_at index that is correctly structured for concurrent workers.

### ⚠️ RLS Functions Called Per Row
`current_profile_id()` is marked STABLE (good) but is still called for every row in most tables. For heavy scans consider pre-computing the ID at session setup.
