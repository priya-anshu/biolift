import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSmartExercises } from "@/lib/workout-planner/smartPlanner";
import {
  getNextWorkoutRecommendations,
  type TrainingIntelligenceRequest,
} from "@/lib/workout-planner/intelligenceEngine";
import type {
  CalendarStatusRequest,
  CalendarDayStatus,
  ManualPlanRequest,
  PlannerRequest,
  WorkoutLogRequest,
  ExerciseCatalogRow,
} from "@/lib/workout-planner/types";

type ServiceContext = {
  client: SupabaseClient;
  profileId: string;
};

type WorkoutPlanInsert = {
  user_id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  muscle_split: unknown;
  planning_mode: "smart" | "manual";
  created_by: "system" | "user";
  visibility: "public" | "private";
  notes: string | null;
};

function toDayIndex(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

async function loadExerciseCatalog(
  client: SupabaseClient,
): Promise<ExerciseCatalogRow[]> {
  const result = await client
    .from("exercises")
    .select(
      "id,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,instructions,cloudinary_image_id,cloudinary_gif_id,visibility",
    )
    .order("created_at", { ascending: false });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as ExerciseCatalogRow[];
}

function splitSummary(exercises: { dayIndex: number; muscleGroup: string }[]) {
  const grouped = new Map<number, string[]>();
  exercises.forEach((row) => {
    const current = grouped.get(row.dayIndex) ?? [];
    if (!current.includes(row.muscleGroup)) {
      current.push(row.muscleGroup);
    }
    grouped.set(row.dayIndex, current);
  });
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dayIndex, muscles]) => ({ dayIndex, muscles }));
}

async function insertPlan(
  context: ServiceContext,
  payload: WorkoutPlanInsert,
  exercises: Array<{
    day_index: number;
    exercise_order: number;
    exercise_id: string | null;
    exercise_name: string;
    muscle_group: string;
    sets: number;
    reps_min: number;
    reps_max: number;
    rest_seconds: number;
    tempo: string | null;
    rpe: number | null;
    notes: string | null;
    difficulty_level: string;
    equipment_required: string[];
    cloudinary_image_id: string | null;
    cloudinary_gif_id: string | null;
    created_by: "system" | "user";
    visibility: "public" | "private";
  }>,
) {
  const planRes = await context.client
    .from("workout_plans")
    .insert(payload)
    .select("id,name,goal,experience_level,workout_days_per_week,muscle_split,planning_mode,created_by,visibility,created_at")
    .single();

  if (planRes.error || !planRes.data) {
    throw new Error(planRes.error?.message ?? "Failed to create workout plan");
  }

  const exercisesPayload = exercises.map((exercise) => ({
    plan_id: planRes.data.id,
    ...exercise,
  }));

  if (exercisesPayload.length > 0) {
    const insertExercisesRes = await context.client
      .from("workout_plan_exercises")
      .insert(exercisesPayload);
    if (insertExercisesRes.error) {
      throw new Error(insertExercisesRes.error.message);
    }
  }

  return {
    plan: planRes.data,
    exercisesCount: exercisesPayload.length,
  };
}

export async function generateSmartPlan(
  context: ServiceContext,
  input: PlannerRequest,
) {
  const catalog = await loadExerciseCatalog(context.client);
  if (catalog.length === 0) {
    throw new Error(
      "Exercise catalog is empty. Run workout planner seed script first.",
    );
  }

  const smartRows = buildSmartExercises(input, catalog);
  const split = splitSummary(smartRows);
  const planInsert: WorkoutPlanInsert = {
    user_id: context.profileId,
    name: input.name || `${input.goal.replace("_", " ")} Smart Plan`,
    goal: input.goal,
    experience_level: input.experienceLevel,
    workout_days_per_week: input.workoutDaysPerWeek,
    muscle_split: split,
    planning_mode: "smart",
    created_by: "system",
    visibility: input.visibility ?? "private",
    notes: null,
  };

  const exerciseRows = smartRows.map((row) => ({
    day_index: row.dayIndex,
    exercise_order: row.exerciseOrder,
    exercise_id: row.exerciseId,
    exercise_name: row.exerciseName,
    muscle_group: row.muscleGroup,
    sets: row.sets,
    reps_min: row.repsMin,
    reps_max: row.repsMax,
    rest_seconds: row.restSeconds,
    tempo: row.tempo,
    rpe: row.rpe,
    notes: row.notes,
    difficulty_level: row.difficultyLevel,
    equipment_required: row.equipmentRequired,
    cloudinary_image_id: row.cloudinaryImageId,
    cloudinary_gif_id: row.cloudinaryGifId,
    created_by: "system" as const,
    visibility: input.visibility ?? "private",
  }));

  return insertPlan(context, planInsert, exerciseRows);
}

