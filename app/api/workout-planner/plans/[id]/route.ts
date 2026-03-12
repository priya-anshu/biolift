import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { updatePlan } from "@/lib/workout-planner/service";
import { enqueueAiJob } from "@/lib/workout-planner/workerQueue";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function todayUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-plan-update",
      limit: 60,
      windowSeconds: 60,
    });
    const { id } = await context.params;
    const payload = (await request.json()) as {
      isActive?: boolean;
      name?: string;
      goal?: string;
      workoutDaysPerWeek?: number;
    };

    const result = await updatePlan(
      { client: api.client, profileId: api.current.profileId },
      id,
      payload,
    );

    if (payload.isActive === true || payload.goal || payload.workoutDaysPerWeek) {
      const workoutDate = todayUtcDateKey();
      void enqueueAiJob(api.adminClient, {
        userId: api.current.profileId,
        jobType: "plan_updated",
        payload: {
          workoutDate,
          planId: String(result.id),
          lookbackDays: 42,
        },
        dedupeKey: `plan_updated:${api.current.profileId}:${result.id}:${workoutDate}`,
      }).catch(() => {});
    }

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
