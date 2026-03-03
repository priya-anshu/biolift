import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { createManualPlan } from "@/lib/workout-planner/service";
import { validateManualPlanRequest } from "@/lib/workout-planner/validation";

export async function POST(request: NextRequest) {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-manual",
      limit: 20,
      windowSeconds: 60,
    });
    const payload = await request.json();
    const parsed = validateManualPlanRequest(payload);

    const result = await createManualPlan(
      { client: context.client, profileId: context.current.profileId },
      parsed,
    );
    logger.info({
      scope: "workout-planner.manual",
      message: "Manual plan created",
      meta: {
        profileId: context.current.profileId,
        planId: result.plan.id,
        exercisesCount: result.exercisesCount,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create manual plan";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    logger.warn({
      scope: "workout-planner.manual",
      message: "Request failed",
      meta: { error: message },
    });
    return NextResponse.json({ error: message }, { status });
  }
}
