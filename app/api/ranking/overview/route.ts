import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
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
    return apiErrorResponse(error, "Failed to load ranking overview", {
      scope: "ranking.overview",
    });
  }
}
