import { NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { listUserPlans } from "@/lib/workout-planner/service";

export async function GET() {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-plans-list",
      limit: 80,
      windowSeconds: 60,
    });
    const plans = await listUserPlans({
      client: context.client,
      profileId: context.current.profileId,
    });
    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load plans";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
