import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-exercises",
      limit: 180,
      windowSeconds: 60,
    });
    const muscle = request.nextUrl.searchParams.get("muscle");
    const difficulty = request.nextUrl.searchParams.get("difficulty");
    let query = api.client
      .from("exercises")
      .select(
        "id,slug,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,instructions,cloudinary_image_id,cloudinary_gif_id,visibility",
      )
      .order("name", { ascending: true });

    if (muscle) {
      query = query.eq("target_muscle", muscle.toLowerCase());
    }
    if (difficulty) {
      query = query.eq("difficulty_level", difficulty.toLowerCase());
    }

    const result = await query;
    if (result.error) {
      throw new Error(result.error.message);
    }
    return NextResponse.json({ exercises: result.data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load exercises";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
