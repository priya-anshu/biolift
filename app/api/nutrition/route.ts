import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/server/api";
import { MEAL_SLOT_IDS } from "@/lib/nutrition/types";
import {
  buildNutritionResponse,
  clearNutritionMeal,
  logNutritionEntry,
} from "@/lib/nutrition/service";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

const todayKey = () => new Date().toISOString().slice(0, 10);

const logRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOT_IDS),
  description: z.string().trim().min(2).max(500),
});

const clearRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(MEAL_SLOT_IDS),
});

function resolveDate(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")?.trim();
  if (!date) return todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date. Use YYYY-MM-DD.");
  }
  return date;
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "nutrition-dashboard",
      limit: 180,
      windowSeconds: 60,
    });
    const date = resolveDate(request);
    return NextResponse.json(
      await buildNutritionResponse(
        { client: api.client, profileId: api.current.profileId },
        date,
      ),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to load nutrition tracker", {
      scope: "nutrition.dashboard",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "nutrition-log",
      limit: 90,
      windowSeconds: 60,
    });
    const payload = logRequestSchema.parse(await request.json());
    const context = { client: api.client, profileId: api.current.profileId };
    const log = await logNutritionEntry(context, payload);
    return NextResponse.json(await buildNutritionResponse(context, payload.date, log));
  } catch (error) {
    return apiErrorResponse(error, "Failed to log nutrition entry", {
      scope: "nutrition.log",
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "nutrition-clear",
      limit: 60,
      windowSeconds: 60,
    });
    const payload = clearRequestSchema.parse(await request.json());
    const context = { client: api.client, profileId: api.current.profileId };
    await clearNutritionMeal(context, payload.date, payload.mealSlot);
    return NextResponse.json(await buildNutritionResponse(context, payload.date));
  } catch (error) {
    return apiErrorResponse(error, "Failed to clear meal entries", {
      scope: "nutrition.clear",
    });
  }
}
