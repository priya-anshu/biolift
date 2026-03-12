import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/server/logger";
import {
  primeWorkoutRecommendationCache,
  refreshLeaderboardForUser,
} from "@/lib/workout-planner/service";
import { updateExerciseAdaptationState } from "@/lib/workout-planner/trainingBrain";
import { recomputeRecoveryState } from "@/lib/workout-planner/recoveryEngine";
import {
  getTrainingLoadState,
  recomputeTrainingLoadState,
} from "@/lib/workout-planner/trainingLoadEngine";

export type AiJobType =
  | "session_finished"
  | "manual_workout_logged"
  | "plan_updated"
  | "recovery_updated"
  | "daily_refresh"
  | "recommendation_refresh"
  | "on_demand_refresh"
  | "analytics_snapshot"
  | "leaderboard_refresh";

type QueueJobRow = {
  id: string;
  user_id: string;
  job_type: AiJobType;
  status: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  run_after: string;
  created_at: string;
  priority: number;
  processing_timeout_seconds: number;
};

type EnqueueJobInput = {
  userId: string;
  jobType: AiJobType;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  runAfter?: string;
  priority?: number;
};

type ProcessOptions = {
  limit?: number;
  workerId?: string;
};

type ProcessSummary = {
  claimed: number;
  completed: number;
  failed: number;
};

