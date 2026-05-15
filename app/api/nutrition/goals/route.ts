import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api";
import { updateNutritionGoals } from "@/lib/nutrition/service";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

const updateGoalsSchema = z
  .object({
    calories: z.number().min(500).max(10000).optional(),
    protein: z.number().min(0).max(1000).optional(),
    carbs: z.number().min(0).max(1500).optional(),
    fiber: z.number().min(0).max(200).optional(),
    fat: z.number().min(0).max(400).optional(),
    water: z.number().min(0).max(12000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one goal value is required.",
  });

export async function PATCH(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "nutrition-goals-update",
      limit: 30,
      windowSeconds: 60,
    });
    const payload = updateGoalsSchema.parse(await request.json());
    const goals = await updateNutritionGoals(
      { client: api.client, profileId: api.current.profileId },
      payload,
    );
    return NextResponse.json({ goals });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update nutrition goals", {
      scope: "nutrition.goals",
    });
  }
}
