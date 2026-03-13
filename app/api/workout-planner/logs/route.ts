import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
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
    return apiErrorResponse(error, "Failed to update workout log", {
      scope: "workout-planner.logs",
    });
  }
}
