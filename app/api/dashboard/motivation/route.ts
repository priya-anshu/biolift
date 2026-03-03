import { NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getMotivationSnapshot } from "@/lib/workout-planner/service";

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
    const message =
      error instanceof Error ? error.message : "Failed to load motivation card";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