export async function createManualPlan(
  context: ServiceContext,
  input: ManualPlanRequest,
) {
  const split = splitSummary(
    input.exercises.map((item) => ({
      dayIndex: item.dayIndex,
      muscleGroup: item.muscleGroup,
    })),
  );
  const planInsert: WorkoutPlanInsert = {
    user_id: context.profileId,
    name: input.name,
    goal: input.goal,
    experience_level: input.experienceLevel,
    workout_days_per_week: input.workoutDaysPerWeek,
    muscle_split: split,
    planning_mode: "manual",
    created_by: "user",
    visibility: input.visibility ?? "private",
    notes: input.notes ?? null,
  };

  const exerciseRows = input.exercises.map((row) => ({
    day_index: row.dayIndex,
    exercise_order: row.exerciseOrder,
    exercise_id: row.exerciseId ?? null,
    exercise_name: row.exerciseName,
    muscle_group: row.muscleGroup,
    sets: row.sets,
    reps_min: row.repsMin,
    reps_max: row.repsMax,
    rest_seconds: row.restSeconds,
    tempo: row.tempo ?? null,
    rpe: row.rpe ?? null,
    notes: row.notes ?? null,
    difficulty_level: row.difficultyLevel,
    equipment_required: row.equipmentRequired ?? [],
    cloudinary_image_id: row.cloudinaryImageId ?? null,
    cloudinary_gif_id: row.cloudinaryGifId ?? null,
    created_by: "user" as const,
    visibility: row.visibility ?? "private",
  }));

  return insertPlan(context, planInsert, exerciseRows);
}

export async function listUserPlans(context: ServiceContext) {
  const plansRes = await context.client
    .from("workout_plans")
    .select(
      "id,name,goal,experience_level,workout_days_per_week,muscle_split,planning_mode,created_by,visibility,is_active,created_at",
    )
    .eq("user_id", context.profileId)
    .order("created_at", { ascending: false });

  if (plansRes.error) {
    throw new Error(plansRes.error.message);
  }
  return plansRes.data ?? [];
}

export async function updatePlanStatus(
  context: ServiceContext,
  planId: string,
  isActive: boolean,
) {
  const result = await context.client
    .from("workout_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .eq("user_id", context.profileId)
    .select("id,is_active")
    .maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (!result.data) {
    throw new Error("Plan not found or not owned by user");
  }
  return result.data;
}

function convertCalendarToWorkoutStatus(
  status: CalendarDayStatus,
): WorkoutLogRequest["status"] {
  if (status === "completed") return "completed";
  if (status === "missed") return "missed";
  if (status === "rest_day") return "rest_day";
  return "planned";
}

export async function upsertWorkoutLog(
  context: ServiceContext,
  input: WorkoutLogRequest,
) {
  const payload = {
    user_id: context.profileId,
    workout_date: input.date,
    plan_id: input.planId ?? null,
    status: input.status,
    completion_percentage: input.completionPercentage ?? 0,
    total_exercises: input.totalExercises ?? 0,
    exercises_completed: input.exercisesCompleted ?? 0,
    total_duration_minutes: input.totalDurationMinutes ?? 0,
    calories_burned: input.caloriesBurned ?? 0,
    notes: input.notes ?? null,
    source: input.source ?? "planner",
    started_at:
      input.status === "in_progress" || input.status === "completed"
        ? new Date().toISOString()
        : null,
    completed_at:
      input.status === "completed" || input.status === "missed" || input.status === "rest_day"
        ? new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  const existing = await context.client
    .from("workout_logs")
    .select("id")
    .eq("user_id", context.profileId)
    .eq("workout_date", input.date)
    .eq("source", payload.source)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    const updateRes = await context.client
      .from("workout_logs")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("user_id", context.profileId)
      .select("id,workout_date,status,completion_percentage,plan_id")
      .single();
    if (updateRes.error) {
      throw new Error(updateRes.error.message);
    }
    return updateRes.data;
  }

  const insertRes = await context.client
    .from("workout_logs")
    .insert(payload)
    .select("id,workout_date,status,completion_percentage,plan_id")
    .single();
  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }
  return insertRes.data;
}

async function computeStreak(context: ServiceContext, date: string) {
  const current = new Date(`${date}T00:00:00`);
  let streak = 0;
  for (let offset = 0; offset < 366; offset += 1) {
    const d = new Date(current);
    d.setDate(current.getDate() - offset);
    const isoDate = d.toISOString().slice(0, 10);
    const rowRes = await context.client
      .from("calendar_status")
      .select("status")
      .eq("user_id", context.profileId)
      .eq("status_date", isoDate)
      .maybeSingle();

    if (rowRes.error) {
      throw new Error(rowRes.error.message);
    }
    if (!rowRes.data || rowRes.data.status !== "completed") {
      break;
    }
    streak += 1;
  }
  return streak;
}

