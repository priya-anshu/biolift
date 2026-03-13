import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getProgressOverview } from "@/lib/workout-planner/service";

function parseRange(value: string | null): "week" | "month" {
  return value === "month" ? "month" : "week";
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "progress-overview",
      limit: 120,
      windowSeconds: 60,
    });
    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const data = await getProgressOverview(
      { client: api.client, profileId: api.current.profileId },
      range,
    );
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, "Failed to load progress overview", {
      scope: "progress.overview",
    });
  }
}
