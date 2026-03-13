import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSmartExercises } from "@/lib/workout-planner/smartPlanner";
import {
  getNextWorkoutRecommendations,
  type TrainingIntelligenceRequest,
  type TrainingIntelligenceResult,
} from "@/lib/workout-planner/intelligenceEngine";
import { applyTrainingBrain } from "@/lib/workout-planner/trainingBrain";
import type {
  CalendarStatusRequest,
  CalendarDayStatus,
  ManualPlanRequest,
  PlanExerciseInput,
  PlannerRequest,
  WorkoutLogRequest,
  ExerciseCatalogRow,
} from "@/lib/workout-planner/types";

type ServiceContext = {
  client: SupabaseClient;
  profileId: string;
};

type NormalizedRecommendationRequest = {
  workoutDate: string;
  planId?: string;
  dayIndex: number;
  lookbackDays: number;
};

export type WorkoutRecommendationRead = {
  recommendations: TrainingIntelligenceResult;
  cacheState: "exact" | "plan_fallback" | "baseline";
  cacheTtl: {
    exists: boolean;
    isStale: boolean;
    updatedAt: string | null;
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
  };
};

const RECOMMENDATION_LOOKBACK_MIN = 14;
const RECOMMENDATION_LOOKBACK_MAX = 90;
const RECOMMENDATION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const NO_WORKOUT_PLAN_ERROR = "No workout plan available";

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

export type PlanExerciseRead = {
  id: string;
  plan_id: string;
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
  created_at: string;
  updated_at: string;
};

const EXERCISE_CATALOG_LIST_SELECT =
  "id,slug,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,cloudinary_image_id,cloudinary_gif_id,visibility";

