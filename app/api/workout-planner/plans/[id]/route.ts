import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import {
  getPlanWithExercises,
  replacePlanExercises,
  updatePlan,
} from "@/lib/workout-planner/service";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";
import { validatePlanExercisesPatch } from "@/lib/workout-planner/validation";

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
      exercises?: unknown[];
    };

    const serviceContext = { client: api.client, profileId: api.current.profileId };
    let result: Awaited<ReturnType<typeof updatePlan>> | null = null;
    if (
      payload.isActive !== undefined ||
      payload.name !== undefined ||
      payload.goal !== undefined ||
      payload.workoutDaysPerWeek !== undefined
    ) {
      result = await updatePlan(serviceContext, id, payload);
    } else {
      const current = await getPlanWithExercises(serviceContext, id);
      result = current.plan;
    }

    let exercisesUpdated = false;
    if (Array.isArray(payload.exercises)) {
      const parsedExercises = validatePlanExercisesPatch(payload);
      await replacePlanExercises(serviceContext, id, parsedExercises);
      exercisesUpdated = true;
    }

    if (
      payload.isActive === true ||
      payload.goal ||
      payload.workoutDaysPerWeek ||
      exercisesUpdated
    ) {
      const workoutDate = todayUtcDateKey();
      const immediatePayload = {
        workoutDate,
        planId: String(result.id),
        lookbackDays: 42,
      };
      await scheduleAiJob(api.adminClient, {
        scope: "workout-planner.plan-update.enqueue",
        swallowErrors: true,
        userId: api.current.profileId,
        jobType: "plan_updated",
        payload: immediatePayload,
        dedupeKey: `plan_updated:${api.current.profileId}:${result.id}:${workoutDate}`,
      });
    }

    const planDetails = await getPlanWithExercises(serviceContext, id);
    return NextResponse.json({
      plan: planDetails.plan,
      exercises: planDetails.exercises,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update plan", {
      scope: "workout-planner.plan-update",
    });
  }
}

export async function GET(_request: NextRequest, context: RouteParams) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-plan-get",
      limit: 90,
      windowSeconds: 60,
    });
    const { id } = await context.params;
    const result = await getPlanWithExercises(
      { client: api.client, profileId: api.current.profileId },
      id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, "Failed to load plan details", {
      scope: "workout-planner.plan-get",
    });
  }
}