const DEFAULT_LOOKBACK_DAYS = 42;
const DEFAULT_BATCH_LIMIT = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function priorityForJobType(jobType: AiJobType) {
  if (jobType === "session_finished") return 1; // critical
  if (
    jobType === "recommendation_refresh" ||
    jobType === "on_demand_refresh" ||
    jobType === "manual_workout_logged" ||
    jobType === "plan_updated" ||
    jobType === "recovery_updated"
  ) {
    return 3; // recommendation_refresh
  }
  if (jobType === "analytics_snapshot") return 5;
  if (jobType === "leaderboard_refresh") return 7;
  return 9; // daily_refresh
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function weekStartDateKey(referenceDate: string) {
  const date = parseDateOnly(referenceDate);
  const utcDay = date.getUTCDay();
  const offset = utcDay === 0 ? -6 : 1 - utcDay;
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
}

function daysAgoDateKey(referenceDate: string, days: number) {
  const date = parseDateOnly(referenceDate);
  date.setUTCDate(date.getUTCDate() - days);
  return dateKey(date);
}

function computeDateStreak(dateKeys: string[]) {
  if (dateKeys.length === 0) return 0;
  const unique = Array.from(new Set(dateKeys)).sort();
  const cursor = new Date(`${unique[unique.length - 1]}T00:00:00Z`);
  let streak = 0;
  while (true) {
    const key = dateKey(cursor);
    if (!unique.includes(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function estimated1rm(weightKg: number, reps: number) {
  return weightKg * (1 + Math.min(reps, 10) / 30);
}

function dayIndexFromDateKey(dateText: string) {
  const date = parseDateOnly(dateText);
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

function extractRecommendationInput(payload: Record<string, unknown>) {
  const workoutDateRaw = String(payload.workoutDate ?? "").trim();
  const workoutDate = /^\d{4}-\d{2}-\d{2}$/.test(workoutDateRaw)
    ? workoutDateRaw
    : todayDateKey();
  const dayIndexRaw = toNumber(payload.dayIndex, NaN);
  const dayIndex = Number.isFinite(dayIndexRaw)
    ? clampInt(dayIndexRaw, 1, 7)
    : undefined;
  const lookbackDays = clampInt(
    toNumber(payload.lookbackDays, DEFAULT_LOOKBACK_DAYS),
    14,
    90,
  );
  const planId =
    typeof payload.planId === "string" && payload.planId.trim().length > 0
      ? payload.planId.trim()
      : undefined;

  return {
    workoutDate,
    dayIndex,
    lookbackDays,
    planId,
  };
}

async function resolvePlanIdForCacheCheck(
  client: SupabaseClient,
  userId: string,
  planId?: string,
) {
  if (planId) return planId;

  const activePlanRes = await client
    .from("workout_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePlanRes.error) throw new Error(activePlanRes.error.message);
  if (activePlanRes.data?.id) return String(activePlanRes.data.id);

  const fallbackPlanRes = await client
    .from("workout_plans")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackPlanRes.error) throw new Error(fallbackPlanRes.error.message);
  if (!fallbackPlanRes.data?.id) return null;

  return String(fallbackPlanRes.data.id);
}

export async function checkRecommendationCacheTTL(
  client: SupabaseClient,
  input: {
    userId: string;
    workoutDate: string;
    planId?: string;
    dayIndex?: number;
    lookbackDays?: number;
  },
) {
  const workoutDate = /^\d{4}-\d{2}-\d{2}$/.test(input.workoutDate)
    ? input.workoutDate
    : todayDateKey();
  const dayIndex = clampInt(
    input.dayIndex ?? dayIndexFromDateKey(workoutDate),
    1,
    7,
  );
  const lookbackDays = clampInt(input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 14, 90);
  const planId = await resolvePlanIdForCacheCheck(client, input.userId, input.planId);
  if (!planId) {
    return {
      exists: false,
      isStale: false,
      updatedAt: null as string | null,
      planId: null as string | null,
      workoutDate,
      dayIndex,
      lookbackDays,
    };
  }

  const rowRes = await client
    .from("ai_recommendations")
    .select("updated_at")
    .eq("user_id", input.userId)
    .eq("plan_id", planId)
    .eq("workout_date", workoutDate)
    .eq("day_index", dayIndex)
    .eq("lookback_days", lookbackDays)
    .maybeSingle();

  if (rowRes.error) {
    if (rowRes.error.code === "42P01" || rowRes.error.code === "42703") {
      return {
        exists: false,
        isStale: false,
        updatedAt: null as string | null,
        planId,
        workoutDate,
        dayIndex,
        lookbackDays,
      };
    }
    throw new Error(rowRes.error.message);
  }

  const updatedAt = rowRes.data?.updated_at ? String(rowRes.data.updated_at) : null;
  const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;
  const isStale =
    Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > CACHE_TTL_MS;

  return {
    exists: Boolean(rowRes.data),
    isStale,
    updatedAt,
    planId,
    workoutDate,
    dayIndex,
    lookbackDays,
  };
}

export async function enqueueAiJob(
  client: SupabaseClient,
  input: EnqueueJobInput,
) {
  const priority = clampInt(
    input.priority ?? priorityForJobType(input.jobType),
    1,
    9,
  );
  const jobPayload = {
    user_id: input.userId,
    job_type: input.jobType,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
    run_after: input.runAfter ?? new Date().toISOString(),
    status: "pending",
    priority,
  };
  const upsertRes = await client.from("ai_job_queue").upsert(jobPayload, {
    onConflict: "dedupe_key",
    ignoreDuplicates: true,
  });

  if (upsertRes.error) {
    if (upsertRes.error.code === "42P10") {
      const insertRes = await client.from("ai_job_queue").insert(jobPayload);
      if (insertRes.error) {
        if (insertRes.error.code === "23505") {
          return { enqueued: false as const, reason: "duplicate" as const };
        }
        throw new Error(insertRes.error.message);
      }
      return { enqueued: true as const };
    }
    if (upsertRes.error.code === "23505") {
      return { enqueued: false as const, reason: "duplicate" as const };
    }
    throw new Error(upsertRes.error.message);
  }

  return { enqueued: true as const };
}

export async function enqueueDailyRefreshForActiveUsers(
  client: SupabaseClient,
  input?: { workoutDate?: string },
) {
  const workoutDateRaw = String(input?.workoutDate ?? "").trim();
  const workoutDate = /^\d{4}-\d{2}-\d{2}$/.test(workoutDateRaw)
    ? workoutDateRaw
    : todayDateKey();

  const activePlansRes = await client
    .from("workout_plans")
    .select("user_id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (activePlansRes.error) {
    throw new Error(activePlansRes.error.message);
  }

  const userIds = Array.from(
    new Set(
      (activePlansRes.data ?? [])
        .map((row) => String(row.user_id ?? ""))
        .filter(Boolean),
    ),
  );

  let enqueued = 0;
  let deduped = 0;
  for (const userId of userIds) {
    const result = await enqueueAiJob(client, {
      userId,
      jobType: "daily_refresh",
      payload: { workoutDate, lookbackDays: DEFAULT_LOOKBACK_DAYS },
      dedupeKey: `daily_refresh:${userId}:${workoutDate}`,
    });
    if (result.enqueued) enqueued += 1;
    else deduped += 1;
  }

  return {
    workoutDate,
    activeUsers: userIds.length,
    enqueued,
    deduped,
  };
}

async function claimPendingJobs(
  client: SupabaseClient,
  input: Required<ProcessOptions>,
) {
  const processingRes = await client
    .from("ai_job_queue")
    .select("id,locked_at,processing_timeout_seconds")
    .eq("status", "processing")
    .not("locked_at", "is", null)
    .limit(5000);
  if (processingRes.error) {
    throw new Error(processingRes.error.message);
  }

  const nowMs = Date.now();
  const staleIds = (processingRes.data ?? [])
    .filter((row) => {
      const lockedAtMs = new Date(String(row.locked_at)).getTime();
      if (!Number.isFinite(lockedAtMs)) return false;
      const timeoutSeconds = clampInt(
        toNumber(row.processing_timeout_seconds, 300),
        60,
        3600,
      );
      return lockedAtMs + timeoutSeconds * 1000 < nowMs;
    })
    .map((row) => String(row.id));

  if (staleIds.length > 0) {
    const staleResetRes = await client
      .from("ai_job_queue")
      .update({
        status: "pending",
        locked_at: null,
        locked_by: null,
        started_at: null,
        run_after: new Date().toISOString(),
      })
      .in("id", staleIds)
      .eq("status", "processing");
    if (staleResetRes.error) {
      throw new Error(staleResetRes.error.message);
    }
  }

  const claimRes = await client.rpc("claim_ai_jobs", {
    p_worker_id: input.workerId,
    p_limit: input.limit,
  });
  if (claimRes.error) {
    throw new Error(claimRes.error.message);
  }

  return (claimRes.data ?? []) as QueueJobRow[];
}

async function markJobCompleted(client: SupabaseClient, jobId: string) {
  const updateRes = await client
    .from("ai_job_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_by: null,
      locked_at: null,
      error_message: null,
    })
    .eq("id", jobId);
  if (updateRes.error) throw new Error(updateRes.error.message);
}

async function markJobFailed(
  client: SupabaseClient,
  job: QueueJobRow,
  errorMessage: string,
) {
  const attempts = toNumber(job.attempts, 1);
  const maxAttempts = clampInt(toNumber(job.max_attempts, 5), 1, 10);
  const terminal = attempts >= maxAttempts;
  const retryDelayMs = attempts * 2 * 60 * 1000;
  const runAfter = new Date(Date.now() + retryDelayMs).toISOString();

  const updateRes = await client
    .from("ai_job_queue")
    .update({
      status: terminal ? "failed" : "pending",
      run_after: terminal ? job.run_after : runAfter,
      locked_by: null,
      locked_at: null,
      completed_at: terminal ? new Date().toISOString() : null,
      error_message: errorMessage.slice(0, 500),
    })
    .eq("id", job.id);
  if (updateRes.error) throw new Error(updateRes.error.message);

  return {
    status: terminal ? "failed" : "pending",
    runAfter: terminal ? null : runAfter,
  };
}

async function refreshUserTrainingStatsSnapshot(
  client: SupabaseClient,
  userId: string,
  referenceDate: string,
) {
  const fromDate = daysAgoDateKey(referenceDate, 6);
  const consistencyFromDate = daysAgoDateKey(referenceDate, 13);

  const [logsRes, recoveryRes, calendarRes, trainingLoadState] = await Promise.all([
    client
      .from("workout_logs")
      .select("id,workout_date,status")
      .eq("user_id", userId)
      .gte("workout_date", fromDate)
      .lte("workout_date", referenceDate),
    client
      .from("recovery_metrics")
      .select("fatigue_score,readiness_score,metric_date")
      .eq("user_id", userId)
      .lte("metric_date", referenceDate)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("calendar_status")
      .select("status")
      .eq("user_id", userId)
      .gte("status_date", consistencyFromDate)
      .lte("status_date", referenceDate),
    getTrainingLoadState({
      client,
      profileId: userId,
    }),
  ]);
  if (logsRes.error) throw new Error(logsRes.error.message);
  if (recoveryRes.error) throw new Error(recoveryRes.error.message);
  if (calendarRes.error) throw new Error(calendarRes.error.message);

  const completedLogs = (logsRes.data ?? []).filter(
    (row) => row.status === "completed",
  );
  const logIds = completedLogs.map((row) => String(row.id));

  const volumeRes =
    logIds.length > 0
      ? await client
          .from("workout_log_exercises")
          .select("total_volume_kg")
          .eq("user_id", userId)
          .in("workout_log_id", logIds)
      : { data: [], error: null };
  if (volumeRes.error) throw new Error(volumeRes.error.message);

  const weeklyVolumeKg = Number(
    (volumeRes.data ?? [])
      .reduce((sum, row) => sum + toNumber(row.total_volume_kg, 0), 0)
      .toFixed(2),
  );

  const streakDays = computeDateStreak(
    completedLogs.map((row) => String(row.workout_date)),
  );

  const trackedDays = (calendarRes.data ?? []).filter(
    (row) => row.status !== "rest_day",
  );
  const completedDays = trackedDays.filter((row) => row.status === "completed");
  const consistencyScore =
    trackedDays.length > 0
      ? Number(((completedDays.length / trackedDays.length) * 100).toFixed(2))
      : 0;

  const fatigueScore = recoveryRes.data
    ? toNumber(recoveryRes.data.fatigue_score, 0)
    : null;
  const readinessScore = recoveryRes.data
    ? toNumber(recoveryRes.data.readiness_score, 0)
    : null;

  const snapshotPayload = {
    user_id: userId,
    snapshot_date: referenceDate,
    week_start_date: weekStartDateKey(referenceDate),
    workouts_completed_7d: completedLogs.length,
    weekly_volume_kg: weeklyVolumeKg,
    streak_days: streakDays,
    fatigue_score: fatigueScore,
    readiness_score: readinessScore,
    consistency_score: consistencyScore,
    acwr: trainingLoadState?.acwr ?? null,
    overtraining_risk: trainingLoadState?.overtraining_risk ?? null,
    optimal_volume_kg: trainingLoadState?.optimal_volume_kg ?? null,
    updated_at: new Date().toISOString(),
  };

  let upsertRes = await client.from("user_training_stats").upsert(
    snapshotPayload,
    { onConflict: "user_id,snapshot_date" },
  );
  if (upsertRes.error && upsertRes.error.code === "42703") {
    const legacyPayload = {
      user_id: snapshotPayload.user_id,
      snapshot_date: snapshotPayload.snapshot_date,
      week_start_date: snapshotPayload.week_start_date,
      workouts_completed_7d: snapshotPayload.workouts_completed_7d,
      weekly_volume_kg: snapshotPayload.weekly_volume_kg,
      streak_days: snapshotPayload.streak_days,
      fatigue_score: snapshotPayload.fatigue_score,
      readiness_score: snapshotPayload.readiness_score,
      consistency_score: snapshotPayload.consistency_score,
      updated_at: snapshotPayload.updated_at,
    };
    upsertRes = await client.from("user_training_stats").upsert(
      legacyPayload,
      { onConflict: "user_id,snapshot_date" },
    );
  }
  if (upsertRes.error) throw new Error(upsertRes.error.message);
}

async function refreshExerciseVolumeStatsSnapshot(
  client: SupabaseClient,
  userId: string,
  referenceDate: string,
) {
  const weekStart = weekStartDateKey(referenceDate);
  const nextWeekDate = parseDateOnly(weekStart);
  nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);

  const setsRes = await client
    .from("workout_log_sets")
    .select("workout_log_exercise_id,actual_reps,actual_weight_kg,set_status,performed_at")
    .eq("user_id", userId)
    .eq("set_status", "completed")
    .gte("performed_at", `${weekStart}T00:00:00.000Z`)
    .lt("performed_at", nextWeekDate.toISOString());
  if (setsRes.error) throw new Error(setsRes.error.message);

  const exerciseIds = Array.from(
    new Set(
      (setsRes.data ?? []).map((row) => String(row.workout_log_exercise_id ?? "")).filter(Boolean),
    ),
  );

  const logExercisesRes =
    exerciseIds.length > 0
      ? await client
          .from("workout_log_exercises")
          .select("id,exercise_id")
          .eq("user_id", userId)
          .in("id", exerciseIds)
      : { data: [], error: null };
  if (logExercisesRes.error) throw new Error(logExercisesRes.error.message);

  const exerciseByLogExerciseId = new Map<string, string>();
  (logExercisesRes.data ?? []).forEach((row) => {
    if (!row.exercise_id) return;
    exerciseByLogExerciseId.set(String(row.id), String(row.exercise_id));
  });

  const aggregates = new Map<
    string,
    {
      setsCompleted: number;
      repsCompleted: number;
      weeklyVolumeKg: number;
      bestWeightKg: number;
      bestEstimated1rm: number;
    }
  >();

  (setsRes.data ?? []).forEach((row) => {
    const exerciseId = exerciseByLogExerciseId.get(String(row.workout_log_exercise_id));
    if (!exerciseId) return;
    const reps = Math.max(0, toNumber(row.actual_reps, 0));
    const weight = Math.max(0, toNumber(row.actual_weight_kg, 0));
    const current = aggregates.get(exerciseId) ?? {
      setsCompleted: 0,
      repsCompleted: 0,
      weeklyVolumeKg: 0,
      bestWeightKg: 0,
      bestEstimated1rm: 0,
    };
    current.setsCompleted += 1;
    current.repsCompleted += reps;
    current.weeklyVolumeKg += reps * weight;
    current.bestWeightKg = Math.max(current.bestWeightKg, weight);
    current.bestEstimated1rm = Math.max(
      current.bestEstimated1rm,
      estimated1rm(weight, reps),
    );
    aggregates.set(exerciseId, current);
  });

  const deleteRes = await client
    .from("exercise_volume_stats")
    .delete()
    .eq("user_id", userId)
    .eq("week_start_date", weekStart);
  if (deleteRes.error) throw new Error(deleteRes.error.message);

  if (aggregates.size === 0) return;

  const rows = Array.from(aggregates.entries()).map(([exerciseId, value]) => ({
    user_id: userId,
    exercise_id: exerciseId,
    week_start_date: weekStart,
    sets_completed: value.setsCompleted,
    reps_completed: value.repsCompleted,
    weekly_volume_kg: Number(value.weeklyVolumeKg.toFixed(2)),
    best_weight_kg: Number(value.bestWeightKg.toFixed(2)),
    best_estimated_1rm: Number(value.bestEstimated1rm.toFixed(2)),
    updated_at: new Date().toISOString(),
  }));

  const insertRes = await client.from("exercise_volume_stats").insert(rows);
  if (insertRes.error) throw new Error(insertRes.error.message);
}

async function processJob(client: SupabaseClient, job: QueueJobRow) {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const recommendationInput = extractRecommendationInput(payload);
  const profileContext = { client, profileId: job.user_id };
  const workoutLogId =
    typeof payload.workoutLogId === "string" && payload.workoutLogId.trim().length > 0
      ? payload.workoutLogId.trim()
      : undefined;

  if (job.job_type === "analytics_snapshot") {
    const workoutDate = recommendationInput.workoutDate;
    await Promise.all([
      refreshUserTrainingStatsSnapshot(client, job.user_id, workoutDate),
      refreshExerciseVolumeStatsSnapshot(client, job.user_id, workoutDate),
    ]);
    return;
  }
  if (job.job_type === "leaderboard_refresh") {
    await refreshLeaderboardForUser(profileContext);
    return;
  }

  if (
    job.job_type === "session_finished" ||
    job.job_type === "manual_workout_logged"
  ) {
    await updateExerciseAdaptationState(profileContext, {
      workoutDate: recommendationInput.workoutDate,
      workoutLogId,
    });
  }

  if (
    job.job_type === "session_finished" ||
    job.job_type === "manual_workout_logged" ||
    job.job_type === "recovery_updated"
  ) {
    await recomputeRecoveryState(profileContext, {
      referenceDate: recommendationInput.workoutDate,
    });
  }

  if (
    job.job_type === "session_finished" ||
    job.job_type === "manual_workout_logged" ||
    job.job_type === "daily_refresh"
  ) {
    await recomputeTrainingLoadState(profileContext, {
      referenceDate: recommendationInput.workoutDate,
    });
  }

  await primeWorkoutRecommendationCache(profileContext, recommendationInput);

  if (
    job.job_type === "on_demand_refresh" ||
    job.job_type === "recommendation_refresh" ||
    job.job_type === "plan_updated" ||
    job.job_type === "recovery_updated"
  ) {
    return;
  }

  const workoutDate = recommendationInput.workoutDate;
  await Promise.all([
    refreshLeaderboardForUser(profileContext),
    refreshUserTrainingStatsSnapshot(client, job.user_id, workoutDate),
    refreshExerciseVolumeStatsSnapshot(client, job.user_id, workoutDate),
  ]);
}

export async function processAiJobQueue(
  client: SupabaseClient,
  options?: ProcessOptions,
): Promise<ProcessSummary> {
  const input: Required<ProcessOptions> = {
    limit: clampInt(options?.limit ?? DEFAULT_BATCH_LIMIT, 1, 200),
    workerId: options?.workerId ?? "api-worker",
  };
  const claimedJobs = await claimPendingJobs(client, input);

  let completed = 0;
  let failed = 0;

  for (const job of claimedJobs) {
    const startedAtMs = Date.now();
    logger.info({
      scope: "ai-worker.job",
      message: "Job claimed",
      meta: {
        job_id: job.id,
        job_type: job.job_type,
        user_id: job.user_id,
        duration_ms: 0,
        status: "processing",
      },
    });
    try {
      await processJob(client, job);
      await markJobCompleted(client, job.id);
      completed += 1;
      logger.info({
        scope: "ai-worker.job",
        message: "Job completed",
        meta: {
          job_id: job.id,
          job_type: job.job_type,
          user_id: job.user_id,
          duration_ms: Date.now() - startedAtMs,
          status: "completed",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown worker processing error";
      const failedState = await markJobFailed(client, job, message);
      failed += 1;
      logger.warn({
        scope: "ai-worker.job",
        message: "Job failed",
        meta: {
          job_id: job.id,
          job_type: job.job_type,
          user_id: job.user_id,
          duration_ms: Date.now() - startedAtMs,
          status: failedState.status,
          error: message,
        },
      });
      if (failedState.status === "pending") {
        logger.warn({
          scope: "ai-worker.job",
          message: "Retry scheduled",
          meta: {
            job_id: job.id,
            job_type: job.job_type,
            user_id: job.user_id,
            duration_ms: Date.now() - startedAtMs,
            status: "retry_scheduled",
            run_after: failedState.runAfter,
          },
        });
      }
    }
  }

  return {
    claimed: claimedJobs.length,
    completed,
    failed,
  };
}
