import { NextRequest, NextResponse } from "next/server";
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
    const message =
      error instanceof Error ? error.message : "Failed to load progress overview";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
