import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { buildCoachInsight } from "@/lib/workout-planner/insightEngine";
import {
  getWorkoutRecommendations,
  isNoWorkoutPlanError,
  upsertCalendarStatus,
  upsertWorkoutLog,
} from "@/lib/workout-planner/service";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";
import type {
  ExerciseRecommendation,
  TrainingIntelligenceResult,
} from "@/lib/workout-planner/intelligenceEngine";

type CalendarStatus = "completed" | "missed" | "rest_day" | "planned";

type SaveSetPayload = {
  workoutLogId?: unknown;
  workoutLogExerciseId?: unknown;
  setNumber?: unknown;
  actualWeightKg?: unknown;
  actualReps?: unknown;
  actualRpe?: unknown;
  setStatus?: unknown;
};

type DeleteSetPayload = {
  workoutLogId?: unknown;
  workoutLogExerciseId?: unknown;
  setNumber?: unknown;
};

type FinishPayload = {
  workoutLogId?: unknown;
  notes?: unknown;
  workoutMood?: unknown;
  calendarStatus?: unknown;
  totalDurationMinutes?: unknown;
  caloriesBurned?: unknown;
};

type SessionSummary = {
  completedSets: number;
  totalReps: number;
  totalVolumeKg: number;
  bestSetWeightKg: number | null;
  bestSetReps: number | null;
  status: "planned" | "in_progress" | "completed";
  completed: boolean;
};

const ALLOWED_SET_STATUSES = new Set(["completed", "failed", "skipped", "warmup"]);
const ALLOWED_CALENDAR_STATUSES = new Set<CalendarStatus>([
  "completed",
  "missed",
  "rest_day",
  "planned",
]);

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function assertIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
}

