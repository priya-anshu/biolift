import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getWorkoutRecommendations } from "@/lib/workout-planner/service";

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

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-recommendations-get",
      limit: 120,
      windowSeconds: 60,
    });

    const parsed = parseRequestInput({
      workoutDate: request.nextUrl.searchParams.get("workoutDate"),
      planId: request.nextUrl.searchParams.get("planId"),
      dayIndex: request.nextUrl.searchParams.get("dayIndex"),
      lookbackDays: request.nextUrl.searchParams.get("lookbackDays"),
    });

    const recommendations = await getWorkoutRecommendations(
      { client: api.client, profileId: api.current.profileId },
      parsed,
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate recommendations");
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-recommendations-post",
      limit: 120,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as {
      workoutDate?: unknown;
      planId?: unknown;
      dayIndex?: unknown;
      lookbackDays?: unknown;
    };

    const parsed = parseRequestInput(payload);

    const recommendations = await getWorkoutRecommendations(
      { client: api.client, profileId: api.current.profileId },
      parsed,
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate recommendations");
  }
}