export async function upsertCalendarStatus(
  context: ServiceContext,
  input: CalendarStatusRequest,
) {
  let workoutLogId = input.workoutLogId ?? null;
  if (!workoutLogId) {
    const logRes = await upsertWorkoutLog(context, {
      date: input.date,
      status: convertCalendarToWorkoutStatus(input.status),
      completionPercentage: input.status === "completed" ? 100 : 0,
      source: "planner",
      notes: input.notes,
    });
    workoutLogId = logRes.id as string;
  }

  const provisionalStreak = input.status === "completed" ? 1 : 0;
  const upsertRes = await context.client
    .from("calendar_status")
    .upsert(
      {
        user_id: context.profileId,
        status_date: input.date,
        workout_log_id: workoutLogId,
        status: input.status,
        streak_count: provisionalStreak,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,status_date" },
    )
    .select("id,status_date,status,streak_count,workout_log_id")
    .single();
  if (upsertRes.error) {
    throw new Error(upsertRes.error.message);
  }

  if (input.status === "completed") {
    const streak = await computeStreak(context, input.date);
    const streakRes = await context.client
      .from("calendar_status")
      .update({ streak_count: streak })
      .eq("id", upsertRes.data.id)
      .eq("user_id", context.profileId)
      .select("id,status_date,status,streak_count,workout_log_id")
      .single();
    if (streakRes.error) {
      throw new Error(streakRes.error.message);
    }
    return streakRes.data;
  }

  return upsertRes.data;
}

export async function getCalendarMonth(
  context: ServiceContext,
  monthStart: Date,
  monthEnd: Date,
) {
  const fromDate = monthStart.toISOString().slice(0, 10);
  const toDate = new Date(monthEnd.getTime() - 86400000).toISOString().slice(0, 10);
  const result = await context.client
    .from("calendar_status")
    .select("id,status_date,status,streak_count,workout_log_id")
    .eq("user_id", context.profileId)
    .gte("status_date", fromDate)
    .lte("status_date", toDate)
    .order("status_date", { ascending: true });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data ?? [];
}

export async function getMotivationSnapshot(
  context: ServiceContext,
  language: "en" | "hi" | "bi",
) {
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const todayDayIndex = toDayIndex(todayDate);

  const activePlanRes = await context.client
    .from("workout_plans")
    .select("id,name,goal")
    .eq("user_id", context.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePlanRes.error) {
    throw new Error(activePlanRes.error.message);
  }

  const activePlan = activePlanRes.data;
  const todayExercisesRes = activePlan
    ? await context.client
        .from("workout_plan_exercises")
        .select("id,exercise_name,sets,reps_min,reps_max,rest_seconds")
        .eq("plan_id", activePlan.id)
        .eq("day_index", todayDayIndex)
        .order("exercise_order", { ascending: true })
    : { data: [], error: null };
  if (todayExercisesRes.error) {
    throw new Error(todayExercisesRes.error.message);
  }

  const todayLogRes = await context.client
    .from("workout_logs")
    .select(
      "id,status,completion_percentage,total_exercises,exercises_completed,total_duration_minutes,calories_burned",
    )
    .eq("user_id", context.profileId)
    .eq("workout_date", todayDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (todayLogRes.error) {
    throw new Error(todayLogRes.error.message);
  }

  const totalCompletedRes = await context.client
    .from("workout_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.profileId)
    .eq("status", "completed");
  if (totalCompletedRes.error) {
    throw new Error(totalCompletedRes.error.message);
  }

  const streak = await computeStreak(context, todayDate);

  const goalFocus = (activePlan?.goal ?? "general_fitness") as
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "general_fitness";
  const languages =
    language === "bi" ? ["bi", "en", "hi"] : [language, "bi", "en"];
  const messageRes = await context.client
    .from("motivational_messages")
    .select("id,language,message,priority")
    .eq("is_active", true)
    .in("language", languages)
    .in("goal_focus", [goalFocus, "general_fitness"])
    .order("priority", { ascending: false })
    .limit(20);
  if (messageRes.error) {
    throw new Error(messageRes.error.message);
  }

  const messages = (messageRes.data ?? []) as Array<{
    id: string;
    language: "en" | "hi" | "bi";
    message: string;
    priority: number;
  }>;
  messages.sort((a, b) => {
    const indexA = languages.indexOf(a.language);
    const indexB = languages.indexOf(b.language);
    if (indexA !== indexB) return indexA - indexB;
    return b.priority - a.priority;
  });
  const message = messages[0]?.message ?? "Stay consistent. Your next rep matters.";

  const completion =
    todayLogRes.data?.completion_percentage ??
    (todayExercisesRes.data?.length
      ? Math.round(
          ((todayLogRes.data?.exercises_completed ?? 0) /
            Math.max(1, todayLogRes.data?.total_exercises ?? todayExercisesRes.data.length)) *
            100,
        )
      : 0);

  return {
    date: todayDate,
    language,
    message,
    todayPlan: activePlan
      ? {
          id: activePlan.id,
          name: activePlan.name,
          exercises: todayExercisesRes.data ?? [],
        }
      : null,
    completionPercentage: Math.max(0, Math.min(100, Math.round(completion))),
    currentStreak: streak,
    totalCompletedWorkouts: totalCompletedRes.count ?? 0,
    todayLog: todayLogRes.data ?? null,
  };
}

export async function getWorkoutRecommendations(
  context: ServiceContext,
  input: TrainingIntelligenceRequest,
) {
  return getNextWorkoutRecommendations(
    { client: context.client, profileId: context.profileId },
    input,
  );
}
