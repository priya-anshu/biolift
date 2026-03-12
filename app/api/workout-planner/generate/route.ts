import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { generateSmartPlan } from "@/lib/workout-planner/service";
import { validatePlannerRequest } from "@/lib/workout-planner/validation";
import { enqueueAiJob } from "@/lib/workout-planner/workerQueue";

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-generate",
      limit: 12,
      windowSeconds: 60,
    });
    const payload = await request.json();
    const parsed = validatePlannerRequest(payload);

    const result = await generateSmartPlan(
      { client: context.client, profileId: context.current.profileId },
      parsed,
    );

    logger.info({
      scope: "workout-planner.generate",
      message: "Smart plan generated",
      meta: {
        profileId: context.current.profileId,
        planId: result.plan.id,
        exercisesCount: result.exercisesCount,
      },
    });

    const workoutDate = todayUtcDateKey();
    void enqueueAiJob(context.adminClient, {
      userId: context.current.profileId,
      jobType: "plan_updated",
      payload: {
        workoutDate,
        planId: String(result.plan.id),
        lookbackDays: 42,
      },
      dedupeKey: `plan_updated:${context.current.profileId}:${result.plan.id}:${workoutDate}`,
    }).catch((cacheError) => {
      logger.warn({
        scope: "workout-planner.generate.enqueue",
        message: "AI worker job enqueue failed",
        meta: {
          profileId: context.current.profileId,
          planId: result.plan.id,
          error:
            cacheError instanceof Error
              ? cacheError.message
              : "Unknown cache prime error",
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate plan";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    logger.warn({
      scope: "workout-planner.generate",
      message: "Request failed",
      meta: { error: message },
    });
    return NextResponse.json({ error: message }, { status });
  }
}
