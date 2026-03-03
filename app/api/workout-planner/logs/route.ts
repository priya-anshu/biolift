import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { upsertWorkoutLog } from "@/lib/workout-planner/service";
import { validateWorkoutLogRequest } from "@/lib/workout-planner/validation";

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-log-upsert",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = await request.json();
    const parsed = validateWorkoutLogRequest(payload);
    const log = await upsertWorkoutLog(
      { client: api.client, profileId: api.current.profileId },
      parsed,
    );
    return NextResponse.json({ log });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workout log";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