export type PlanWithExercisesRead = {
  plan: {
    id: string;
    name: string;
    goal: string;
    experience_level: string;
    workout_days_per_week: number;
    muscle_split: unknown;
    planning_mode: "smart" | "manual";
    created_by: "system" | "user";
    visibility: "public" | "private";
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  exercises: PlanExerciseRead[];
};

export type ExerciseSearchInput = {
  query?: string;
  muscle?: string;
  difficulty?: string;
  limit?: number;
};

export type CreateCustomExerciseInput = {
  name: string;
  targetMuscle: string;
  secondaryMuscles?: string[];
  difficultyLevel?: "beginner" | "intermediate" | "advanced";
  equipmentRequired?: string[];
  instructions?: string[];
  cloudinaryImageId?: string | null;
  cloudinaryGifId?: string | null;
  visibility?: "public" | "private";
};

export type ExerciseSuggestionInput = {
  planId: string;
  dayIndex?: number;
  limit?: number;
  query?: string;
};

function toDayIndex(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function normalizeToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function slugifyExerciseName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeRecommendationInput(
  input: TrainingIntelligenceRequest,
): NormalizedRecommendationRequest {
  const workoutDate =
    typeof input.workoutDate === "string" ? input.workoutDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
    throw new Error("workoutDate must be YYYY-MM-DD");
  }

  const lookbackDays = clampIntValue(
    input.lookbackDays ?? 42,
    RECOMMENDATION_LOOKBACK_MIN,
    RECOMMENDATION_LOOKBACK_MAX,
  );
  const dayIndex = clampIntValue(
    input.dayIndex ?? toDayIndex(workoutDate),
    1,
    7,
  );
  const planId =
    typeof input.planId === "string" && input.planId.trim().length > 0
      ? input.planId.trim()
      : undefined;

  return {
    workoutDate,
    planId,
    dayIndex,
    lookbackDays,
  };
}

async function resolvePlanIdForRecommendations(
  context: ServiceContext,
  explicitPlanId?: string,
) {
  if (explicitPlanId) {
    return explicitPlanId;
  }

  const activePlan = await context.client
    .from("workout_plans")
    .select("id")
    .eq("user_id", context.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePlan.error) {
    throw new Error(activePlan.error.message);
  }
  if (activePlan.data?.id) {
    return String(activePlan.data.id);
  }

  const fallbackPlan = await context.client
    .from("workout_plans")
    .select("id")
    .eq("user_id", context.profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackPlan.error) {
    throw new Error(fallbackPlan.error.message);
  }
  if (!fallbackPlan.data?.id) {
    throw new Error(NO_WORKOUT_PLAN_ERROR);
  }

  return String(fallbackPlan.data.id);
}

export function isNoWorkoutPlanError(error: unknown) {
  return error instanceof Error && error.message === NO_WORKOUT_PLAN_ERROR;
}

function isMissingRecommendationCacheTable(errorCode: string | null | undefined) {
  return errorCode === "42P01" || errorCode === "42703";
}

async function loadCachedWorkoutRecommendations(
  context: ServiceContext,
  input: {
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
    allowStale?: boolean;
  },
) {
  const cacheRes = await context.client
    .from("ai_recommendations")
    .select("result_json,generated_at,updated_at")
    .eq("user_id", context.profileId)
    .eq("plan_id", input.planId)
    .eq("workout_date", input.workoutDate)
    .eq("day_index", input.dayIndex)
    .eq("lookback_days", input.lookbackDays)
    .limit(1)
    .maybeSingle();

  if (cacheRes.error) {
    if (isMissingRecommendationCacheTable(cacheRes.error.code)) {
      return null;
    }
    throw new Error(cacheRes.error.message);
  }

  if (!cacheRes.data) return null;
  const generatedAtMs = new Date(String(cacheRes.data.generated_at ?? "")).getTime();
  const isFresh =
    Number.isFinite(generatedAtMs) &&
    Date.now() - generatedAtMs <= RECOMMENDATION_CACHE_MAX_AGE_MS;
  if (!isFresh && !input.allowStale) return null;

  const payload = cacheRes.data.result_json as TrainingIntelligenceResult | null;
  if (!payload || typeof payload !== "object") return null;
  return {
    payload,
    ttl: {
      exists: true,
      isStale: !isFresh,
      updatedAt: cacheRes.data.updated_at
        ? String(cacheRes.data.updated_at)
        : cacheRes.data.generated_at
          ? String(cacheRes.data.generated_at)
          : null,
      planId: input.planId,
      workoutDate: input.workoutDate,
      dayIndex: input.dayIndex,
      lookbackDays: input.lookbackDays,
    },
  };
}

async function loadPlanFallbackWorkoutRecommendations(
  context: ServiceContext,
  input: { planId: string },
) {
  const cacheRes = await context.client
    .from("ai_recommendations")
    .select("result_json,generated_at")
    .eq("user_id", context.profileId)
    .eq("plan_id", input.planId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheRes.error) {
    if (isMissingRecommendationCacheTable(cacheRes.error.code)) {
      return null;
    }
    throw new Error(cacheRes.error.message);
  }

  const payload = cacheRes.data?.result_json as TrainingIntelligenceResult | null;
  if (!payload || typeof payload !== "object") return null;
  return payload;
}

async function buildBaselineWorkoutRecommendations(
  context: ServiceContext,
  input: { planId: string; workoutDate: string; dayIndex: number },
): Promise<TrainingIntelligenceResult> {
  const dayRowsRes = await context.client
    .from("workout_plan_exercises")
    .select(
      "id,day_index,exercise_order,exercise_id,sets,reps_min,reps_max,rest_seconds",
    )
    .eq("plan_id", input.planId)
    .eq("day_index", input.dayIndex)
    .order("exercise_order", { ascending: true });
  if (dayRowsRes.error) {
    throw new Error(dayRowsRes.error.message);
  }

  const rows = dayRowsRes.data ?? [];

  if (rows.length === 0) {
    const fallbackDayRes = await context.client
      .from("workout_plan_exercises")
      .select(
        "id,day_index,exercise_order,exercise_id,sets,reps_min,reps_max,rest_seconds",
      )
      .eq("plan_id", input.planId)
      .order("day_index", { ascending: true })
      .order("exercise_order", { ascending: true })
      .limit(100);
    if (fallbackDayRes.error) {
      throw new Error(fallbackDayRes.error.message);
    }
    const firstDay = fallbackDayRes.data?.[0]?.day_index;
    const fallbackRows =
      firstDay === undefined || firstDay === null
        ? []
        : (fallbackDayRes.data ?? []).filter((row) => row.day_index === firstDay);
    return {
      plan_id: input.planId,
      workout_date: input.workoutDate,
      effective_day_index: Number(firstDay ?? input.dayIndex),
      readiness_band: "yellow",
      readiness_score: null,
      fatigue_score: 50,
      adherence_score: 50,
      recommendations: fallbackRows.map((row) => ({
        exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        original_exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        plan_exercise_id: String(row.id),
        recommended_weight: null,
        recommended_reps: {
          min: clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
          max: clampIntValue(parseNumeric(row.reps_max, 12), 1, 120),
        },
        recommended_sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
        rest_seconds: clampIntValue(parseNumeric(row.rest_seconds, 60), 15, 900),
        exercise_substitution: null,
        progression_action: "maintain" as const,
        recommendation_reason: [
          "Using baseline plan while AI cache is being prepared.",
        ],
        metrics: {
          latest_e1rm: null,
          weekly_volume_kg: 0,
          volume_trend_7d_pct: 0,
          strength_rate_pct_week: null,
          recent_avg_reps: null,
          recent_avg_rpe: null,
          failed_sets_recent: 0,
        },
      })),
    };
  }

  return {
    plan_id: input.planId,
    workout_date: input.workoutDate,
    effective_day_index: input.dayIndex,
    readiness_band: "yellow",
    readiness_score: null,
    fatigue_score: 50,
    adherence_score: 50,
    recommendations: rows.map((row) => ({
      exercise_id: row.exercise_id ? String(row.exercise_id) : null,
      original_exercise_id: row.exercise_id ? String(row.exercise_id) : null,
      plan_exercise_id: String(row.id),
      recommended_weight: null,
      recommended_reps: {
        min: clampIntValue(parseNumeric(row.reps_min, 8), 1, 120),
        max: clampIntValue(parseNumeric(row.reps_max, 12), 1, 120),
      },
      recommended_sets: clampIntValue(parseNumeric(row.sets, 3), 1, 20),
      rest_seconds: clampIntValue(parseNumeric(row.rest_seconds, 60), 15, 900),
      exercise_substitution: null,
      progression_action: "maintain" as const,
      recommendation_reason: [
        "Using baseline plan while AI cache is being prepared.",
      ],
      metrics: {
        latest_e1rm: null,
        weekly_volume_kg: 0,
        volume_trend_7d_pct: 0,
        strength_rate_pct_week: null,
        recent_avg_reps: null,
        recent_avg_rpe: null,
        failed_sets_recent: 0,
      },
    })),
  };
}

async function upsertWorkoutRecommendationCache(
  context: ServiceContext,
  input: {
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
    result: TrainingIntelligenceResult;
  },
) {
  const upsertRes = await context.client.from("ai_recommendations").upsert(
    {
      user_id: context.profileId,
      plan_id: input.planId,
      workout_date: input.workoutDate,
      day_index: input.dayIndex,
      lookback_days: input.lookbackDays,
      result_json: input.result,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,plan_id,workout_date,day_index,lookback_days",
    },
  );

  if (upsertRes.error && !isMissingRecommendationCacheTable(upsertRes.error.code)) {
    throw new Error(upsertRes.error.message);
  }
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

export type UpdatePlanInput = {
  isActive?: boolean;
  name?: string;
  goal?: string;
  workoutDaysPerWeek?: number;
};

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
  const nowIso = new Date().toISOString();
  const shouldSetStartedAt =
    input.status === "in_progress" || input.status === "completed";
  const shouldSetCompletedAt =
    input.status === "completed" ||
    input.status === "missed" ||
    input.status === "rest_day";

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
    updated_at: nowIso,
  };

  const existing = await context.client
    .from("workout_logs")
    .select("id,started_at,completed_at")
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
    const existingStartedAt =
      typeof existing.data.started_at === "string" ? existing.data.started_at : null;
    const existingCompletedAt =
      typeof existing.data.completed_at === "string" ? existing.data.completed_at : null;

    const updateRes = await context.client
      .from("workout_logs")
      .update({
        ...payload,
        started_at: shouldSetStartedAt
          ? existingStartedAt ?? nowIso
          : existingStartedAt,
        completed_at: shouldSetCompletedAt
          ? existingCompletedAt ?? nowIso
          : existingCompletedAt,
      })
      .eq("id", existing.data.id)
      .eq("user_id", context.profileId)
      .select("id,workout_date,status,completion_percentage,plan_id,started_at,completed_at")
      .single();
    if (updateRes.error) {
      throw new Error(updateRes.error.message);
    }
    return updateRes.data;
  }

  const insertRes = await context.client
    .from("workout_logs")
    .insert({
      ...payload,
      started_at: shouldSetStartedAt ? nowIso : null,
      completed_at: shouldSetCompletedAt ? nowIso : null,
    })
    .select("id,workout_date,status,completion_percentage,plan_id,started_at,completed_at")
    .single();
  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }
  return insertRes.data;
}

