import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import type { ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";

type StartPayload = {
  workoutLogId?: unknown;
  recommendations?: unknown;
};

type RecommendationInput = Pick<
  ExerciseRecommendation,
  | "plan_exercise_id"
  | "exercise_id"
  | "recommended_weight"
  | "recommended_reps"
  | "recommended_sets"
  | "rest_seconds"
  | "progression_action"
  | "recommendation_reason"
>;

type RecommendationMapValue = {
  exercise_id: string | null;
  recommended_weight: number | null;
  recommended_reps: { min: number; max: number };
  recommended_sets: number;
  rest_seconds: number;
  progression_action: ExerciseRecommendation["progression_action"];
  recommendation_reason: string[];
};

function toErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "Unauthorized"
      ? 401
      : message === "Rate limit exceeded"
        ? 429
        : 400;
  return NextResponse.json({ error: message }, { status });
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseRecommendation(input: unknown): RecommendationInput {
  if (!input || typeof input !== "object") {
    throw new Error("recommendations contains an invalid item");
  }
  const row = input as Record<string, unknown>;
  const planExerciseId = String(row.plan_exercise_id ?? "").trim();
  if (!planExerciseId) {
    throw new Error("recommendations.plan_exercise_id is required");
  }

  const progressionAction = String(row.progression_action ?? "maintain").trim();
  const allowedActions = new Set([
    "increase",
    "maintain",
    "reduce",
    "deload",
    "substitute",
  ]);
  if (!allowedActions.has(progressionAction)) {
    throw new Error("recommendations.progression_action is invalid");
  }

  const repsObject =
    row.recommended_reps && typeof row.recommended_reps === "object"
      ? (row.recommended_reps as Record<string, unknown>)
      : null;
  const repsMin = Math.max(1, Math.floor(parseNumber(repsObject?.min, 6)));
  const repsMax = Math.max(repsMin, Math.floor(parseNumber(repsObject?.max, repsMin)));

  const reasonArray = Array.isArray(row.recommendation_reason)
    ? row.recommendation_reason
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0)
    : [];

  return {
    plan_exercise_id: planExerciseId,
    exercise_id:
      typeof row.exercise_id === "string" && row.exercise_id.trim().length > 0
        ? row.exercise_id.trim()
        : null,
    recommended_weight:
      row.recommended_weight === null || row.recommended_weight === undefined
        ? null
        : Number(parseNumber(row.recommended_weight, 0).toFixed(2)),
    recommended_reps: {
      min: repsMin,
      max: repsMax,
    },
    recommended_sets: Math.max(1, Math.min(20, Math.floor(parseNumber(row.recommended_sets, 3)))),
    rest_seconds: Math.max(15, Math.min(900, Math.floor(parseNumber(row.rest_seconds, 60)))),
    progression_action:
      progressionAction as ExerciseRecommendation["progression_action"],
    recommendation_reason: reasonArray,
  };
}

function parsePayload(payload: StartPayload) {
  const workoutLogId =
    typeof payload.workoutLogId === "string" ? payload.workoutLogId.trim() : "";
  if (!workoutLogId) {
    throw new Error("workoutLogId is required");
  }

  const recommendationsRaw = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : [];
  const recommendations = recommendationsRaw.map(parseRecommendation);

  return {
    workoutLogId,
    recommendations,
  };
}

