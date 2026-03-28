import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { buildCoachInsight } from "@/lib/workout-planner/insightEngine";
import {
  getWorkoutRecommendations,
  isNoWorkoutPlanError,
} from "@/lib/workout-planner/service";
import type { ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function assertIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
}

function parseOptionalInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a number`);
  }
  const floored = Math.floor(parsed);
  if (floored < min || floored > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
  return floored;
}

function parseRequestInput(input: {
  workoutDate?: unknown;
  planId?: unknown;
  dayIndex?: unknown;
  lookbackDays?: unknown;
}) {
  const workoutDate =
    typeof input.workoutDate === "string" && input.workoutDate.trim().length > 0
      ? input.workoutDate.trim()
      : todayUtcDateKey();
  assertIsoDate(workoutDate, "workoutDate");

  const planId =
    typeof input.planId === "string" && input.planId.trim().length > 0
      ? input.planId.trim()
      : undefined;

  const dayIndex = parseOptionalInteger(input.dayIndex, "dayIndex", 1, 7);
  const lookbackDays = parseOptionalInteger(
    input.lookbackDays,
    "lookbackDays",
    14,
    90,
  );

  return {
    workoutDate,
    planId,
    dayIndex,
    lookbackDays,
  };
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toActionLabel(action: ExerciseRecommendation["progression_action"]) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildDedupeKey(
  profileId: string,
  input: {
    workoutDate: string;
    planId?: string;
    dayIndex?: number;
    lookbackDays?: number;
  },
) {
  return [
    "recommendation_refresh",
    profileId,
    input.planId ?? "active",
    input.workoutDate,
    String(input.dayIndex ?? "auto"),
    String(input.lookbackDays ?? 42),
  ].join(":");
}

function buildRecoveryRecommendation(
  recoveryState: {
    readiness_score?: number | null;
    fatigue_score?: number | null;
  } | null,
  trainingLoadState: {
    overtraining_risk?: number | null;
    plateau_risk?: number | null;
    acwr?: number | null;
  } | null,
) {
  const readiness = toNullableNumber(recoveryState?.readiness_score);
  const fatigue = toNullableNumber(recoveryState?.fatigue_score);
  const overtrainingRisk = toNullableNumber(trainingLoadState?.overtraining_risk);
  const plateauRisk = toNullableNumber(trainingLoadState?.plateau_risk);
  const acwr = toNullableNumber(trainingLoadState?.acwr);

  if (
    readiness === null &&
    fatigue === null &&
    overtrainingRisk === null &&
    plateauRisk === null &&
    acwr === null
  ) {
    return "Recovery guidance will appear after a few logged workouts or recovery check-ins.";
  }

  if (
    (readiness !== null && readiness < 30) ||
    (overtrainingRisk !== null && overtrainingRisk >= 80) ||
    (acwr !== null && acwr > 1.6)
  ) {
    return "Recovery priority: reduce load, extend rest, and prioritize technique quality today.";
  }
  if (
    (readiness !== null && readiness < 40) ||
    (fatigue !== null && fatigue >= 70) ||
    (overtrainingRisk !== null && overtrainingRisk >= 65)
  ) {
    return "Moderate fatigue detected: keep volume controlled and avoid grinding sets.";
  }
  if (plateauRisk !== null && plateauRisk >= 70 && readiness !== null && readiness >= 55) {
    return "Plateau detected: add a small overload stimulus with strict execution.";
  }
  return "Readiness is stable: follow the prescribed session and progress gradually.";
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-today",
      limit: 180,
      windowSeconds: 60,
    });

    const parsed = parseRequestInput({
      workoutDate: request.nextUrl.searchParams.get("workoutDate"),
      planId: request.nextUrl.searchParams.get("planId"),
      dayIndex: request.nextUrl.searchParams.get("dayIndex"),
      lookbackDays: request.nextUrl.searchParams.get("lookbackDays"),
    });

    let recommendationRead: Awaited<ReturnType<typeof getWorkoutRecommendations>> | null =
      null;
    let requiresPlan = false;
    try {
      recommendationRead = await getWorkoutRecommendations(
        { client: api.client, profileId: api.current.profileId },
        parsed,
      );

      const shouldEnqueue =
        recommendationRead.cacheState !== "exact" || recommendationRead.cacheTtl.isStale;

      if (shouldEnqueue) {
        await scheduleAiJob(api.adminClient, {
          scope: "workout.today.refresh",
          swallowErrors: true,
          userId: api.current.profileId,
          jobType: "recommendation_refresh",
          payload: parsed,
          dedupeKey: buildDedupeKey(api.current.profileId, parsed),
        });
      }
    } catch (recommendationError) {
      if (!isNoWorkoutPlanError(recommendationError)) {
        throw recommendationError;
      }
      requiresPlan = true;
    }

    if (requiresPlan) {
      const [recoveryRes, loadRes] = await Promise.all([
        api.client
          .from("recovery_state")
          .select("readiness_score,fatigue_score,sleep_minutes,hrv,soreness,stress,updated_at")
          .eq("user_id", api.current.profileId)
          .maybeSingle(),
        api.client
          .from("training_load_state")
          .select(
            "acwr,fatigue_trend,plateau_risk,volume_trend_pct,overtraining_risk,optimal_volume_kg,updated_at",
          )
          .eq("user_id", api.current.profileId)
          .maybeSingle(),
      ]);

      return NextResponse.json({
        requiresPlan: true,
        workoutDate: parsed.workoutDate,
        cacheState: "baseline",
        cacheTtl: null,
        plan: null,
        recommendations: null,
        previewExercises: [],
        recoveryState: recoveryRes.error ? null : recoveryRes.data ?? null,
        trainingLoadState: loadRes.error ? null : loadRes.data ?? null,
        recoveryRecommendation:
          "Generate your first workout plan to unlock adaptive recommendations.",
        coachInsight: buildCoachInsight({
          requiresPlan: true,
          recovery: recoveryRes.error ? null : recoveryRes.data ?? null,
          trainingLoad: loadRes.error ? null : loadRes.data ?? null,
          cacheState: "baseline",
          cacheTtl: null,
        }),
      });
    }

    const recommendationResult = recommendationRead!.recommendations;
    const planId = recommendationResult.plan_id;

    const [planRes, recoveryRes, loadRes] = await Promise.all([
      api.client
        .from("workout_plans")
        .select(
          "id,name,goal,experience_level,workout_days_per_week,muscle_split,is_active,created_at",
        )
        .eq("id", planId)
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
      api.client
        .from("recovery_state")
        .select("readiness_score,fatigue_score,sleep_minutes,hrv,soreness,stress,updated_at")
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
      api.client
        .from("training_load_state")
        .select(
          "acwr,fatigue_trend,plateau_risk,volume_trend_pct,overtraining_risk,optimal_volume_kg,updated_at",
        )
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
    ]);

    if (planRes.error) {
      throw new Error(planRes.error.message);
    }
    if (
      recoveryRes.error &&
      recoveryRes.error.code !== "42P01" &&
      recoveryRes.error.code !== "42703"
    ) {
      throw new Error(recoveryRes.error.message);
    }
    if (
      loadRes.error &&
      loadRes.error.code !== "42P01" &&
      loadRes.error.code !== "42703"
    ) {
      throw new Error(loadRes.error.message);
    }

    const planExerciseIds = Array.from(
      new Set(
        recommendationResult.recommendations
          .map((row) => row.plan_exercise_id)
          .filter(Boolean),
      ),
    );
    const planExercisesRes =
      planExerciseIds.length > 0
        ? await api.client
            .from("workout_plan_exercises")
            .select("id,exercise_name,muscle_group,exercise_order")
            .in("id", planExerciseIds)
        : { data: [], error: null };
    if (planExercisesRes.error) {
      throw new Error(planExercisesRes.error.message);
    }
    const planExerciseMap = new Map(
      (planExercisesRes.data ?? []).map((row) => [
        String(row.id),
        {
          exercise_name: String(row.exercise_name ?? "Exercise"),
          muscle_group: String(row.muscle_group ?? "general"),
          exercise_order: Number(row.exercise_order ?? 1),
        },
      ]),
    );

    const previewExercises = recommendationResult.recommendations
      .map((row) => {
        const details = planExerciseMap.get(row.plan_exercise_id);
        return {
          plan_exercise_id: row.plan_exercise_id,
          exercise_id: row.exercise_id,
          exercise_name: details?.exercise_name ?? "Exercise",
          muscle_group: details?.muscle_group ?? "general",
          exercise_order: details?.exercise_order ?? 1,
          recommended_sets: row.recommended_sets,
          recommended_reps: row.recommended_reps,
          recommended_weight: row.recommended_weight,
          rest_seconds: row.rest_seconds,
          progression_action: row.progression_action,
          progression_label: toActionLabel(row.progression_action),
          recommendation_reason: row.recommendation_reason,
        };
      })
      .sort((a, b) => a.exercise_order - b.exercise_order);

    const recoveryState = recoveryRes.error ? null : recoveryRes.data ?? null;
    const trainingLoadState = loadRes.error ? null : loadRes.data ?? null;
    const coachInsight = buildCoachInsight({
      recommendations: recommendationResult.recommendations,
      recovery: recoveryState,
      trainingLoad: trainingLoadState,
      previewExercises,
      cacheState: recommendationRead!.cacheState,
      cacheTtl: recommendationRead!.cacheTtl,
    });

    return NextResponse.json({
      requiresPlan: false,
      workoutDate: parsed.workoutDate,
      cacheState: recommendationRead!.cacheState,
      cacheTtl: recommendationRead!.cacheTtl,
      plan: planRes.data ?? null,
      recommendations: recommendationResult,
      previewExercises,
      recoveryState,
      trainingLoadState,
      recoveryRecommendation: buildRecoveryRecommendation(
        recoveryState,
        trainingLoadState,
      ),
      coachInsight,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load today's workout", {
      scope: "workout.today",
    });
  }
}
