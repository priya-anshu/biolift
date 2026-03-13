import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import {
  createCustomExercise,
  getAiExerciseSuggestions,
  searchExerciseCatalog,
} from "@/lib/workout-planner/service";

function parsePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-exercises",
      limit: 180,
      windowSeconds: 60,
    });
    const mode = request.nextUrl.searchParams.get("mode")?.toLowerCase();
    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const muscle = request.nextUrl.searchParams.get("muscle") ?? undefined;
    const difficulty = request.nextUrl.searchParams.get("difficulty") ?? undefined;
    const limit = parsePositiveInt(
      request.nextUrl.searchParams.get("limit"),
      40,
      1,
      100,
    );

    if (mode === "suggest") {
      const planId = request.nextUrl.searchParams.get("planId");
      if (!planId) {
        throw new Error("planId is required for suggestion mode");
      }
      const dayIndex = parsePositiveInt(
        request.nextUrl.searchParams.get("dayIndex"),
        new Date().getDay() === 0 ? 7 : new Date().getDay(),
        1,
        7,
      );
      const suggestions = await getAiExerciseSuggestions(
        { client: api.client, profileId: api.current.profileId },
        {
          planId,
          dayIndex,
          limit: Math.min(limit, 20),
          query,
        },
      );
      return NextResponse.json({ suggestions });
    }

    const exercises = await searchExerciseCatalog(
      { client: api.client, profileId: api.current.profileId },
      { query, muscle, difficulty, limit },
    );
    return NextResponse.json({ exercises });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load exercises", {
      scope: "workout-planner.exercises.get",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-exercises-create",
      limit: 50,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as {
      name?: unknown;
      targetMuscle?: unknown;
      secondaryMuscles?: unknown;
      difficultyLevel?: unknown;
      equipmentRequired?: unknown;
      instructions?: unknown;
      cloudinaryImageId?: unknown;
      cloudinaryGifId?: unknown;
      visibility?: unknown;
    };

    const exercise = await createCustomExercise(
      { client: api.client, profileId: api.current.profileId },
      {
        name: String(payload.name ?? ""),
        targetMuscle: String(payload.targetMuscle ?? ""),
        secondaryMuscles: Array.isArray(payload.secondaryMuscles)
          ? payload.secondaryMuscles.map((item) => String(item))
          : [],
        difficultyLevel:
          String(payload.difficultyLevel ?? "").toLowerCase() === "beginner" ||
          String(payload.difficultyLevel ?? "").toLowerCase() === "advanced"
            ? (String(payload.difficultyLevel).toLowerCase() as
                | "beginner"
                | "advanced")
            : "intermediate",
        equipmentRequired: Array.isArray(payload.equipmentRequired)
          ? payload.equipmentRequired.map((item) => String(item))
          : [],
        instructions: Array.isArray(payload.instructions)
          ? payload.instructions.map((item) => String(item))
          : [],
        cloudinaryImageId:
          typeof payload.cloudinaryImageId === "string"
            ? payload.cloudinaryImageId
            : null,
        cloudinaryGifId:
          typeof payload.cloudinaryGifId === "string"
            ? payload.cloudinaryGifId
            : null,
        visibility:
          String(payload.visibility ?? "").toLowerCase() === "public"
            ? "public"
            : "private",
      },
    );
    return NextResponse.json({ exercise });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create custom exercise", {
      scope: "workout-planner.exercises.post",
    });
  }
}