async function computeStreak(context: ServiceContext, date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(current.getTime())) return 0;

  const fromDate = new Date(current);
  fromDate.setUTCDate(fromDate.getUTCDate() - 365);

  const rowsRes = await context.client
    .from("calendar_status")
    .select("status_date")
    .eq("user_id", context.profileId)
    .eq("status", "completed")
    .gte("status_date", fromDate.toISOString().slice(0, 10))
    .lte("status_date", date)
    .order("status_date", { ascending: false })
    .limit(366);

  if (rowsRes.error) {
    throw new Error(rowsRes.error.message);
  }

  const completedDates = new Set(
    (rowsRes.data ?? []).map((row) => String(row.status_date)),
  );
  let streak = 0;
  const cursor = new Date(current);
  while (streak < 366) {
    const key = cursor.toISOString().slice(0, 10);
    if (!completedDates.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
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
  const goalFocus = (activePlan?.goal ?? "general_fitness") as
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "general_fitness";
  const languages =
    language === "bi" ? ["bi", "en", "hi"] : [language, "bi", "en"];

  const [todayExercisesRes, todayLogRes, totalCompletedRes, streak, messageRes] =
    await Promise.all([
      activePlan
        ? context.client
            .from("workout_plan_exercises")
            .select("id,exercise_name,sets,reps_min,reps_max,rest_seconds")
            .eq("plan_id", activePlan.id)
            .eq("day_index", todayDayIndex)
            .order("exercise_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      context.client
        .from("workout_logs")
        .select(
          "id,status,completion_percentage,total_exercises,exercises_completed,total_duration_minutes,calories_burned",
        )
        .eq("user_id", context.profileId)
        .eq("workout_date", todayDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.client
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.profileId)
        .eq("status", "completed"),
      computeStreak(context, todayDate),
      context.client
        .from("motivational_messages")
        .select("id,language,message,priority")
        .eq("is_active", true)
        .in("language", languages)
        .in("goal_focus", [goalFocus, "general_fitness"])
        .order("priority", { ascending: false })
        .limit(20),
    ]);

  if (todayExercisesRes.error) throw new Error(todayExercisesRes.error.message);
  if (todayLogRes.error) throw new Error(todayLogRes.error.message);
  if (totalCompletedRes.error) throw new Error(totalCompletedRes.error.message);
  if (messageRes.error) throw new Error(messageRes.error.message);

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
): Promise<WorkoutRecommendationRead> {
  const normalized = normalizeRecommendationInput(input);
  const planId = await resolvePlanIdForRecommendations(context, normalized.planId);
  const cacheTtl = {
    exists: false,
    isStale: false,
    updatedAt: null as string | null,
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
  };
  const cacheHit = await loadCachedWorkoutRecommendations(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
    allowStale: true,
  });
  if (cacheHit) {
    return {
      recommendations: cacheHit.payload,
      cacheState: "exact",
      cacheTtl: cacheHit.ttl,
    };
  }

  const planFallback = await loadPlanFallbackWorkoutRecommendations(context, {
    planId,
  });
  if (planFallback) {
    return {
      recommendations: planFallback,
      cacheState: "plan_fallback",
      cacheTtl,
    };
  }

  const baseline = await buildBaselineWorkoutRecommendations(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
  });
  return {
    recommendations: baseline,
    cacheState: "baseline",
    cacheTtl,
  };
}

