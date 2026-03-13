import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { logManualWorkoutExecution } from "@/lib/workout-planner/service";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";

type Payload = {
  name?: unknown;
  type?: unknown;
  duration?: unknown;
  calories?: unknown;
  exercise?: unknown;
  sets?: unknown;
  reps?: unknown;
  weightPerSet?: unknown;
  performedAt?: unknown;
  notes?: unknown;
};

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "progress-log-workout",
      limit: 120,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as Payload;
    const workout = await logManualWorkoutExecution(
      { client: api.client, profileId: api.current.profileId },
      {
        name: String(payload.name ?? ""),
        type: typeof payload.type === "string" ? payload.type : undefined,
        durationMinutes: parseNumber(payload.duration),
        caloriesBurned: parseNumber(payload.calories),
        exerciseName:
          typeof payload.exercise === "string" ? payload.exercise : undefined,
        sets: parseNumber(payload.sets),
        reps: parseNumber(payload.reps),
        weightPerSetKg: parseNumber(payload.weightPerSet),
        performedAt:
          typeof payload.performedAt === "string" ? payload.performedAt : undefined,
        notes: typeof payload.notes === "string" ? payload.notes : undefined,
      },
    );

    const immediatePayload = {
      workoutLogId: String(workout.id),
      workoutDate: String(workout.workout_date),
      planId:
        typeof workout.plan_id === "string" && workout.plan_id.length > 0
          ? workout.plan_id
          : undefined,
      lookbackDays: 42,
    };

    await scheduleAiJob(api.adminClient, {
      scope: "progress.log-workout.enqueue",
      swallowErrors: true,
      userId: api.current.profileId,
      jobType: "manual_workout_logged",
      payload: immediatePayload,
      dedupeKey: `manual_workout_logged:${api.current.profileId}:${workout.id}`,
    });

    return NextResponse.json({ workout });
  } catch (error) {
    return apiErrorResponse(error, "Failed to log workout", {
      scope: "progress.log-workout",
    });
  }
}
