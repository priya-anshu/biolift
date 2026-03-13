import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
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
    return apiErrorResponse(error, "Failed to load plans", {
      scope: "workout-planner.plans",
    });
  }
}
