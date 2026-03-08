import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

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

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
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
  client: Awaited<ReturnType<typeof getWorkoutPlannerApiContext>>["client"],
  profileId: string,
  workoutLogId: string,
  workoutLogExerciseId: string,
) {
  const exerciseRes = await client
    .from("workout_log_exercises")
    .select("id,planned_sets")
    .eq("id", workoutLogExerciseId)
    .eq("workout_log_id", workoutLogId)
    .eq("user_id", profileId)
    .maybeSingle();
  if (exerciseRes.error) {
    throw new Error(exerciseRes.error.message);
  }
  if (!exerciseRes.data) {
    throw new Error("Workout exercise not found");
  }

  const setRowsRes = await client
    .from("workout_log_sets")
    .select(
      "id,set_number,actual_weight_kg,actual_reps,actual_rpe,set_status,performed_at",
    )
    .eq("workout_log_id", workoutLogId)
    .eq("workout_log_exercise_id", workoutLogExerciseId)
    .eq("user_id", profileId)
    .order("set_number", { ascending: true });
  if (setRowsRes.error) {
    throw new Error(setRowsRes.error.message);
  }

  const setRows = (setRowsRes.data ?? []) as Array<Record<string, unknown>>;
  const summary = summarizeExerciseSets(
    setRows,
    Math.max(1, Math.floor(parseNumber(exerciseRes.data.planned_sets, 1))),
  );

  const exerciseUpdateRes = await client
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
    .eq("user_id", profileId)
    .select(
      "id,completed_sets,total_reps,total_volume_kg,status,completed,best_set_weight_kg,best_set_reps",
    )
    .single();
  if (exerciseUpdateRes.error) {
    throw new Error(exerciseUpdateRes.error.message);
  }

  const allExerciseRowsRes = await client
    .from("workout_log_exercises")
    .select("id,completed")
    .eq("workout_log_id", workoutLogId)
    .eq("user_id", profileId);
  if (allExerciseRowsRes.error) {
    throw new Error(allExerciseRowsRes.error.message);
  }

  const totalExercises = (allExerciseRowsRes.data ?? []).length;
  const exercisesCompleted = (allExerciseRowsRes.data ?? []).filter(
    (row) => Boolean(row.completed),
  ).length;
  const completionPercentage =
    totalExercises > 0
      ? Number(((exercisesCompleted / totalExercises) * 100).toFixed(2))
      : 0;

  const workoutUpdateRes = await client
    .from("workout_logs")
    .update({
      status: "in_progress",
      total_exercises: totalExercises,
      exercises_completed: exercisesCompleted,
      completion_percentage: completionPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workoutLogId)
    .eq("user_id", profileId)
    .select("id,status,total_exercises,exercises_completed,completion_percentage")
    .single();
  if (workoutUpdateRes.error) {
    throw new Error(workoutUpdateRes.error.message);
  }

  return {
    allSets: setRows,
    exercise: exerciseUpdateRes.data,
    workout: workoutUpdateRes.data,
  };
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-set-save",
      limit: 240,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as SaveSetPayload;
    const parsed = parseSavePayload(payload);

    const upsertRes = await api.client
      .from("workout_log_sets")
      .upsert(
        {
          workout_log_exercise_id: parsed.workoutLogExerciseId,
          workout_log_id: parsed.workoutLogId,
          user_id: api.current.profileId,
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
    if (upsertRes.error) {
      throw new Error(upsertRes.error.message);
    }

    const summaries = await recalcExerciseAndWorkout(
      api.client,
      api.current.profileId,
      parsed.workoutLogId,
      parsed.workoutLogExerciseId,
    );

    const personalRecordRes = await api.client
      .from("personal_records")
      .select("id,exercise_id,estimated_1rm,achieved_at")
      .eq("workout_log_set_id", upsertRes.data.id)
      .maybeSingle();
    if (personalRecordRes.error) {
      throw new Error(personalRecordRes.error.message);
    }

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
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-set-delete",
      limit: 180,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as DeleteSetPayload;
    const parsed = parseDeletePayload(payload);

    const deleteRes = await api.client
      .from("workout_log_sets")
      .delete()
      .eq("workout_log_id", parsed.workoutLogId)
      .eq("workout_log_exercise_id", parsed.workoutLogExerciseId)
      .eq("user_id", api.current.profileId)
      .eq("set_number", parsed.setNumber);
    if (deleteRes.error) {
      throw new Error(deleteRes.error.message);
    }

    const summaries = await recalcExerciseAndWorkout(
      api.client,
      api.current.profileId,
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

