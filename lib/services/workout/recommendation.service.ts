import { getNextWorkoutRecommendations, type TrainingIntelligenceRequest, type TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";
import { applyTrainingBrain } from "@/lib/workout-planner/trainingBrain";
import type { ServiceContext, NormalizedRecommendationRequest, WorkoutRecommendationRead } from "./types";
import { clampIntValue, parseNumeric, toDayIndex } from "./utils";

const RECOMMENDATION_LOOKBACK_MIN = 14;
const RECOMMENDATION_LOOKBACK_MAX = 90;
const RECOMMENDATION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const NO_WORKOUT_PLAN_ERROR = "No workout plan available";

function normalizeRecommendationInput(
  input: TrainingIntelligenceRequest,
): NormalizedRecommendationRequest {
  const workoutDate =
    typeof input.workoutDate === "string" ? input.workoutDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
    throw new Error("workoutDate must be YYYY-MM-DD");
  }

  const lookbackDays = clampIntValue(
    input.lookbackDays ?? 42,
    RECOMMENDATION_LOOKBACK_MIN,
    RECOMMENDATION_LOOKBACK_MAX,
  );
  const dayIndex = clampIntValue(
    input.dayIndex ?? toDayIndex(workoutDate),
    1,
    7,
  );
  const planId =
    typeof input.planId === "string" && input.planId.trim().length > 0
      ? input.planId.trim()
      : undefined;

  return {
    workoutDate,
    planId,
    dayIndex,
    lookbackDays,
  };
}

async function resolvePlanIdForRecommendations(
  context: ServiceContext,
  explicitPlanId?: string,
) {
  if (explicitPlanId) {
    return explicitPlanId;
  }

  const activePlan = await context.client
    .from("workout_plans")
    .select("id")
    .eq("user_id", context.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePlan.error) {
    throw new Error(activePlan.error.message);
  }
  if (activePlan.data?.id) {
    return String(activePlan.data.id);
  }

  const fallbackPlan = await context.client
    .from("workout_plans")
    .select("id")
    .eq("user_id", context.profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackPlan.error) {
    throw new Error(fallbackPlan.error.message);
  }
  if (!fallbackPlan.data?.id) {
    throw new Error(NO_WORKOUT_PLAN_ERROR);
  }

  return String(fallbackPlan.data.id);
}

export function isNoWorkoutPlanError(error: unknown) {
  return error instanceof Error && error.message === NO_WORKOUT_PLAN_ERROR;
}

function isMissingRecommendationCacheTable(errorCode: string | null | undefined) {
  return errorCode === "42P01" || errorCode === "42703";
}

async function loadCachedWorkoutRecommendations(
  context: ServiceContext,
  input: {
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
    allowStale?: boolean;
  },
) {
  const cacheRes = await context.client
    .from("ai_recommendations")
    .select("result_json,generated_at,updated_at")
    .eq("user_id", context.profileId)
    .eq("plan_id", input.planId)
    .eq("workout_date", input.workoutDate)
    .eq("day_index", input.dayIndex)
    .eq("lookback_days", input.lookbackDays)
    .limit(1)
    .maybeSingle();

  if (cacheRes.error) {
    if (isMissingRecommendationCacheTable(cacheRes.error.code)) {
      return null;
    }
    throw new Error(cacheRes.error.message);
  }

  if (!cacheRes.data) return null;
  const generatedAtMs = new Date(String(cacheRes.data.generated_at ?? "")).getTime();
  const isFresh =
    Number.isFinite(generatedAtMs) &&
    Date.now() - generatedAtMs <= RECOMMENDATION_CACHE_MAX_AGE_MS;
  if (!isFresh && !input.allowStale) return null;

  const payload = cacheRes.data.result_json as TrainingIntelligenceResult | null;
  if (!payload || typeof payload !== "object") return null;
  return {
    payload,
    ttl: {
      exists: true,
      isStale: !isFresh,
      updatedAt: cacheRes.data.updated_at
        ? String(cacheRes.data.updated_at)
        : cacheRes.data.generated_at
          ? String(cacheRes.data.generated_at)
          : null,
      planId: input.planId,
      workoutDate: input.workoutDate,
      dayIndex: input.dayIndex,
      lookbackDays: input.lookbackDays,
    },
  };
}

async function loadPlanFallbackWorkoutRecommendations(
  context: ServiceContext,
  input: { planId: string },
) {
  const cacheRes = await context.client
    .from("ai_recommendations")
    .select("result_json,generated_at")
    .eq("user_id", context.profileId)
    .eq("plan_id", input.planId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheRes.error) {
    if (isMissingRecommendationCacheTable(cacheRes.error.code)) {
      return null;
    }
    throw new Error(cacheRes.error.message);
  }

  const payload = cacheRes.data?.result_json as TrainingIntelligenceResult | null;
  if (!payload || typeof payload !== "object") return null;
  return payload;
}