export async function primeWorkoutRecommendationCache(
  context: ServiceContext,
  input: TrainingIntelligenceRequest,
) {
  const normalized = normalizeRecommendationInput(input);
  const planId = await resolvePlanIdForRecommendations(context, normalized.planId);
  const baseResult = await getNextWorkoutRecommendations(
    { client: context.client, profileId: context.profileId },
    {
      workoutDate: normalized.workoutDate,
      lookbackDays: normalized.lookbackDays,
      dayIndex: normalized.dayIndex,
      planId,
    },
  );
  const result = await applyTrainingBrain(
    { client: context.client, profileId: context.profileId },
    {
      workoutDate: normalized.workoutDate,
      result: baseResult,
    },
  );
  await upsertWorkoutRecommendationCache(context, {
    planId,
    workoutDate: normalized.workoutDate,
    dayIndex: normalized.dayIndex,
    lookbackDays: normalized.lookbackDays,
    result,
  });
  return result;
}

function toIsoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysAgoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function clampIntValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseNumeric(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function getDashboardSummary(
  context: ServiceContext,
  input?: {
    days?: number;
    recentLimit?: number;
    includeMotivation?: boolean;
    language?: "en" | "hi" | "bi";
  },
) {
  const days = clampIntValue(input?.days ?? 7, 1, 60);
  const recentLimit = clampIntValue(input?.recentLimit ?? 6, 1, 30);
  const fromDate = toIsoDateOnly(daysAgoDate(days - 1));
  const fromIso = daysAgoDate(days).toISOString();
  const motivationPromise = input?.includeMotivation
    ? getMotivationSnapshot(context, input.language ?? "en")
    : Promise.resolve(null);

  const [logsRes, goalsRes, heartRes, motivation] = await Promise.all([
    context.client
      .from("workout_logs")
      .select(
        "id,workout_date,status,total_duration_minutes,calories_burned,source,created_at",
      )
      .eq("user_id", context.profileId)
      .gte("workout_date", fromDate)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    context.client
      .from("goals")
      .select("id,title,current_value,target_value,unit")
      .eq("user_id", context.profileId)
      .order("created_at", { ascending: false })
      .limit(3),
    context.client
      .from("progress_entries")
      .select("value")
      .eq("user_id", context.profileId)
      .eq("metric", "heart_rate")
      .gte("recorded_at", fromIso),
    motivationPromise,
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);
  if (heartRes.error) throw new Error(heartRes.error.message);

  const statsSnapshotRes = await context.client
    .from("user_training_stats")
    .select(
      "snapshot_date,week_start_date,workouts_completed_7d,weekly_volume_kg,streak_days,fatigue_score,readiness_score,consistency_score,acwr,overtraining_risk,optimal_volume_kg",
    )
    .eq("user_id", context.profileId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    statsSnapshotRes.error &&
    statsSnapshotRes.error.code !== "42P01" &&
    statsSnapshotRes.error.code !== "42703"
  ) {
    throw new Error(statsSnapshotRes.error.message);
  }

  const logs = (logsRes.data ?? []) as Array<{
    id: string;
    workout_date: string;
    status: string;
    total_duration_minutes: number;
    calories_burned: number;
    source: string;
    created_at: string;
  }>;

  const recentLogIds = logs.slice(0, recentLimit).map((row) => row.id);
  const exerciseRes =
    recentLogIds.length > 0
      ? await context.client
          .from("workout_log_exercises")
          .select("workout_log_id,exercise_name,exercise_order")
          .eq("user_id", context.profileId)
          .in("workout_log_id", recentLogIds)
          .order("exercise_order", { ascending: true })
      : { data: [], error: null };
  if (exerciseRes.error) throw new Error(exerciseRes.error.message);

  const firstExerciseByLog = new Map<string, string>();
  (exerciseRes.data ?? []).forEach((row) => {
    const logId = String(row.workout_log_id);
    if (firstExerciseByLog.has(logId)) return;
    const name = String(row.exercise_name ?? "").trim();
    if (name.length > 0) {
      firstExerciseByLog.set(logId, name);
    }
  });

  const completedStatuses = new Set(["completed", "in_progress"]);
  const workoutsThisPeriod = logs.filter((row) =>
    completedStatuses.has(String(row.status)),
  ).length;
  const caloriesBurned = logs.reduce(
    (sum, row) => sum + parseNumeric(row.calories_burned, 0),
    0,
  );
  const activeMinutes = logs.reduce(
    (sum, row) => sum + parseNumeric(row.total_duration_minutes, 0),
    0,
  );

  const recentActivity = logs.slice(0, recentLimit).map((row) => {
    const exerciseName = firstExerciseByLog.get(row.id);
    const baseName =
      exerciseName ??
      (row.source === "manual" ? "Manual Workout" : "Planner Workout");
    return {
      id: row.id,
      name: baseName,
      type: row.source ?? "workout",
      duration_minutes: Math.max(0, Math.floor(parseNumeric(row.total_duration_minutes, 0))),
      calories: Math.max(0, Math.floor(parseNumeric(row.calories_burned, 0))),
      performed_at: `${row.workout_date}T00:00:00.000Z`,
      status: row.status,
    };
  });

  const heartRows = (heartRes.data ?? []) as Array<{ value: number }>;
  const heartRateAvg =
    heartRows.length > 0
      ? Math.round(
          heartRows.reduce((sum, row) => sum + parseNumeric(row.value, 0), 0) /
            heartRows.length,
        )
      : null;

  return {
    days,
    metrics: {
      workoutsThisPeriod,
      caloriesBurned,
      activeMinutes,
    },
    trainingStats:
      statsSnapshotRes.error || !statsSnapshotRes.data ? null : statsSnapshotRes.data,
    recentActivity,
    goals: goalsRes.data ?? [],
    heartRateAvg,
    motivation,
  };
}

export async function getProgressOverview(
  context: ServiceContext,
  range: "week" | "month",
) {
  const days = range === "week" ? 7 : 30;
  const fromDate = toIsoDateOnly(daysAgoDate(days - 1));
  const fromIso = daysAgoDate(days).toISOString();
  const bodyWeightFromIso = daysAgoDate(range === "week" ? 30 : 120).toISOString();
  const snapshotFromDate = toIsoDateOnly(daysAgoDate(range === "week" ? 35 : 180));

  const [logsRes, goalsRes, heartRes, bodyWeightRes] = await Promise.all([
    context.client
      .from("workout_logs")
      .select(
        "id,workout_date,status,total_duration_minutes,calories_burned,source,created_at,completion_percentage",
      )
      .eq("user_id", context.profileId)
      .gte("workout_date", fromDate)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false }),
    context.client
      .from("goals")
      .select("id,title,current_value,target_value,unit")
      .eq("user_id", context.profileId)
      .order("created_at", { ascending: false })
      .limit(4),
    context.client
      .from("progress_entries")
      .select("id,value,metric,recorded_at")
      .eq("user_id", context.profileId)
      .eq("metric", "heart_rate")
      .gte("recorded_at", fromIso),
    context.client
      .from("progress_entries")
      .select("id,value,metric,recorded_at")
      .eq("user_id", context.profileId)
      .eq("metric", "body_weight")
      .gte("recorded_at", bodyWeightFromIso)
      .order("recorded_at", { ascending: true }),
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);
  if (heartRes.error) throw new Error(heartRes.error.message);
  if (bodyWeightRes.error) throw new Error(bodyWeightRes.error.message);

  const [trainingStatsRes, trainingStatsHistoryRes, exerciseStatsRes] = await Promise.all([
    context.client
      .from("user_training_stats")
      .select(
        "snapshot_date,week_start_date,workouts_completed_7d,weekly_volume_kg,streak_days,fatigue_score,readiness_score,consistency_score,acwr,overtraining_risk,optimal_volume_kg",
      )
      .eq("user_id", context.profileId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("user_training_stats")
      .select(
        "snapshot_date,week_start_date,workouts_completed_7d,weekly_volume_kg,streak_days,consistency_score,readiness_score,acwr,overtraining_risk,optimal_volume_kg",
      )
      .eq("user_id", context.profileId)
      .gte("snapshot_date", snapshotFromDate)
      .order("snapshot_date", { ascending: true })
      .limit(range === "week" ? 42 : 220),
    context.client
      .from("exercise_volume_stats")
      .select(
        "week_start_date,exercise_id,sets_completed,reps_completed,weekly_volume_kg,best_weight_kg,best_estimated_1rm",
      )
      .eq("user_id", context.profileId)
      .order("week_start_date", { ascending: false })
      .limit(range === "week" ? 30 : 100),
  ]);
  if (
    trainingStatsRes.error &&
    trainingStatsRes.error.code !== "42P01" &&
    trainingStatsRes.error.code !== "42703"
  ) {
    throw new Error(trainingStatsRes.error.message);
  }
  if (
    trainingStatsHistoryRes.error &&
    trainingStatsHistoryRes.error.code !== "42P01" &&
    trainingStatsHistoryRes.error.code !== "42703"
  ) {
    throw new Error(trainingStatsHistoryRes.error.message);
  }
  if (
    exerciseStatsRes.error &&
    exerciseStatsRes.error.code !== "42P01" &&
    exerciseStatsRes.error.code !== "42703"
  ) {
    throw new Error(exerciseStatsRes.error.message);
  }

  const exerciseVolumeRows = exerciseStatsRes.error ? [] : exerciseStatsRes.data ?? [];
  const exerciseIds = Array.from(
    new Set(
      exerciseVolumeRows
        .map((row) => String(row.exercise_id ?? ""))
        .filter(Boolean),
    ),
  );
  const exerciseCatalogRes =
    exerciseIds.length > 0
      ? await context.client
          .from("exercises")
          .select("id,name")
          .in("id", exerciseIds)
      : { data: [], error: null };
  if (exerciseCatalogRes.error) throw new Error(exerciseCatalogRes.error.message);
  const exerciseNameById = new Map(
    (exerciseCatalogRes.data ?? []).map((row) => [
      String(row.id),
      String(row.name ?? "Exercise"),
    ]),
  );

  const logs = (logsRes.data ?? []) as Array<{
    id: string;
    workout_date: string;
    status: string;
    total_duration_minutes: number;
    calories_burned: number;
    source: string;
    created_at: string;
    completion_percentage: number;
  }>;

  const logIds = logs.map((row) => row.id);
  const exerciseRes =
    logIds.length > 0
      ? await context.client
          .from("workout_log_exercises")
          .select("workout_log_id,exercise_name,exercise_order,total_volume_kg")
          .eq("user_id", context.profileId)
          .in("workout_log_id", logIds)
          .order("exercise_order", { ascending: true })
      : { data: [], error: null };
  if (exerciseRes.error) throw new Error(exerciseRes.error.message);

  const firstExerciseByLog = new Map<string, string>();
  const volumeByLog = new Map<string, number>();
  (exerciseRes.data ?? []).forEach((row) => {
    const logId = String(row.workout_log_id);
    const existingVolume = volumeByLog.get(logId) ?? 0;
    volumeByLog.set(logId, existingVolume + parseNumeric(row.total_volume_kg, 0));
    if (firstExerciseByLog.has(logId)) return;
    const exerciseName = String(row.exercise_name ?? "").trim();
    if (exerciseName.length > 0) {
      firstExerciseByLog.set(logId, exerciseName);
    }
  });

  const workouts = logs.map((row) => ({
    id: row.id,
    name:
      firstExerciseByLog.get(row.id) ??
      (row.source === "manual" ? "Manual Workout" : "Workout Session"),
    type: row.source ?? "workout",
    duration_minutes: Math.max(0, Math.floor(parseNumeric(row.total_duration_minutes, 0))),
    calories: Math.max(0, Math.floor(parseNumeric(row.calories_burned, 0))),
    performed_at: `${row.workout_date}T00:00:00.000Z`,
    status: row.status,
    completion_percentage: parseNumeric(row.completion_percentage, 0),
    volume_kg: Number((volumeByLog.get(row.id) ?? 0).toFixed(2)),
  }));

  const completedLogs = workouts.filter((row) => row.status === "completed");
  const workoutsCount = completedLogs.length;
  const caloriesBurned = completedLogs.reduce((sum, row) => sum + row.calories, 0);
  const activeMinutes = completedLogs.reduce(
    (sum, row) => sum + row.duration_minutes,
    0,
  );
  const avgHeartRate = heartRes.data?.length
    ? Math.round(
        (heartRes.data ?? []).reduce(
          (sum, row) => sum + parseNumeric((row as { value: number }).value, 0),
          0,
        ) / (heartRes.data?.length ?? 1),
      )
    : null;

  return {
    range,
    workouts,
    goals: goalsRes.data ?? [],
    heartEntries: heartRes.data ?? [],
    bodyWeightEntries: bodyWeightRes.data ?? [],
    trainingStatsSnapshot:
      trainingStatsRes.error || !trainingStatsRes.data ? null : trainingStatsRes.data,
    trainingStatsHistory:
      trainingStatsHistoryRes.error || !trainingStatsHistoryRes.data
        ? []
        : trainingStatsHistoryRes.data,
    exerciseVolumeStats: exerciseVolumeRows.map((row) => ({
      ...row,
      exercise_name: exerciseNameById.get(String(row.exercise_id ?? "")) ?? null,
    })),
    stats: {
      workoutsCount,
      caloriesBurned,
      activeMinutes,
      avgHeartRate,
    },
  };
}

export async function logBodyWeightEntry(
  context: ServiceContext,
  input: { valueKg: number; recordedAt: string },
) {
  const value = Number(input.valueKg);
  if (!Number.isFinite(value) || value <= 0 || value > 500) {
    throw new Error("valueKg must be a valid positive number");
  }
  if (!input.recordedAt || Number.isNaN(new Date(input.recordedAt).getTime())) {
    throw new Error("recordedAt must be a valid ISO datetime");
  }

  const result = await context.client
    .from("progress_entries")
    .insert({
      user_id: context.profileId,
      metric: "body_weight",
      value,
      unit: "kg",
      recorded_at: input.recordedAt,
      meta: { source: "manual" },
    })
    .select("id,metric,value,unit,recorded_at")
    .single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function logManualWorkoutExecution(
  context: ServiceContext,
  input: {
    name: string;
    type?: string;
    durationMinutes?: number | null;
    caloriesBurned?: number | null;
    exerciseName?: string | null;
    sets?: number | null;
    reps?: number | null;
    weightPerSetKg?: number | null;
    performedAt?: string | null;
    notes?: string | null;
  },
) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Workout name is required");
  }

  const now = input.performedAt ? new Date(input.performedAt) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("performedAt must be a valid datetime");
  }
  const nowIso = now.toISOString();
  const workoutDate = nowIso.slice(0, 10);
  const durationMinutes = Math.max(
    0,
    Math.floor(parseNumeric(input.durationMinutes, 0)),
  );
  const caloriesBurned = Math.max(
    0,
    Math.floor(parseNumeric(input.caloriesBurned, 0)),
  );
  const setCount = clampIntValue(parseNumeric(input.sets, 1), 1, 30);
  const reps = clampIntValue(parseNumeric(input.reps, 10), 1, 120);
  const weightPerSet = Math.max(0, parseNumeric(input.weightPerSetKg, 0));
  const totalReps = setCount * reps;
  const totalVolume = Number((setCount * reps * weightPerSet).toFixed(2));

  const logRes = await context.client
    .from("workout_logs")
    .insert({
      user_id: context.profileId,
      workout_date: workoutDate,
      status: "completed",
      started_at: nowIso,
      completed_at: nowIso,
      completion_percentage: 100,
      total_exercises: 1,
      exercises_completed: 1,
      total_duration_minutes: durationMinutes,
      calories_burned: caloriesBurned,
      notes: input.notes ?? null,
      source: "manual",
      updated_at: nowIso,
    })
    .select(
      "id,plan_id,workout_date,status,completion_percentage,total_exercises,exercises_completed,total_duration_minutes,calories_burned,source",
    )
    .single();
  if (logRes.error || !logRes.data) {
    throw new Error(logRes.error?.message ?? "Failed to insert workout log");
  }

  const exerciseName = (input.exerciseName ?? "").trim() || name;
  const exerciseRes = await context.client
    .from("workout_log_exercises")
    .insert({
      workout_log_id: logRes.data.id,
      user_id: context.profileId,
      exercise_name: exerciseName,
      muscle_group: input.type ? String(input.type).toLowerCase() : "general",
      exercise_order: 1,
      planned_sets: setCount,
      planned_reps_min: reps,
      planned_reps_max: reps,
      planned_rest_seconds: 60,
      completed_sets: setCount,
      total_reps: totalReps,
      total_volume_kg: totalVolume,
      best_set_weight_kg: weightPerSet,
      best_set_reps: reps,
      status: "completed",
      completed: true,
      notes: input.notes ?? null,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (exerciseRes.error || !exerciseRes.data) {
    throw new Error(
      exerciseRes.error?.message ?? "Failed to insert workout exercise row",
    );
  }

  const setRows = Array.from({ length: setCount }).map((_, index) => ({
    workout_log_exercise_id: exerciseRes.data.id,
    workout_log_id: logRes.data.id,
    user_id: context.profileId,
    set_number: index + 1,
    target_reps_min: reps,
    target_reps_max: reps,
    actual_reps: reps,
    actual_weight_kg: weightPerSet,
    actual_rpe: null,
    set_status: "completed",
    performed_at: nowIso,
    updated_at: nowIso,
  }));
  const setInsertRes = await context.client.from("workout_log_sets").insert(setRows);
  if (setInsertRes.error) {
    throw new Error(setInsertRes.error.message);
  }

  return logRes.data;
}

function computeDateStreak(dateKeys: string[]) {
  if (dateKeys.length === 0) return 0;
  const unique = Array.from(new Set(dateKeys)).sort();
  let streak = 0;
  const cursor = new Date(`${unique[unique.length - 1]}T00:00:00Z`);
  while (true) {
    const key = toIsoDateOnly(cursor);
    if (!unique.includes(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function tierForScore(totalScore: number) {
  if (totalScore >= 750) return "Diamond";
  if (totalScore >= 550) return "Platinum";
  if (totalScore >= 350) return "Gold";
  if (totalScore >= 200) return "Silver";
  return "Bronze";
}

export async function refreshLeaderboardForUser(context: ServiceContext) {
  const thirtyDate = toIsoDateOnly(daysAgoDate(29));
  const fourteenDate = toIsoDateOnly(daysAgoDate(13));
  const ninetyIso = daysAgoDate(90).toISOString();

  const logsRes = await context.client
    .from("workout_logs")
    .select(
      "id,workout_date,status,total_duration_minutes,calories_burned,completion_percentage",
    )
    .eq("user_id", context.profileId)
    .gte("workout_date", thirtyDate)
    .order("workout_date", { ascending: false });
  if (logsRes.error) throw new Error(logsRes.error.message);
  const logs = (logsRes.data ?? []) as Array<{
    id: string;
    workout_date: string;
    status: string;
    total_duration_minutes: number;
    calories_burned: number;
    completion_percentage: number;
  }>;

  const logIds = logs.map((row) => row.id);
  const volumeRes =
    logIds.length > 0
      ? await context.client
          .from("workout_log_exercises")
          .select("workout_log_id,total_volume_kg")
          .eq("user_id", context.profileId)
          .in("workout_log_id", logIds)
      : { data: [], error: null };
  if (volumeRes.error) throw new Error(volumeRes.error.message);
  const totalVolume = (volumeRes.data ?? []).reduce(
    (sum, row) => sum + parseNumeric(row.total_volume_kg, 0),
    0,
  );

  const [progressRes, prRes] = await Promise.all([
    context.client
      .from("progress_entries")
      .select("metric,value,recorded_at")
      .eq("user_id", context.profileId)
      .gte("recorded_at", daysAgoDate(30).toISOString())
      .order("recorded_at", { ascending: true }),
    context.client
      .from("personal_records")
      .select("estimated_1rm,achieved_at")
      .eq("user_id", context.profileId)
      .gte("achieved_at", ninetyIso)
      .order("achieved_at", { ascending: true }),
  ]);
  if (progressRes.error) throw new Error(progressRes.error.message);
  if (prRes.error) throw new Error(prRes.error.message);

  const completedLogs = logs.filter((row) => row.status === "completed");
  const activityKeys14 = completedLogs
    .map((row) => row.workout_date)
    .filter((dateKey) => dateKey >= fourteenDate);
  const activityDays14 = Array.from(new Set(activityKeys14)).length;
  const streakDays = computeDateStreak(activityKeys14);
  const totalDuration = completedLogs.reduce(
    (sum, row) => sum + parseNumeric(row.total_duration_minutes, 0),
    0,
  );
  const totalCalories = completedLogs.reduce(
    (sum, row) => sum + parseNumeric(row.calories_burned, 0),
    0,
  );
  const avgCompletion =
    logs.length > 0
      ? logs.reduce(
          (sum, row) => sum + parseNumeric(row.completion_percentage, 0),
          0,
        ) / logs.length
      : 0;

  const prRows = (prRes.data ?? []) as Array<{ estimated_1rm: number; achieved_at: string }>;
  const prMax = prRows.length
    ? Math.max(...prRows.map((row) => parseNumeric(row.estimated_1rm, 0)))
    : 0;
  const midpoint = daysAgoDate(45).toISOString();
  const prBaseline = prRows
    .filter((row) => row.achieved_at < midpoint)
    .map((row) => parseNumeric(row.estimated_1rm, 0));
  const prRecent = prRows
    .filter((row) => row.achieved_at >= midpoint)
    .map((row) => parseNumeric(row.estimated_1rm, 0));
  const prImprovement =
    prRecent.length > 0
      ? Math.max(...prRecent) - (prBaseline.length > 0 ? Math.max(...prBaseline) : 0)
      : 0;

  const weightRows = ((progressRes.data ?? []) as Array<{
    metric: string;
    value: number;
  }>).filter((row) => row.metric === "body_weight");
  const weightImprovement =
    weightRows.length >= 2
      ? parseNumeric(weightRows[0].value, 0) -
        parseNumeric(weightRows[weightRows.length - 1].value, 0)
      : 0;

  const strengthScore = Math.round(Math.min(1000, totalVolume * 0.08 + prMax * 2));
  const staminaScore = Math.round(
    Math.min(1000, totalDuration * 1.4 + totalCalories * 0.15),
  );
  const consistencyScore = Math.round(
    Math.min(1000, activityDays14 * 45 + streakDays * 20 + avgCompletion * 2),
  );
  const improvementScore = Math.round(
    Math.min(1000, Math.max(0, prImprovement) * 8 + Math.max(0, weightImprovement) * 40),
  );
  const totalScore = Math.round(
    strengthScore * 0.35 +
      staminaScore * 0.25 +
      consistencyScore * 0.25 +
      improvementScore * 0.15,
  );

  const upsertRes = await context.client
    .from("leaderboard")
    .upsert(
      {
        user_id: context.profileId,
        total_score: totalScore,
        strength_score: strengthScore,
        stamina_score: staminaScore,
        consistency_score: consistencyScore,
        improvement_score: improvementScore,
        activity_days_14d: activityDays14,
        streak_days: streakDays,
        tier: tierForScore(totalScore),
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(
      "id,user_id,total_score,strength_score,stamina_score,consistency_score,improvement_score,tier,position,activity_days_14d,streak_days,updated_at",
    )
    .single();
  if (upsertRes.error) throw new Error(upsertRes.error.message);
  return upsertRes.data;
}

export async function getRankingOverview(context: ServiceContext) {
  const leaderboardRes = await context.client
    .from("leaderboard")
    .select(
      "id,user_id,total_score,strength_score,stamina_score,consistency_score,improvement_score,tier,position,activity_days_14d,streak_days,updated_at,profiles(name,avatar_url)",
    )
    .order("total_score", { ascending: false })
    .limit(100);
  if (leaderboardRes.error) throw new Error(leaderboardRes.error.message);

  const normalized: Array<Record<string, unknown>> = (
    (leaderboardRes.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const profileRaw = row.profiles;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return {
      ...row,
      profiles: profile ?? null,
    };
  });

  const myEntry =
    (normalized.find((row) => String(row.user_id) === context.profileId) as
      | Record<string, unknown>
      | undefined) ?? null;

  return {
    profileId: context.profileId,
    leaderboard: normalized,
    myEntry,
    activityDays: Number(myEntry?.activity_days_14d ?? 0),
    streakDays: Number(myEntry?.streak_days ?? 0),
  };
}
