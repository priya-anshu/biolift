import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { upsertCalendarStatus } from "@/lib/workout-planner/service";

type FinishPayload = {
  workoutLogId?: unknown;
  notes?: unknown;
  calendarStatus?: unknown;
  totalDurationMinutes?: unknown;
  caloriesBurned?: unknown;
};

type CalendarStatus = "completed" | "missed" | "rest_day" | "planned";

const ALLOWED_CALENDAR_STATUSES = new Set<CalendarStatus>([
  "completed",
  "missed",
  "rest_day",
  "planned",
]);

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

function parseOptionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) {
    throw new Error("Numeric payload field is invalid");
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parsePayload(payload: FinishPayload) {
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

  return {
    workoutLogId,
    calendarStatus: calendarStatusRaw,
    notes,
    totalDurationMinutes: parseOptionalNumber(payload.totalDurationMinutes, 0, 1440),
    caloriesBurned: parseOptionalNumber(payload.caloriesBurned, 0, 100000),
  };
}

function workoutStatusFromCalendar(status: CalendarStatus) {
  if (status === "completed") return "completed";
  if (status === "missed") return "missed";
  if (status === "rest_day") return "rest_day";
  return "planned";
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-session-finish",
      limit: 120,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as FinishPayload;
    const parsed = parsePayload(payload);

    const logRes = await api.client
      .from("workout_logs")
      .select(
        "id,user_id,workout_date,status,started_at,total_duration_minutes,calories_burned,notes",
      )
      .eq("id", parsed.workoutLogId)
      .eq("user_id", api.current.profileId)
      .maybeSingle();
    if (logRes.error) {
      throw new Error(logRes.error.message);
    }
    if (!logRes.data) {
      throw new Error("Workout log not found for current user");
    }

    const exercisesRes = await api.client
      .from("workout_log_exercises")
      .select("id,completed")
      .eq("workout_log_id", parsed.workoutLogId)
      .eq("user_id", api.current.profileId);
    if (exercisesRes.error) {
      throw new Error(exercisesRes.error.message);
    }

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

    const updateRes = await api.client
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
        notes: parsed.notes ?? logRes.data.notes ?? null,
        updated_at: nowIso,
      })
      .eq("id", parsed.workoutLogId)
      .eq("user_id", api.current.profileId)
      .select(
        "id,workout_date,status,started_at,completed_at,total_exercises,exercises_completed,completion_percentage,total_duration_minutes,calories_burned,notes",
      )
      .single();
    if (updateRes.error) {
      throw new Error(updateRes.error.message);
    }

    const calendar = await upsertCalendarStatus(
      { client: api.client, profileId: api.current.profileId },
      {
        date: String(logRes.data.workout_date),
        status: parsed.calendarStatus,
        workoutLogId: parsed.workoutLogId,
        notes: parsed.notes ?? undefined,
      },
    );

    return NextResponse.json({
      workoutLog: updateRes.data,
      calendar,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to finish workout session");
  }
}
