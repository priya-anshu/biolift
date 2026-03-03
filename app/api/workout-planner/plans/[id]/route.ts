import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { updatePlanStatus } from "@/lib/workout-planner/service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-plan-update",
      limit: 60,
      windowSeconds: 60,
    });
    const { id } = await context.params;
    const payload = (await request.json()) as { isActive?: boolean };
    const isActive = Boolean(payload.isActive);

    const result = await updatePlanStatus(
      { client: api.client, profileId: api.current.profileId },
      id,
      isActive,
    );

    return NextResponse.json({ plan: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update plan";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