function buildRecommendationMap(recommendations: RecommendationInput[]) {
  const map = new Map<string, RecommendationMapValue>();
  recommendations.forEach((row) => {
    map.set(row.plan_exercise_id, {
      exercise_id: row.exercise_id,
      recommended_weight: row.recommended_weight,
      recommended_reps: row.recommended_reps,
      recommended_sets: row.recommended_sets,
      rest_seconds: row.rest_seconds,
      progression_action: row.progression_action,
      recommendation_reason: row.recommendation_reason,
    });
  });
  return map;
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-start",
      limit: 120,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as StartPayload;
    const parsed = parsePayload(payload);

    const logRes = await api.client
      .from("workout_logs")
      .select("id,user_id,workout_date,status,started_at")
      .eq("id", parsed.workoutLogId)
      .eq("user_id", api.current.profileId)
      .maybeSingle();
    if (logRes.error) {
      throw new Error(logRes.error.message);
    }
    if (!logRes.data) {
      throw new Error("Workout log not found for current user");
    }

    if (parsed.recommendations.length === 0) {
      return NextResponse.json({
        workoutLog: logRes.data,
        exercises: [],
      });
    }

    const planExerciseIds = Array.from(
      new Set(parsed.recommendations.map((row) => row.plan_exercise_id)),
    );
    const planRowsRes = await api.client
      .from("workout_plan_exercises")
      .select("id,exercise_name,muscle_group,exercise_order,rpe")
      .in("id", planExerciseIds);
    if (planRowsRes.error) {
      throw new Error(planRowsRes.error.message);
    }
    const planMap = new Map(
      (planRowsRes.data ?? []).map((row) => [
        String(row.id),
        {
          exercise_name: String(row.exercise_name ?? "Exercise"),
          muscle_group: String(row.muscle_group ?? ""),
          exercise_order: Math.max(1, Math.floor(parseNumber(row.exercise_order, 1))),
          rpe: row.rpe === null || row.rpe === undefined ? null : parseNumber(row.rpe, 0),
        },
      ]),
    );

    const upsertPayload = parsed.recommendations.map((row, index) => {
      const plan = planMap.get(row.plan_exercise_id);
      return {
        workout_log_id: parsed.workoutLogId,
        user_id: api.current.profileId,
        plan_exercise_id: row.plan_exercise_id,
        exercise_id: row.exercise_id,
        exercise_name: plan?.exercise_name ?? `Exercise ${index + 1}`,
        muscle_group: plan?.muscle_group ?? null,
        exercise_order: plan?.exercise_order ?? index + 1,
        planned_sets: row.recommended_sets,
        planned_reps_min: row.recommended_reps.min,
        planned_reps_max: row.recommended_reps.max,
        planned_rest_seconds: row.rest_seconds,
        planned_rpe: plan?.rpe ?? null,
        status: "in_progress",
        completed: false,
        updated_at: new Date().toISOString(),
      };
    });

    const exercisesRes = await api.client
      .from("workout_log_exercises")
      .upsert(upsertPayload, { onConflict: "workout_log_id,plan_exercise_id" })
      .select(
        "id,plan_exercise_id,exercise_id,exercise_name,muscle_group,exercise_order,planned_sets,planned_reps_min,planned_reps_max,planned_rest_seconds,completed_sets,total_reps,total_volume_kg,status,completed",
      )
      .order("exercise_order", { ascending: true });
    if (exercisesRes.error) {
      throw new Error(exercisesRes.error.message);
    }

    const exerciseRows = exercisesRes.data ?? [];
    const workoutLogExerciseIds = exerciseRows.map((row) => String(row.id));

    const setsRes =
      workoutLogExerciseIds.length > 0
        ? await api.client
            .from("workout_log_sets")
            .select(
              "id,workout_log_exercise_id,set_number,actual_weight_kg,actual_reps,actual_rpe,set_status,performed_at",
            )
            .eq("workout_log_id", parsed.workoutLogId)
            .eq("user_id", api.current.profileId)
            .in("workout_log_exercise_id", workoutLogExerciseIds)
            .order("set_number", { ascending: true })
        : { data: [], error: null };
    if (setsRes.error) {
      throw new Error(setsRes.error.message);
    }

    const setMap = new Map<string, Array<Record<string, unknown>>>();
    (setsRes.data ?? []).forEach((setRow) => {
      const key = String(setRow.workout_log_exercise_id);
      const current = setMap.get(key) ?? [];
      current.push(setRow as Record<string, unknown>);
      setMap.set(key, current);
    });

    const recommendationMap = buildRecommendationMap(parsed.recommendations);
    const responseRows = exerciseRows.map((row) => {
      const planExerciseId = String(row.plan_exercise_id ?? "");
      const recommendation = recommendationMap.get(planExerciseId);
      return {
        workout_log_exercise_id: String(row.id),
        plan_exercise_id: planExerciseId,
        exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        exercise_name: String(row.exercise_name ?? "Exercise"),
        muscle_group: String(row.muscle_group ?? ""),
        exercise_order: Math.max(1, Math.floor(parseNumber(row.exercise_order, 1))),
        recommended_sets: recommendation?.recommended_sets ?? parseNumber(row.planned_sets, 1),
        recommended_reps: {
          min:
            recommendation?.recommended_reps.min ??
            Math.max(1, Math.floor(parseNumber(row.planned_reps_min, 1))),
          max:
            recommendation?.recommended_reps.max ??
            Math.max(1, Math.floor(parseNumber(row.planned_reps_max, 1))),
        },
        recommended_weight: recommendation?.recommended_weight ?? null,
        rest_seconds:
          recommendation?.rest_seconds ??
          Math.max(15, Math.floor(parseNumber(row.planned_rest_seconds, 60))),
        progression_action: recommendation?.progression_action ?? "maintain",
        recommendation_reason: recommendation?.recommendation_reason ?? [],
        completed_sets: Math.max(0, Math.floor(parseNumber(row.completed_sets, 0))),
        total_reps: Math.max(0, Math.floor(parseNumber(row.total_reps, 0))),
        total_volume_kg: Number(parseNumber(row.total_volume_kg, 0).toFixed(2)),
        status: String(row.status ?? "planned"),
        completed: Boolean(row.completed),
        sets: setMap.get(String(row.id)) ?? [],
      };
    });

    const nowIso = new Date().toISOString();
    const logUpdateRes = await api.client
      .from("workout_logs")
      .update({
        status: "in_progress",
        started_at: logRes.data.started_at ?? nowIso,
        total_exercises: responseRows.length,
        updated_at: nowIso,
      })
      .eq("id", parsed.workoutLogId)
      .eq("user_id", api.current.profileId)
      .select(
        "id,workout_date,status,started_at,completion_percentage,total_exercises,exercises_completed",
      )
      .single();
    if (logUpdateRes.error) {
      throw new Error(logUpdateRes.error.message);
    }

    return NextResponse.json({
      workoutLog: logUpdateRes.data,
      exercises: responseRows,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to start workout session");
  }
}

