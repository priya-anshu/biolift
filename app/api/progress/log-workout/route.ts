import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import {
  logManualWorkoutExecution,
  refreshLeaderboardForUser,
} from "@/lib/workout-planner/service";

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

    await refreshLeaderboardForUser({
      client: api.adminClient,
      profileId: api.current.profileId,
    });

    return NextResponse.json({ workout });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log workout";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
