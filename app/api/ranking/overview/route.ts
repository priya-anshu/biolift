import { NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getRankingOverview } from "@/lib/workout-planner/service";

export async function GET() {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "ranking-overview",
      limit: 120,
      windowSeconds: 60,
    });
    const overview = await getRankingOverview({
      client: api.adminClient,
      profileId: api.current.profileId,
    });
    return NextResponse.json(overview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ranking overview";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
