import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getMotivationSnapshot } from "@/lib/workout-planner/service";

// LEGACY: retained for backward compatibility; the main dashboard now inlines motivation data.
export async function GET() {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "dashboard-motivation",
      limit: 120,
      windowSeconds: 60,
    });
    const data = await getMotivationSnapshot(
      { client: api.client, profileId: api.current.profileId },
      api.current.preferredLanguage,
    );
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, "Failed to load motivation card", {
      scope: "dashboard.motivation",
    });
  }
}