function toErrorResponse(error: unknown, fallback: string) {
  return apiErrorResponse(error, fallback, {
    scope: "workout.session",
  });
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
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

function toAction(value: unknown): ExerciseRecommendation["progression_action"] {
  const normalized = String(value ?? "maintain").trim().toLowerCase();
  if (
    normalized === "increase" ||
    normalized === "maintain" ||
    normalized === "reduce" ||
    normalized === "deload" ||
    normalized === "substitute"
  ) {
    return normalized;
  }
  return "maintain";
}

function parseRecommendation(
  input: unknown,
): Pick<
  ExerciseRecommendation,
  | "plan_exercise_id"
  | "exercise_id"
  | "recommended_weight"
  | "recommended_reps"
  | "recommended_sets"
  | "rest_seconds"
  | "progression_action"
  | "recommendation_reason"
> {
  if (!input || typeof input !== "object") {
    throw new Error("recommendations contains an invalid item");
  }
  const row = input as Record<string, unknown>;
  const planExerciseId = String(row.plan_exercise_id ?? "").trim();
  if (!planExerciseId) {
    throw new Error("recommendations.plan_exercise_id is required");
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
    progression_action: toAction(row.progression_action),
    recommendation_reason: reasonArray,
  };
}

function parseInitializeInput(input: {
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

async function buildSessionRows(
  context: Awaited<ReturnType<typeof getWorkoutPlannerApiContext>>,
  input: {
    workoutDate: string;
    planId?: string;
    dayIndex?: number;
    lookbackDays?: number;
    recommendations?: unknown[];
  },
) {
  const recommendationRead =
    input.recommendations && input.recommendations.length > 0
      ? {
          recommendations: {
            plan_id: input.planId ?? "",
            workout_date: input.workoutDate,
            effective_day_index: input.dayIndex ?? 1,
            readiness_band: "yellow",
            readiness_score: null,
            fatigue_score: 50,
            adherence_score: 50,
            recommendations: input.recommendations.map(parseRecommendation),
          } as TrainingIntelligenceResult,
          cacheState: "exact" as const,
          cacheTtl: {
            exists: false,
            isStale: false,
            updatedAt: null,
            planId: input.planId ?? "",
            workoutDate: input.workoutDate,
            dayIndex: input.dayIndex ?? 1,
            lookbackDays: input.lookbackDays ?? 42,
          },
        }
      : await getWorkoutRecommendations(
          { client: context.client, profileId: context.current.profileId },
          {
            workoutDate: input.workoutDate,
            planId: input.planId,
            dayIndex: input.dayIndex,
            lookbackDays: input.lookbackDays,
          },
        );

  const shouldEnqueue =
    recommendationRead.cacheState !== "exact" || recommendationRead.cacheTtl.isStale;
  if (shouldEnqueue) {
    await scheduleAiJob(context.adminClient, {
      scope: "workout.session.refresh",
      swallowErrors: true,
      userId: context.current.profileId,
      jobType: "recommendation_refresh",
      payload: {
        workoutDate: input.workoutDate,
        planId: input.planId,
        dayIndex: input.dayIndex,
        lookbackDays: input.lookbackDays,
      },
      dedupeKey: buildDedupeKey(context.current.profileId, {
        workoutDate: input.workoutDate,
        planId: input.planId,
        dayIndex: input.dayIndex,
        lookbackDays: input.lookbackDays,
      }),
    });
  }

  const rawRecommendations = recommendationRead.recommendations.recommendations;
  const recommendations = Array.from(
    rawRecommendations.reduce<
      Map<
        string,
        (typeof rawRecommendations)[number]
      >
    >((acc, row) => {
      if (!acc.has(row.plan_exercise_id)) {
        acc.set(row.plan_exercise_id, row);
      }
      return acc;
    }, new Map()),
  ).map((entry) => entry[1]);
  const workoutLog = await upsertWorkoutLog(
    { client: context.client, profileId: context.current.profileId },
    {
      date: input.workoutDate,
      planId: recommendationRead.recommendations.plan_id,
      status: "in_progress",
      source: "planner",
    },
  );

  const planExerciseIds = Array.from(
    new Set(recommendations.map((row) => row.plan_exercise_id)),
  );
  const planRowsRes = await context.client
    .from("workout_plan_exercises")
    .select("id,exercise_name,muscle_group,exercise_order,rpe,superset_group")
    .in("id", planExerciseIds);
  if (planRowsRes.error) throw new Error(planRowsRes.error.message);

  const planMap = new Map(
    (planRowsRes.data ?? []).map((row) => [
      String(row.id),
      {
        exercise_name: String(row.exercise_name ?? "Exercise"),
        muscle_group: String(row.muscle_group ?? ""),
        exercise_order: Math.max(1, Math.floor(parseNumber(row.exercise_order, 1))),
        rpe: row.rpe === null || row.rpe === undefined ? null : parseNumber(row.rpe, 0),
        superset_group:
          typeof row.superset_group === "string" && row.superset_group.trim().length > 0
            ? row.superset_group.trim().toUpperCase()
            : null,
      },
    ]),
  );

  const orderedRecommendations = recommendations
    .map((row, index) => ({
      row,
      index,
      exerciseOrder:
        planMap.get(row.plan_exercise_id)?.exercise_order ?? index + 1,
    }))
    .sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.index - b.index)
    .map((item) => item.row);

  const upsertPayload = orderedRecommendations.map((row, index) => {
    const plan = planMap.get(row.plan_exercise_id);
    return {
      workout_log_id: String(workoutLog.id),
      user_id: context.current.profileId,
      plan_exercise_id: row.plan_exercise_id,
      exercise_id: row.exercise_id,
      exercise_name: plan?.exercise_name ?? `Exercise ${index + 1}`,
      muscle_group: plan?.muscle_group ?? null,
      // Force deterministic, collision-free ordering per workout log.
      exercise_order: index + 1,
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

  const selectColumns =
    "id,plan_exercise_id,exercise_id,exercise_name,muscle_group,exercise_order,planned_sets,planned_reps_min,planned_reps_max,planned_rest_seconds,completed_sets,total_reps,total_volume_kg,status,completed";

  const existingRowsRes = await context.client
    .from("workout_log_exercises")
    .select(selectColumns)
    .eq("workout_log_id", String(workoutLog.id))
    .eq("user_id", context.current.profileId)
    .order("exercise_order", { ascending: true });
  if (existingRowsRes.error) throw new Error(existingRowsRes.error.message);

  const existingRows = existingRowsRes.data ?? [];
  const existingPlanExerciseIds = new Set(
    existingRows
      .map((row) => (row.plan_exercise_id ? String(row.plan_exercise_id) : ""))
      .filter(Boolean),
  );
  const hasMissingRows = orderedRecommendations.some(
    (row) => !existingPlanExerciseIds.has(row.plan_exercise_id),
  );

  let exerciseRows: Array<Record<string, unknown>> = [];

  if (existingRows.length > 0 && !hasMissingRows) {
    exerciseRows = existingRows as Array<Record<string, unknown>>;
  } else if (upsertPayload.length > 0) {
    let syncRes = await context.client
      .from("workout_log_exercises")
      .upsert(upsertPayload, { onConflict: "workout_log_id,plan_exercise_id" })
      .select(selectColumns)
      .order("exercise_order", { ascending: true });

    const isUniqueViolation =
      syncRes.error?.code === "23505" ||
      syncRes.error?.message?.includes(
        "workout_log_exercises_workout_log_id_exercise_order_key",
      );
    if (isUniqueViolation) {
      const setCountRes = await context.client
        .from("workout_log_sets")
        .select("id", { head: true, count: "exact" })
        .eq("workout_log_id", String(workoutLog.id))
        .eq("user_id", context.current.profileId);
      if (setCountRes.error) {
        throw new Error(setCountRes.error.message);
      }

      if ((setCountRes.count ?? 0) > 0) {
        throw new Error(
          "Session structure changed after sets were logged. Finish this session before reloading recommendations.",
        );
      }

      const deleteRes = await context.client
        .from("workout_log_exercises")
        .delete()
        .eq("workout_log_id", String(workoutLog.id))
        .eq("user_id", context.current.profileId);
      if (deleteRes.error) {
        throw new Error(deleteRes.error.message);
      }

      syncRes = await context.client
        .from("workout_log_exercises")
        .insert(upsertPayload)
        .select(selectColumns)
        .order("exercise_order", { ascending: true });
    }

    if (syncRes.error) throw new Error(syncRes.error.message);
    exerciseRows = (syncRes.data ?? []) as Array<Record<string, unknown>>;
  }

  const workoutLogExerciseIds = exerciseRows.map((row) => String(row.id));

  const setsRes =
    workoutLogExerciseIds.length > 0
      ? await context.client
          .from("workout_log_sets")
          .select(
            "id,workout_log_exercise_id,set_number,actual_weight_kg,actual_reps,actual_rpe,set_status,performed_at",
          )
          .eq("workout_log_id", String(workoutLog.id))
          .eq("user_id", context.current.profileId)
          .in("workout_log_exercise_id", workoutLogExerciseIds)
          .order("set_number", { ascending: true })
      : { data: [], error: null };
  if (setsRes.error) throw new Error(setsRes.error.message);

  const setMap = new Map<string, Array<Record<string, unknown>>>();
  (setsRes.data ?? []).forEach((setRow) => {
    const key = String(setRow.workout_log_exercise_id);
    const current = setMap.get(key) ?? [];
    current.push(setRow as Record<string, unknown>);
    setMap.set(key, current);
  });

  const recommendationMap = new Map(
    orderedRecommendations.map((row) => [row.plan_exercise_id, row]),
  );
  const exercises = exerciseRows.map((row) => {
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
      superset_group: planMap.get(planExerciseId)?.superset_group ?? null,
      completed_sets: Math.max(0, Math.floor(parseNumber(row.completed_sets, 0))),
      total_reps: Math.max(0, Math.floor(parseNumber(row.total_reps, 0))),
      total_volume_kg: Number(parseNumber(row.total_volume_kg, 0).toFixed(2)),
      status: String(row.status ?? "planned"),
      completed: Boolean(row.completed),
      sets: setMap.get(String(row.id)) ?? [],
    };
  });

  const nowIso = new Date().toISOString();
  const logUpdateRes = await context.client
    .from("workout_logs")
    .update({
      status: "in_progress",
      total_exercises: exercises.length,
      updated_at: nowIso,
    })
    .eq("id", String(workoutLog.id))
    .eq("user_id", context.current.profileId)
    .select(
      "id,workout_date,status,started_at,completion_percentage,total_exercises,exercises_completed",
    )
    .single();
  if (logUpdateRes.error) throw new Error(logUpdateRes.error.message);
  const coachInsight = buildCoachInsight({
    recommendations: orderedRecommendations.map((row) => ({
      progression_action: row.progression_action,
      recommendation_reason: row.recommendation_reason,
    })),
    recovery: {
      readiness_score: recommendationRead.recommendations.readiness_score,
      fatigue_score: recommendationRead.recommendations.fatigue_score,
    },
    previewExercises: exercises.map((exercise) => ({
      exercise_name: exercise.exercise_name,
      muscle_group: exercise.muscle_group,
    })),
    cacheState: recommendationRead.cacheState,
    cacheTtl: recommendationRead.cacheTtl,
  });

  return {
    workoutLog: logUpdateRes.data,
    recommendations: recommendationRead.recommendations,
    exercises,
    cacheState: recommendationRead.cacheState,
    cacheTtl: recommendationRead.cacheTtl,
    coachInsight,
  };
}

function parseSavePayload(payload: SaveSetPayload) {
  const workoutLogId =
    typeof payload.workoutLogId === "string" ? payload.workoutLogId.trim() : "";
  const workoutLogExerciseId =
    typeof payload.workoutLogExerciseId === "string"
      ? payload.workoutLogExerciseId.trim()
      : "";
  if (!workoutLogId || !workoutLogExerciseId) {
    throw new Error("workoutLogId and workoutLogExerciseId are required");
  }

  const setNumber = Math.max(1, Math.min(30, Math.floor(parseNumber(payload.setNumber, 1))));
  const setStatusRaw = String(payload.setStatus ?? "completed").trim().toLowerCase();
  if (!ALLOWED_SET_STATUSES.has(setStatusRaw)) {
    throw new Error("setStatus is invalid");
  }

  const actualWeightKg = parseNullableNumber(payload.actualWeightKg);
  const actualReps = parseNullableNumber(payload.actualReps);
  const actualRpe = parseNullableNumber(payload.actualRpe);

  if (setStatusRaw === "completed" && (actualReps === null || actualReps < 1)) {
    throw new Error("Completed sets require reps >= 1");
  }

  return {
    workoutLogId,
    workoutLogExerciseId,
    setNumber,
    actualWeightKg,
    actualReps,
    actualRpe,
    setStatus: setStatusRaw,
  };
}

function parseDeletePayload(payload: DeleteSetPayload) {
  const workoutLogId =
    typeof payload.workoutLogId === "string" ? payload.workoutLogId.trim() : "";
  const workoutLogExerciseId =
    typeof payload.workoutLogExerciseId === "string"
      ? payload.workoutLogExerciseId.trim()
      : "";
  if (!workoutLogId || !workoutLogExerciseId) {
    throw new Error("workoutLogId and workoutLogExerciseId are required");
  }
  const setNumber = Math.max(1, Math.min(30, Math.floor(parseNumber(payload.setNumber, 1))));
  return {
    workoutLogId,
    workoutLogExerciseId,
    setNumber,
  };
}

function summarizeExerciseSets(
  setRows: Array<Record<string, unknown>>,
  plannedSets: number,
): SessionSummary {
  const completedRows = setRows.filter((row) => row.set_status === "completed");
  const completedSets = completedRows.length;
  const totalReps = completedRows.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(parseNumber(row.actual_reps, 0))),
    0,
  );
  const totalVolumeKg = completedRows.reduce((sum, row) => {
    const reps = Math.max(0, parseNumber(row.actual_reps, 0));
    const weight = Math.max(0, parseNumber(row.actual_weight_kg, 0));
    return sum + reps * weight;
  }, 0);
  const bestSetWeightKg =
    completedRows.length > 0
      ? Math.max(...completedRows.map((row) => Math.max(0, parseNumber(row.actual_weight_kg, 0))))
      : null;
  const bestSetReps =
    completedRows.length > 0
      ? Math.max(...completedRows.map((row) => Math.max(0, parseNumber(row.actual_reps, 0))))
      : null;

  const status: SessionSummary["status"] =
    completedSets >= plannedSets && plannedSets > 0
      ? "completed"
      : completedSets > 0
        ? "in_progress"
        : "planned";

  return {
    completedSets,
    totalReps,
    totalVolumeKg: Number(totalVolumeKg.toFixed(2)),
    bestSetWeightKg: bestSetWeightKg === null ? null : Number(bestSetWeightKg.toFixed(2)),
    bestSetReps,
    status,
    completed: status === "completed",
  };
}

async function recalcExerciseAndWorkout(
  context: Awaited<ReturnType<typeof getWorkoutPlannerApiContext>>,
  workoutLogId: string,
  workoutLogExerciseId: string,
) {
  const exerciseRes = await context.client
    .from("workout_log_exercises")
    .select("id,planned_sets")
    .eq("id", workoutLogExerciseId)
    .eq("workout_log_id", workoutLogId)
    .eq("user_id", context.current.profileId)
    .maybeSingle();
  if (exerciseRes.error) throw new Error(exerciseRes.error.message);
  if (!exerciseRes.data) throw new Error("Workout exercise not found");

  const setRowsRes = await context.client
    .from("workout_log_sets")
    .select(
      "id,set_number,actual_weight_kg,actual_reps,actual_rpe,set_status,performed_at",
    )
    .eq("workout_log_id", workoutLogId)
    .eq("workout_log_exercise_id", workoutLogExerciseId)
    .eq("user_id", context.current.profileId)
    .order("set_number", { ascending: true });
  if (setRowsRes.error) throw new Error(setRowsRes.error.message);

  const setRows = (setRowsRes.data ?? []) as Array<Record<string, unknown>>;
  const summary = summarizeExerciseSets(
    setRows,
    Math.max(1, Math.floor(parseNumber(exerciseRes.data.planned_sets, 1))),
  );

  const exerciseUpdateRes = await context.client
    .from("workout_log_exercises")
    .update({
      completed_sets: summary.completedSets,
      total_reps: summary.totalReps,
      total_volume_kg: summary.totalVolumeKg,
      best_set_weight_kg: summary.bestSetWeightKg,
      best_set_reps: summary.bestSetReps,
      status: summary.status,
      completed: summary.completed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workoutLogExerciseId)
    .eq("workout_log_id", workoutLogId)
    .eq("user_id", context.current.profileId)
    .select(
      "id,completed_sets,total_reps,total_volume_kg,status,completed,best_set_weight_kg,best_set_reps",
    )
    .single();
  if (exerciseUpdateRes.error) throw new Error(exerciseUpdateRes.error.message);

  const allExerciseRowsRes = await context.client
    .from("workout_log_exercises")
    .select("id,completed")
    .eq("workout_log_id", workoutLogId)
    .eq("user_id", context.current.profileId);
  if (allExerciseRowsRes.error) throw new Error(allExerciseRowsRes.error.message);

  const totalExercises = (allExerciseRowsRes.data ?? []).length;
  const exercisesCompleted = (allExerciseRowsRes.data ?? []).filter(
    (row) => Boolean(row.completed),
  ).length;
  const completionPercentage =
    totalExercises > 0
      ? Number(((exercisesCompleted / totalExercises) * 100).toFixed(2))
      : 0;

  const workoutUpdateRes = await context.client
    .from("workout_logs")
    .update({
      status: "in_progress",
      total_exercises: totalExercises,
      exercises_completed: exercisesCompleted,
      completion_percentage: completionPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workoutLogId)
    .eq("user_id", context.current.profileId)
    .select("id,status,total_exercises,exercises_completed,completion_percentage")
    .single();
  if (workoutUpdateRes.error) throw new Error(workoutUpdateRes.error.message);

  return {
    allSets: setRows,
    exercise: exerciseUpdateRes.data,
    workout: workoutUpdateRes.data,
  };
}

function parseFinishPayload(payload: FinishPayload) {
  const workoutLogId =
    typeof payload.workoutLogId === "string" ? payload.workoutLogId.trim() : "";
  if (!workoutLogId) {
    throw new Error("workoutLogId is required");
  }

  const calendarStatusRaw = String(payload.calendarStatus ?? "completed")
    .trim()
    .toLowerCase() as CalendarStatus;
  if (!ALLOWED_CALENDAR_STATUSES.has(calendarStatusRaw)) {
    throw new Error("calendarStatus is invalid");
  }

  const notes =
    typeof payload.notes === "string" && payload.notes.trim().length > 0
      ? payload.notes.trim()
      : null;
  const workoutMood =
    typeof payload.workoutMood === "string" && payload.workoutMood.trim().length > 0
      ? payload.workoutMood.trim().toLowerCase()
      : null;

  return {
    workoutLogId,
    calendarStatus: calendarStatusRaw,
    notes,
    workoutMood,
    totalDurationMinutes:
      payload.totalDurationMinutes === null ||
      payload.totalDurationMinutes === undefined ||
      payload.totalDurationMinutes === ""
        ? null
        : Math.max(0, Math.min(1440, Math.floor(parseNumber(payload.totalDurationMinutes, 0)))),
    caloriesBurned:
      payload.caloriesBurned === null ||
      payload.caloriesBurned === undefined ||
      payload.caloriesBurned === ""
        ? null
        : Math.max(0, Math.min(100000, Math.floor(parseNumber(payload.caloriesBurned, 0)))),
  };
}

function workoutStatusFromCalendar(status: CalendarStatus) {
  if (status === "completed") return "completed";
  if (status === "missed") return "missed";
  if (status === "rest_day") return "rest_day";
  return "planned";
}

export async function GET(request: NextRequest) {
  const startedAtMs = Date.now();
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-get",
      limit: 180,
      windowSeconds: 60,
    });

    const parsed = parseInitializeInput({
      workoutDate: request.nextUrl.searchParams.get("workoutDate"),
      planId: request.nextUrl.searchParams.get("planId"),
      dayIndex: request.nextUrl.searchParams.get("dayIndex"),
      lookbackDays: request.nextUrl.searchParams.get("lookbackDays"),
    });

    let session;
    try {
      session = await buildSessionRows(context, parsed);
    } catch (sessionError) {
      if (isNoWorkoutPlanError(sessionError)) {
        return NextResponse.json({
          requiresPlan: true,
          workoutDate: parsed.workoutDate,
          workoutLog: null,
          recommendations: null,
          exercises: [],
          cacheState: "baseline",
          cacheTtl: null,
          coachInsight: buildCoachInsight({ requiresPlan: true }),
        });
      }
      throw sessionError;
    }
    logger.info({
      scope: "workout.session.start",
      message: "Workout session loaded",
      meta: {
        user_id: context.current.profileId,
        job_type: "session_start",
        duration_ms: Date.now() - startedAtMs,
        workout_log_id: session.workoutLog?.id ?? null,
        workout_date: parsed.workoutDate,
      },
    });
    return NextResponse.json(session);
  } catch (error) {
    return toErrorResponse(error, "Failed to initialize workout session");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-set-save",
      limit: 240,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as SaveSetPayload;
    const parsed = parseSavePayload(payload);

    const upsertRes = await context.client
      .from("workout_log_sets")
      .upsert(
        {
          workout_log_exercise_id: parsed.workoutLogExerciseId,
          workout_log_id: parsed.workoutLogId,
          user_id: context.current.profileId,
          set_number: parsed.setNumber,
          actual_weight_kg: parsed.actualWeightKg,
          actual_reps: parsed.actualReps,
          actual_rpe: parsed.actualRpe,
          set_status: parsed.setStatus,
          performed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workout_log_exercise_id,set_number" },
      )
      .select(
        "id,workout_log_exercise_id,set_number,actual_weight_kg,actual_reps,actual_rpe,set_status,performed_at",
      )
      .single();
    if (upsertRes.error) throw new Error(upsertRes.error.message);

    const summaries = await recalcExerciseAndWorkout(
      context,
      parsed.workoutLogId,
      parsed.workoutLogExerciseId,
    );

    const personalRecordRes = await context.client
      .from("personal_records")
      .select("id,exercise_id,estimated_1rm,achieved_at")
      .eq("workout_log_set_id", upsertRes.data.id)
      .maybeSingle();
    if (personalRecordRes.error) throw new Error(personalRecordRes.error.message);

    return NextResponse.json({
      set: upsertRes.data,
      allSets: summaries.allSets,
      exercise: summaries.exercise,
      workout: summaries.workout,
      personalRecord: personalRecordRes.data ?? null,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to save set");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-set-delete",
      limit: 180,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as DeleteSetPayload;
    const parsed = parseDeletePayload(payload);

    const deleteRes = await context.client
      .from("workout_log_sets")
      .delete()
      .eq("workout_log_id", parsed.workoutLogId)
      .eq("workout_log_exercise_id", parsed.workoutLogExerciseId)
      .eq("user_id", context.current.profileId)
      .eq("set_number", parsed.setNumber);
    if (deleteRes.error) throw new Error(deleteRes.error.message);

    const summaries = await recalcExerciseAndWorkout(
      context,
      parsed.workoutLogId,
      parsed.workoutLogExerciseId,
    );

    return NextResponse.json({
      allSets: summaries.allSets,
      exercise: summaries.exercise,
      workout: summaries.workout,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete set");
  }
}

export async function POST(request: NextRequest) {
  const startedAtMs = Date.now();
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-finish",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as FinishPayload;
    const parsed = parseFinishPayload(payload);

    const logRes = await context.client
      .from("workout_logs")
      .select(
        "id,user_id,plan_id,workout_date,status,started_at,total_duration_minutes,calories_burned,notes",
      )
      .eq("id", parsed.workoutLogId)
      .eq("user_id", context.current.profileId)
      .maybeSingle();
    if (logRes.error) throw new Error(logRes.error.message);
    if (!logRes.data) throw new Error("Workout log not found for current user");

    const exercisesRes = await context.client
      .from("workout_log_exercises")
      .select("id,completed")
      .eq("workout_log_id", parsed.workoutLogId)
      .eq("user_id", context.current.profileId);
    if (exercisesRes.error) throw new Error(exercisesRes.error.message);

    const totalExercises = (exercisesRes.data ?? []).length;
    const exercisesCompleted = (exercisesRes.data ?? []).filter((row) =>
      Boolean(row.completed),
    ).length;
    const completionPercentage =
      totalExercises > 0
        ? Number(((exercisesCompleted / totalExercises) * 100).toFixed(2))
        : parsed.calendarStatus === "completed"
          ? 100
          : 0;

    const now = new Date();
    const nowIso = now.toISOString();
    const startedAt = logRes.data.started_at
      ? new Date(String(logRes.data.started_at))
      : null;
    const derivedDuration =
      startedAt && Number.isFinite(startedAt.getTime())
        ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000))
        : parseNumber(logRes.data.total_duration_minutes, 0);

    const updateRes = await context.client
      .from("workout_logs")
      .update({
        status: workoutStatusFromCalendar(parsed.calendarStatus),
        started_at: startedAt ? startedAt.toISOString() : nowIso,
        completed_at: nowIso,
        total_exercises: totalExercises,
        exercises_completed: exercisesCompleted,
        completion_percentage: completionPercentage,
        total_duration_minutes:
          parsed.totalDurationMinutes !== null
            ? parsed.totalDurationMinutes
            : derivedDuration,
        calories_burned:
          parsed.caloriesBurned !== null
            ? parsed.caloriesBurned
            : parseNumber(logRes.data.calories_burned, 0),
        notes:
          parsed.notes || parsed.workoutMood
            ? [
                parsed.workoutMood ? `Mood: ${parsed.workoutMood}` : null,
                parsed.notes,
              ]
                .filter(Boolean)
                .join("\n")
            : (logRes.data.notes ?? null),
        updated_at: nowIso,
      })
      .eq("id", parsed.workoutLogId)
      .eq("user_id", context.current.profileId)
      .select(
        "id,workout_date,status,started_at,completed_at,total_exercises,exercises_completed,completion_percentage,total_duration_minutes,calories_burned,notes",
      )
      .single();
    if (updateRes.error) throw new Error(updateRes.error.message);

    const calendar = await upsertCalendarStatus(
      { client: context.client, profileId: context.current.profileId },
      {
        date: String(logRes.data.workout_date),
        status: parsed.calendarStatus,
        workoutLogId: parsed.workoutLogId,
        notes:
          parsed.notes ?? (parsed.workoutMood ? `Mood: ${parsed.workoutMood}` : undefined),
      },
    );

    const workoutDate = String(logRes.data.workout_date);
    const planId =
      typeof logRes.data.plan_id === "string" && logRes.data.plan_id.length > 0
        ? logRes.data.plan_id
        : undefined;
    const immediatePayload = {
      workoutLogId: parsed.workoutLogId,
      workoutDate,
      planId,
      lookbackDays: 42,
    };
    await scheduleAiJob(context.adminClient, {
      scope: "workout.session.finish.enqueue",
      swallowErrors: true,
      userId: context.current.profileId,
      jobType: "session_finished",
      payload: immediatePayload,
      dedupeKey: `session_finished:${context.current.profileId}:${parsed.workoutLogId}`,
    });

    logger.info({
      scope: "workout.session.finish",
      message: "Workout session finished",
      meta: {
        user_id: context.current.profileId,
        job_type: "session_finish",
        duration_ms: Date.now() - startedAtMs,
        workout_log_id: parsed.workoutLogId,
        workout_date: workoutDate,
      },
    });

    return NextResponse.json({
      workoutLog: updateRes.data,
      calendar,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to finish workout session");
  }
}
