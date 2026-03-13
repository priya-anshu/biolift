import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { logger } from "@/lib/server/logger";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { createManualPlan } from "@/lib/workout-planner/service";
import { validateManualPlanRequest } from "@/lib/workout-planner/validation";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

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

    const workoutDate = todayUtcDateKey();
    const immediatePayload = {
      workoutDate,
      planId: String(result.plan.id),
      lookbackDays: 42,
    };
    await scheduleAiJob(context.adminClient, {
      scope: "workout-planner.manual.enqueue",
      swallowErrors: true,
      userId: context.current.profileId,
      jobType: "plan_updated",
      payload: immediatePayload,
      dedupeKey: `plan_updated:${context.current.profileId}:${result.plan.id}:${workoutDate}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Failed to create manual plan", {
      scope: "workout-planner.manual",
    });
  }
}
