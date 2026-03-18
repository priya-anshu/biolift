import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSmartExercises } from "@/lib/workout-planner/smartPlanner";
import type { ManualPlanRequest, PlanExerciseInput, PlannerRequest, ExerciseCatalogRow } from "@/lib/workout-planner/types";
import { ServiceContext, WorkoutPlanInsert, PlanExerciseRead, PlanWithExercisesRead, ExerciseSearchInput, CreateCustomExerciseInput, ExerciseSuggestionInput, UpdatePlanInput, EXERCISE_CATALOG_LIST_SELECT } from "./types";
import { toDayIndex, normalizeToken, normalizeStringArray, slugifyExerciseName, clampIntValue, parseNumeric } from "./utils";

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
    superset_group: string | null;
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
    superset_group: row.supersetGroup ?? null,
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
    superset_group: row.supersetGroup ?? null,
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

function mapPlanExerciseReadRow(row: Record<string, unknown>): PlanExerciseRead {
  return {
    id: String(row.id),
    plan_id: String(row.plan_id),
    day_index: clampIntValue(parseNumeric(row.day_index, 1), 1, 7),
    exercise_order: Math.max(1, Math.floor(parseNumeric(row.exercise_order, 1))),
    exercise_id:
      typeof row.exercise_id === "string" && row.exercise_id.trim().length > 0
        ? row.exercise_id
        : null,
    exercise_name: String(row.exercise_name ?? "Exercise"),
    muscle_group: String(row.muscle_group ?? ""),
    sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
    reps_min: clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
    reps_max: Math.max(
      clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
      clampIntValue(parseNumeric(row.reps_max, 12), 1, 120),
    ),
    rest_seconds: clampIntValue(parseNumeric(row.rest_seconds, 60), 15, 900),
    tempo: typeof row.tempo === "string" ? row.tempo : null,
    rpe:
      row.rpe === null || row.rpe === undefined ? null : Number(parseNumeric(row.rpe, 0).toFixed(1)),
    notes: typeof row.notes === "string" ? row.notes : null,
    superset_group:
      typeof row.superset_group === "string" && row.superset_group.trim().length > 0
        ? row.superset_group.trim().toUpperCase()
        : null,
    difficulty_level: String(row.difficulty_level ?? "intermediate"),
    equipment_required: normalizeStringArray(row.equipment_required),
    cloudinary_image_id:
      typeof row.cloudinary_image_id === "string" ? row.cloudinary_image_id : null,
    cloudinary_gif_id:
      typeof row.cloudinary_gif_id === "string" ? row.cloudinary_gif_id : null,
    created_by:
      normalizeToken(row.created_by) === "user" ? "user" : "system",
    visibility: normalizeToken(row.visibility) === "public" ? "public" : "private",
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getPlanWithExercises(
  context: ServiceContext,
  planId: string,
): Promise<PlanWithExercisesRead> {
  const planRes = await context.client
    .from("workout_plans")
    .select(
      "id,name,goal,experience_level,workout_days_per_week,muscle_split,planning_mode,created_by,visibility,is_active,notes,created_at,updated_at",
    )
    .eq("id", planId)
    .eq("user_id", context.profileId)
    .maybeSingle();
  if (planRes.error) throw new Error(planRes.error.message);
  if (!planRes.data) throw new Error("Plan not found or not owned by user");

  const exercisesRes = await context.client
    .from("workout_plan_exercises")
    .select(
      "id,plan_id,day_index,exercise_order,exercise_id,exercise_name,muscle_group,sets,reps_min,reps_max,rest_seconds,tempo,rpe,notes,superset_group,difficulty_level,equipment_required,cloudinary_image_id,cloudinary_gif_id,created_by,visibility,created_at,updated_at",
    )
    .eq("plan_id", planId)
    .order("day_index", { ascending: true })
    .order("exercise_order", { ascending: true });
  if (exercisesRes.error) throw new Error(exercisesRes.error.message);

  const plan = {
    id: String(planRes.data.id),
    name: String(planRes.data.name ?? "Plan"),
    goal: String(planRes.data.goal ?? "general_fitness"),
    experience_level: String(planRes.data.experience_level ?? "intermediate"),
    workout_days_per_week: clampIntValue(parseNumeric(planRes.data.workout_days_per_week, 4), 1, 7),
    muscle_split: planRes.data.muscle_split ?? [],
    planning_mode:
      normalizeToken(planRes.data.planning_mode) === "manual" ? "manual" : "smart",
    created_by:
      normalizeToken(planRes.data.created_by) === "user" ? "user" : "system",
    visibility: normalizeToken(planRes.data.visibility) === "public" ? "public" : "private",
    is_active: Boolean(planRes.data.is_active),
    notes: typeof planRes.data.notes === "string" ? planRes.data.notes : null,
    created_at: String(planRes.data.created_at ?? new Date().toISOString()),
    updated_at: String(planRes.data.updated_at ?? new Date().toISOString()),
  } as PlanWithExercisesRead["plan"];

  const exercises = (exercisesRes.data ?? []).map((row) =>
    mapPlanExerciseReadRow(row as Record<string, unknown>),
  );

  return { plan, exercises };
}

export async function replacePlanExercises(
  context: ServiceContext,
  planId: string,
  exercises: PlanExerciseInput[],
) {
  if (exercises.length === 0) {
    throw new Error("At least one exercise is required");
  }

  const ownerRes = await context.client
    .from("workout_plans")
    .select("id,user_id")
    .eq("id", planId)
    .eq("user_id", context.profileId)
    .maybeSingle();
  if (ownerRes.error) throw new Error(ownerRes.error.message);
  if (!ownerRes.data) throw new Error("Plan not found or not owned by user");

  const sorted = [...exercises].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.exerciseOrder - b.exerciseOrder;
  });

  const rows = sorted.map((row, index) => ({
    plan_id: planId,
    day_index: clampIntValue(parseNumeric(row.dayIndex, 1), 1, 7),
    exercise_order: index + 1,
    exercise_id: row.exerciseId ?? null,
    exercise_name: row.exerciseName,
    muscle_group: row.muscleGroup,
    sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
    reps_min: clampIntValue(parseNumeric(row.repsMin, 8), 1, 120),
    reps_max: clampIntValue(parseNumeric(row.repsMax, 12), 1, 120),
    rest_seconds: clampIntValue(parseNumeric(row.restSeconds, 60), 15, 900),
    tempo: row.tempo ?? null,
    rpe:
      row.rpe === undefined || row.rpe === null
        ? null
        : Number(parseNumeric(row.rpe, 0).toFixed(1)),
    notes: row.notes ?? null,
    superset_group:
      row.supersetGroup && row.supersetGroup.trim().length > 0
        ? row.supersetGroup.trim().toUpperCase().slice(0, 8)
        : null,
    difficulty_level: row.difficultyLevel,
    equipment_required: row.equipmentRequired ?? [],
    cloudinary_image_id: row.cloudinaryImageId ?? null,
    cloudinary_gif_id: row.cloudinaryGifId ?? null,
    created_by: row.createdBy === "system" ? "system" : "user",
    visibility: row.visibility === "public" ? "public" : "private",
  }));

  // Rebuild deterministic per-day exercise order.
  const byDay = new Map<number, typeof rows>();
  rows.forEach((row) => {
    const current = byDay.get(row.day_index) ?? [];
    current.push(row);
    byDay.set(row.day_index, current);
  });
  const normalizedRows = Array.from(byDay.entries()).flatMap(([dayIndex, dayRows]) =>
    dayRows.map((row, dayOrder) => ({
      ...row,
      day_index: dayIndex,
      exercise_order: dayOrder + 1,
    })),
  );

  const deleteRes = await context.client
    .from("workout_plan_exercises")
    .delete()
    .eq("plan_id", planId);
  if (deleteRes.error) throw new Error(deleteRes.error.message);

  const insertRes = await context.client
    .from("workout_plan_exercises")
    .insert(normalizedRows);
  if (insertRes.error) throw new Error(insertRes.error.message);

  const split = splitSummary(
    sorted.map((item) => ({ dayIndex: item.dayIndex, muscleGroup: item.muscleGroup })),
  );
  const touchRes = await context.client
    .from("workout_plans")
    .update({
      muscle_split: split,
      planning_mode: "manual",
      created_by: "user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("user_id", context.profileId);
  if (touchRes.error) throw new Error(touchRes.error.message);

  return getPlanWithExercises(context, planId);
}

export async function searchExerciseCatalog(
  context: ServiceContext,
  input: ExerciseSearchInput,
) {
  const limit = clampIntValue(parseNumeric(input.limit, 40), 1, 100);
  const normalizedQuery = normalizeToken(input.query);
  const normalizedMuscle = normalizeToken(input.muscle);
  const normalizedDifficulty = normalizeToken(input.difficulty);

  let query = context.client
    .from("exercises")
    .select(EXERCISE_CATALOG_LIST_SELECT)
    .order("name", { ascending: true })
    .limit(limit);

  if (normalizedMuscle) {
    query = query.eq("target_muscle", normalizedMuscle);
  }
  if (normalizedDifficulty) {
    query = query.eq("difficulty_level", normalizedDifficulty);
  }
  if (normalizedQuery) {
    query = query.or(
      `name.ilike.%${normalizedQuery}%,target_muscle.ilike.%${normalizedQuery}%`,
    );
  }

  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function createCustomExercise(
  context: ServiceContext,
  input: CreateCustomExerciseInput,
) {
  const name = String(input.name ?? "").trim();
  const targetMuscle = normalizeToken(input.targetMuscle);
  if (!name) {
    throw new Error("Exercise name is required");
  }
  if (!targetMuscle) {
    throw new Error("targetMuscle is required");
  }
  const difficulty =
    normalizeToken(input.difficultyLevel) === "beginner" ||
    normalizeToken(input.difficultyLevel) === "advanced"
      ? (normalizeToken(input.difficultyLevel) as "beginner" | "advanced")
      : "intermediate";

  const baseSlug = slugifyExerciseName(name);
  const candidateSlug = baseSlug.length > 0 ? baseSlug : `custom-${Date.now()}`;
  const uniqueSuffix = Math.random().toString(36).slice(2, 7);
  const slug = `${candidateSlug}-${uniqueSuffix}`;

  const res = await context.client
    .from("exercises")
    .insert({
      slug,
      name,
      target_muscle: targetMuscle,
      secondary_muscles: normalizeStringArray(input.secondaryMuscles),
      difficulty_level: difficulty,
      equipment_required: normalizeStringArray(input.equipmentRequired),
      instructions: normalizeStringArray(input.instructions),
      cloudinary_image_id: input.cloudinaryImageId ?? null,
      cloudinary_gif_id: input.cloudinaryGifId ?? null,
      created_by: context.profileId,
      visibility: input.visibility === "public" ? "public" : "private",
    })
    .select(
      "id,slug,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,instructions,cloudinary_image_id,cloudinary_gif_id,visibility",
    )
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getAiExerciseSuggestions(
  context: ServiceContext,
  input: ExerciseSuggestionInput,
) {
  const limit = clampIntValue(parseNumeric(input.limit, 8), 1, 20);
  const plan = await getPlanWithExercises(context, input.planId);
  const dayIndex = clampIntValue(
    parseNumeric(input.dayIndex, toDayIndex(new Date().toISOString().slice(0, 10))),
    1,
    7,
  );
  const dayExercises = plan.exercises.filter((row) => row.day_index === dayIndex);
  const targetMuscles = Array.from(
    new Set(dayExercises.map((row) => normalizeToken(row.muscle_group)).filter(Boolean)),
  );
  const excludeIds = new Set(
    dayExercises
      .map((row) => row.exercise_id)
      .filter((value): value is string => Boolean(value)),
  );
  const preferredDifficulty = normalizeToken(plan.plan.experience_level);
  const queryText = normalizeToken(input.query);

  let query = context.client
    .from("exercises")
    .select(EXERCISE_CATALOG_LIST_SELECT)
    .limit(200);

  if (targetMuscles.length > 0) {
    query = query.in("target_muscle", targetMuscles);
  }
  if (preferredDifficulty === "beginner" || preferredDifficulty === "intermediate") {
    query = query.in("difficulty_level", ["beginner", preferredDifficulty]);
  }
  if (queryText) {
    query = query.or(`name.ilike.%${queryText}%,target_muscle.ilike.%${queryText}%`);
  }

  const res = await query;
  if (res.error) throw new Error(res.error.message);

  const rows = (res.data ?? [])
    .filter((row) => !excludeIds.has(String(row.id)))
    .map((row) => ({
      row,
      score:
        (targetMuscles.includes(normalizeToken(row.target_muscle)) ? 3 : 0) +
        (normalizeToken(row.difficulty_level) === preferredDifficulty ? 2 : 0) +
        (dayExercises.some((item) =>
          normalizeStringArray(item.equipment_required).some((eq) =>
            normalizeStringArray(row.equipment_required).includes(eq),
          ),
        )
          ? 1
          : 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || String(a.row.name).localeCompare(String(b.row.name)),
    )
    .slice(0, limit)
    .map(({ row }) => row);

  return rows;
}

export async function updatePlan(
  context: ServiceContext,
  planId: string,
  input: UpdatePlanInput,
) {
  const payload: Record<string, unknown> = {};
  if (typeof input.isActive === "boolean") {
    payload.is_active = input.isActive;
  }
  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
      throw new Error("Plan name is required");
    }
    payload.name = trimmed;
  }
  if (typeof input.goal === "string") {
    payload.goal = input.goal;
  }
  if (typeof input.workoutDaysPerWeek === "number") {
    payload.workout_days_per_week = Math.max(1, Math.min(7, Math.floor(input.workoutDaysPerWeek)));
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("No plan updates provided");
  }

  const result = await context.client
    .from("workout_plans")
    .update(payload)
    .eq("id", planId)
    .eq("user_id", context.profileId)
    .select(
      "id,name,goal,experience_level,workout_days_per_week,muscle_split,planning_mode,created_by,visibility,is_active,created_at",
    )
    .maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (!result.data) {
    throw new Error("Plan not found or not owned by user");
  }
  return result.data;
}

export async function updatePlanStatus(
  context: ServiceContext,
  planId: string,
  isActive: boolean,
) {
  return updatePlan(context, planId, { isActive });
}