async function buildBaselineWorkoutRecommendations(
  context: ServiceContext,
  input: { planId: string; workoutDate: string; dayIndex: number },
): Promise<TrainingIntelligenceResult> {
  const dayRowsRes = await context.client
    .from("workout_plan_exercises")
    .select(
      "id,day_index,exercise_order,exercise_id,sets,reps_min,reps_max,rest_seconds",
    )
    .eq("plan_id", input.planId)
    .eq("day_index", input.dayIndex)
    .order("exercise_order", { ascending: true });
  if (dayRowsRes.error) {
    throw new Error(dayRowsRes.error.message);
  }

  const rows = dayRowsRes.data ?? [];

  if (rows.length === 0) {
    const fallbackDayRes = await context.client
      .from("workout_plan_exercises")
      .select(
        "id,day_index,exercise_order,exercise_id,sets,reps_min,reps_max,rest_seconds",
      )
      .eq("plan_id", input.planId)
      .order("day_index", { ascending: true })
      .order("exercise_order", { ascending: true })
      .limit(100);
    if (fallbackDayRes.error) {
      throw new Error(fallbackDayRes.error.message);
    }
    const firstDay = fallbackDayRes.data?.[0]?.day_index;
    const fallbackRows =
      firstDay === undefined || firstDay === null
        ? []
        : (fallbackDayRes.data ?? []).filter((row) => row.day_index === firstDay);
    return {
      plan_id: input.planId,
      workout_date: input.workoutDate,
      effective_day_index: Number(firstDay ?? input.dayIndex),
      readiness_band: "yellow",
      readiness_score: null,
      fatigue_score: 50,
      adherence_score: 50,
      recommendations: fallbackRows.map((row) => ({
        exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        original_exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        plan_exercise_id: String(row.id),
        recommended_weight: null,
        recommended_reps: {
          min: clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
          max: clampIntValue(parseNumeric(row.reps_max, 12), 1, 120),
        },
        recommended_sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
        rest_seconds: clampIntValue(parseNumeric(row.rest_seconds, 60), 15, 900),
        exercise_substitution: null,
        progression_action: "maintain" as const,
        recommendation_reason: [
          "Using baseline plan while AI cache is being prepared.",
        ],
        metrics: {
          latest_e1rm: null,
          weekly_volume_kg: 0,
          volume_trend_7d_pct: 0,
          strength_rate_pct_week: null,
          recent_avg_reps: null,
          recent_avg_rpe: null,
          failed_sets_recent: 0,
        },
      })),
    };
  }

  return {
    plan_id: input.planId,
    workout_date: input.workoutDate,
    effective_day_index: input.dayIndex,
    readiness_band: "yellow",
    readiness_score: null,
    fatigue_score: 50,
    adherence_score: 50,
    recommendations: rows.map((row) => ({
      exercise_id: row.exercise_id ? String(row.exercise_id) : null,
      original_exercise_id: row.exercise_id ? String(row.exercise_id) : null,
      plan_exercise_id: String(row.id),
      recommended_weight: null,
      recommended_reps: {
        min: clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
        max: clampIntValue(parseNumeric(row.reps_max, 12), 1, 120),
      },
      recommended_sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
      rest_seconds: clampIntValue(parseNumeric(row.rest_seconds, 60), 15, 900),
      exercise_substitution: null,
      progression_action: "maintain" as const,
      recommendation_reason: [
        "Using baseline plan while AI cache is being prepared.",
      ],
      metrics: {
        latest_e1rm: null,
        weekly_volume_kg: 0,
        volume_trend_7d_pct: 0,
        strength_rate_pct_week: null,
        recent_avg_reps: null,
        recent_avg_rpe: null,
        failed_sets_recent: 0,
      },
    })),
  };
}

async function upsertWorkoutRecommendationCache(
  context: ServiceContext,
  input: {
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
    result: TrainingIntelligenceResult;
  },
) {
  const upsertRes = await context.client.from("ai_recommendations").upsert(
    {
      user_id: context.profileId,
      plan_id: input.planId,
      workout_date: input.workoutDate,
      day_index: input.dayIndex,
      lookback_days: input.lookbackDays,
      result_json: input.result,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,plan_id,workout_date,day_index,lookback_days",
    },
  );

  if (upsertRes.error && !isMissingRecommendationCacheTable(upsertRes.error.code)) {
    throw new Error(upsertRes.error.message);
  }
}

export async function getWorkoutRecommendations(
  context: ServiceContext,
  input: TrainingIntelligenceRequest,
): Promise<WorkoutRecommendationRead> {
  const normalized = normalizeRecommendationInput(input);
  const planId = await resolvePlanIdForRecommendations(context, normalized.planId);
  const cacheTtl = {
    exists: false,
    isStale: false,
    updatedAt: null as string | null,
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
  };
  const cacheHit = await loadCachedWorkoutRecommendations(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
    allowStale: true,
  });
  if (cacheHit) {
    return {
      recommendations: cacheHit.payload,
      cacheState: "exact",
      cacheTtl: cacheHit.ttl,
    };
  }

  const planFallback = await loadPlanFallbackWorkoutRecommendations(context, {
    planId,
  });
  if (planFallback) {
    return {
      recommendations: planFallback,
      cacheState: "plan_fallback",
      cacheTtl,
    };
  }

  const baseline = await buildBaselineWorkoutRecommendations(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
  });
  return {
    recommendations: baseline,
    cacheState: "baseline",
    cacheTtl,
  };
}

export async function primeWorkoutRecommendationCache(
  context: ServiceContext,
  input: TrainingIntelligenceRequest,
) {
  const normalized = normalizeRecommendationInput(input);
  const planId = await resolvePlanIdForRecommendations(context, normalized.planId);
  const baseResult = await getNextWorkoutRecommendations(
    { client: context.client, profileId: context.profileId },
    {
      workoutDate: normalized.workoutDate,
      lookbackDays: normalized.lookbackDays,
      dayIndex: normalized.dayIndex,
      planId,
    },
  );
  const result = await applyTrainingBrain(
    { client: context.client, profileId: context.profileId },
    {
      workoutDate: normalized.workoutDate,
      result: baseResult,
    },
  );
  await upsertWorkoutRecommendationCache(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
    result,
  });
  return result;
}