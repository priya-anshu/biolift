import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";
import { logger } from "@/lib/server/logger";
import { getRecoveryState } from "@/lib/workout-planner/recoveryEngine";
import { getTrainingLoadState } from "@/lib/workout-planner/trainingLoadEngine";
import { getMuscleFatigueState } from "@/lib/workout-planner/muscleFatigueEngine";

type BrainContext = {
  client: SupabaseClient;
  profileId: string;
};

type SessionAggregate = {
  workoutDate: string;
  avgReps: number | null;
  completedSets: number;
  failedSets: number;
  volumeKg: number;
  bestWeightKg: number | null;
  bestReps: number | null;
};

type AdaptationStateRow = {
  exercise_id: string;
  last_weight: number | null;
  last_reps: number | null;
  estimated_1rm: number | null;
  fatigue_modifier: number | null;
  progression_modifier: number | null;
  last_trained_at: string | null;
};

type PlanExerciseContextRow = {
  id: string;
  exercise_id: string | null;
  muscle_group: string | null;
  difficulty_level: string | null;
  equipment_required: string[];
};

type ExerciseCatalogRow = {
  id: string;
  name: string;
  target_muscle: string | null;
  difficulty_level: string | null;
  equipment_required: string[];
};

type RecommendationContext = {
  sessions: SessionAggregate[];
  setRows: Array<{
    set_status: string;
    actual_reps: number | null;
    actual_weight_kg: number | null;
    performed_at: string | null;
  }>;
  state: AdaptationStateRow | null;
  injuryLevel: "none" | "moderate" | "high";
};

type UpdateAdaptationInput = {
  workoutDate?: string;
  workoutLogId?: string;
};

const ADAPTATION_TABLE_MISSING_CODES = new Set(["42P01", "42703"]);

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function parseDateOnly(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function daysAgo(referenceDate: string, days: number) {
  const d = parseDateOnly(referenceDate);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function estimated1rm(weightKg: number, reps: number) {
  return weightKg * (1 + Math.min(reps, 10) / 30);
}

function chunk<T>(items: T[], size: number) {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : String(item ?? "")))
    .map((item) => item.trim())
    .filter(Boolean);
}

function difficultyRank(level: string | null | undefined) {
  const normalized = normalizeToken(level);
  if (normalized === "beginner") return 1;
  if (normalized === "intermediate") return 2;
  return 3;
}

function volumeRangeByExperience(experienceLevel: string | null | undefined) {
  const normalized = normalizeToken(experienceLevel);
  if (normalized === "beginner") {
    return { min: 8, max: 12 };
  }
  if (normalized === "advanced") {
    return { min: 16, max: 22 };
  }
  return { min: 12, max: 18 };
}

async function loadAdaptationStateRows(
  context: BrainContext,
  exerciseIds: string[],
) {
  if (exerciseIds.length === 0) return [];
  const result = await context.client
    .from("exercise_adaptation_state")
    .select(
      "exercise_id,last_weight,last_reps,estimated_1rm,fatigue_modifier,progression_modifier,last_trained_at",
    )
    .eq("user_id", context.profileId)
    .in("exercise_id", exerciseIds);
  if (result.error) {
    if (ADAPTATION_TABLE_MISSING_CODES.has(result.error.code ?? "")) {
      return [];
    }
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as AdaptationStateRow[];
}

async function loadRecentExerciseContext(
  context: BrainContext,
  input: { exerciseIds: string[]; workoutDate: string },
) {
  const sinceDate = daysAgo(input.workoutDate, 56);

  const exerciseRowsRes = await context.client
    .from("workout_log_exercises")
    .select("id,exercise_id,workout_log_id")
    .eq("user_id", context.profileId)
    .in("exercise_id", input.exerciseIds)
    .gte("created_at", `${sinceDate}T00:00:00.000Z`)
    .order("created_at", { ascending: false })
    .limit(4000);
  if (exerciseRowsRes.error) throw new Error(exerciseRowsRes.error.message);
  const exerciseRows = (exerciseRowsRes.data ?? []) as Array<{
    id: string;
    exercise_id: string;
    workout_log_id: string;
  }>;
  if (exerciseRows.length === 0) {
    return {
      sessionsByExerciseId: new Map<string, SessionAggregate[]>(),
      setRowsByExerciseId: new Map<
        string,
        Array<{
          set_status: string;
          actual_reps: number | null;
          actual_weight_kg: number | null;
          performed_at: string | null;
        }>
      >(),
    };
  }

  const logIds = Array.from(new Set(exerciseRows.map((row) => String(row.workout_log_id))));
  const logResults = await Promise.all(
    chunk(logIds, 250).map((ids) =>
      context.client
        .from("workout_logs")
        .select("id,workout_date,status")
        .in("id", ids),
    ),
  );
  const logMap = new Map<string, { workout_date: string; status: string }>();
  logResults.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    (res.data ?? []).forEach((row) => {
      logMap.set(String(row.id), {
        workout_date: String(row.workout_date),
        status: String(row.status ?? "planned"),
      });
    });
  });

  const exerciseRowIds = exerciseRows.map((row) => String(row.id));
  const setResults = await Promise.all(
    chunk(exerciseRowIds, 250).map((ids) =>
      context.client
        .from("workout_log_sets")
        .select(
          "workout_log_exercise_id,actual_reps,actual_weight_kg,set_status,performed_at",
        )
        .eq("user_id", context.profileId)
        .in("workout_log_exercise_id", ids)
        .order("performed_at", { ascending: false }),
    ),
  );
  const setRowsByExerciseRow = new Map<
    string,
    Array<{
      set_status: string;
      actual_reps: number | null;
      actual_weight_kg: number | null;
      performed_at: string | null;
    }>
  >();
  setResults.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    (res.data ?? []).forEach((row) => {
      const key = String(row.workout_log_exercise_id);
      const current = setRowsByExerciseRow.get(key) ?? [];
      current.push({
        set_status: String(row.set_status ?? "completed"),
        actual_reps: toNullableNumber(row.actual_reps),
        actual_weight_kg: toNullableNumber(row.actual_weight_kg),
        performed_at: row.performed_at ? String(row.performed_at) : null,
      });
      setRowsByExerciseRow.set(key, current);
    });
  });

  const sessionsByExerciseId = new Map<string, SessionAggregate[]>();
  const setRowsByExerciseId = new Map<
    string,
    Array<{
      set_status: string;
      actual_reps: number | null;
      actual_weight_kg: number | null;
      performed_at: string | null;
    }>
  >();

  exerciseRows.forEach((row) => {
    const log = logMap.get(String(row.workout_log_id));
    if (!log || log.status !== "completed") return;
    const exerciseId = String(row.exercise_id);
    const sets = setRowsByExerciseRow.get(String(row.id)) ?? [];
    const completedSets = sets.filter(
      (setRow) =>
        setRow.set_status === "completed" &&
        (setRow.actual_reps ?? 0) > 0 &&
        (setRow.actual_weight_kg ?? 0) >= 0,
    );
    const failedSets = sets.filter((setRow) => setRow.set_status === "failed");
    const repsValues = completedSets
      .map((setRow) => setRow.actual_reps)
      .filter((value): value is number => value !== null);
    const avgReps =
      repsValues.length > 0
        ? repsValues.reduce((sum, value) => sum + value, 0) / repsValues.length
        : null;
    const volumeKg = completedSets.reduce(
      (sum, setRow) => sum + (setRow.actual_reps ?? 0) * (setRow.actual_weight_kg ?? 0),
      0,
    );
    const bestWeight =
      completedSets.length > 0
        ? Math.max(...completedSets.map((setRow) => setRow.actual_weight_kg ?? 0))
        : null;
    const bestReps =
      completedSets.length > 0
        ? Math.max(...completedSets.map((setRow) => setRow.actual_reps ?? 0))
        : null;

    const sessionList = sessionsByExerciseId.get(exerciseId) ?? [];
    const existingIndex = sessionList.findIndex(
      (session) => session.workoutDate === log.workout_date,
    );
    const session: SessionAggregate = {
      workoutDate: log.workout_date,
      avgReps: avgReps !== null ? round(avgReps, 2) : null,
      completedSets: completedSets.length,
      failedSets: failedSets.length,
      volumeKg: round(volumeKg, 2),
      bestWeightKg: bestWeight !== null ? round(bestWeight, 2) : null,
      bestReps,
    };
    if (existingIndex >= 0) {
      const current = sessionList[existingIndex];
      sessionList[existingIndex] = {
        workoutDate: current.workoutDate,
        avgReps:
          current.avgReps !== null && session.avgReps !== null
            ? round((current.avgReps + session.avgReps) / 2, 2)
            : current.avgReps ?? session.avgReps,
        completedSets: current.completedSets + session.completedSets,
        failedSets: current.failedSets + session.failedSets,
        volumeKg: round(current.volumeKg + session.volumeKg, 2),
        bestWeightKg:
          current.bestWeightKg !== null || session.bestWeightKg !== null
            ? round(
                Math.max(current.bestWeightKg ?? 0, session.bestWeightKg ?? 0),
                2,
              )
            : null,
        bestReps:
          current.bestReps !== null || session.bestReps !== null
            ? Math.max(current.bestReps ?? 0, session.bestReps ?? 0)
            : null,
      };
    } else {
      sessionList.push(session);
    }
    sessionsByExerciseId.set(exerciseId, sessionList);

    const currentSetRows = setRowsByExerciseId.get(exerciseId) ?? [];
    currentSetRows.push(...sets);
    setRowsByExerciseId.set(exerciseId, currentSetRows);
  });

  sessionsByExerciseId.forEach((sessions, exerciseId) => {
    sessionsByExerciseId.set(
      exerciseId,
      [...sessions].sort((a, b) => b.workoutDate.localeCompare(a.workoutDate)),
    );
  });

  return {
    sessionsByExerciseId,
    setRowsByExerciseId,
  };
}

async function loadFatigueSignal(context: BrainContext, workoutDate: string) {
  const recoveryState = await getRecoveryState({
    client: context.client,
    profileId: context.profileId,
  });
  if (recoveryState) {
    const fatigueAvg = toNullableNumber(recoveryState.fatigue_score);
    const readinessAvg = toNullableNumber(recoveryState.readiness_score);
    return {
      highFatigue:
        (fatigueAvg !== null && fatigueAvg >= 70) ||
        (readinessAvg !== null && readinessAvg <= 35),
      fatigueAvg,
      readinessAvg,
    };
  }

  const recoveryRes = await context.client
    .from("recovery_metrics")
    .select("fatigue_score,readiness_score,metric_date")
    .eq("user_id", context.profileId)
    .lte("metric_date", workoutDate)
    .order("metric_date", { ascending: false })
    .limit(3);
  if (recoveryRes.error) throw new Error(recoveryRes.error.message);
  const rows = (recoveryRes.data ?? []) as Array<{
    fatigue_score: number | null;
    readiness_score: number | null;
  }>;
  const fatigueValues = rows
    .map((row) => toNullableNumber(row.fatigue_score))
    .filter((value): value is number => value !== null);
  const readinessValues = rows
    .map((row) => toNullableNumber(row.readiness_score))
    .filter((value): value is number => value !== null);
  const fatigueAvg =
    fatigueValues.length > 0
      ? fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length
      : null;
  const readinessAvg =
    readinessValues.length > 0
      ? readinessValues.reduce((sum, value) => sum + value, 0) / readinessValues.length
      : null;
  const highFatigue =
    (fatigueAvg !== null && fatigueAvg >= 70) ||
    (readinessAvg !== null && readinessAvg <= 40);
  return {
    highFatigue,
    fatigueAvg,
    readinessAvg,
  };
}

async function loadInjuryLevels(context: BrainContext, exerciseIds: string[]) {
  if (exerciseIds.length === 0) return new Map<string, "none" | "moderate" | "high">();
  const injuryRes = await context.client
    .from("injury_flags")
    .select("exercise_id,severity,pain_level,status")
    .eq("user_id", context.profileId)
    .in("status", ["active", "monitoring", "recovering"])
    .in("exercise_id", exerciseIds);
  if (injuryRes.error) throw new Error(injuryRes.error.message);

  const map = new Map<string, "none" | "moderate" | "high">();
  (injuryRes.data ?? []).forEach((row) => {
    if (!row.exercise_id) return;
    const exerciseId = String(row.exercise_id);
    const severity = toNumber(row.severity, 1);
    const painLevel = toNumber(row.pain_level, 0);
    const level: "none" | "moderate" | "high" =
      severity >= 4 || painLevel >= 8
        ? "high"
        : severity >= 3 || painLevel >= 6
          ? "moderate"
          : "none";
    const current = map.get(exerciseId) ?? "none";
    if (
      (level === "high" && current !== "high") ||
      (level === "moderate" && current === "none")
    ) {
      map.set(exerciseId, level);
    } else if (!map.has(exerciseId)) {
      map.set(exerciseId, level);
    }
  });
  return map;
}

async function loadActiveInjuryExerciseIds(context: BrainContext) {
  const injuryRes = await context.client
    .from("injury_flags")
    .select("exercise_id,status")
    .eq("user_id", context.profileId)
    .in("status", ["active", "monitoring", "recovering"])
    .not("exercise_id", "is", null);
  if (injuryRes.error) throw new Error(injuryRes.error.message);

  return new Set(
    (injuryRes.data ?? [])
      .map((row) => (row.exercise_id ? String(row.exercise_id) : ""))
      .filter(Boolean),
  );
}

async function loadPlanExerciseContextRows(
  context: BrainContext,
  planExerciseIds: string[],
) {
  if (planExerciseIds.length === 0) {
    return [] as PlanExerciseContextRow[];
  }
  const res = await context.client
    .from("workout_plan_exercises")
    .select("id,exercise_id,muscle_group,difficulty_level,equipment_required")
    .in("id", planExerciseIds);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    id: String(row.id),
    exercise_id: row.exercise_id ? String(row.exercise_id) : null,
    muscle_group: row.muscle_group ? String(row.muscle_group) : null,
    difficulty_level: row.difficulty_level ? String(row.difficulty_level) : null,
    equipment_required: toStringArray(row.equipment_required),
  })) as PlanExerciseContextRow[];
}

async function loadPlanExperienceLevel(context: BrainContext, planId: string) {
  const res = await context.client
    .from("workout_plans")
    .select("experience_level")
    .eq("id", planId)
    .eq("user_id", context.profileId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data?.experience_level ? String(res.data.experience_level) : "intermediate";
}

async function loadExerciseCatalogRows(
  context: BrainContext,
  input: { targetMuscles: string[]; includeExerciseIds: string[] },
) {
  const normalizedMuscles = Array.from(
    new Set(input.targetMuscles.map((muscle) => normalizeToken(muscle)).filter(Boolean)),
  );
  const normalizedExerciseIds = Array.from(
    new Set(input.includeExerciseIds.filter(Boolean)),
  );

  const [muscleRes, idRes] = await Promise.all([
    normalizedMuscles.length > 0
      ? context.client
          .from("exercises")
          .select("id,name,target_muscle,difficulty_level,equipment_required")
          .in("target_muscle", normalizedMuscles)
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    normalizedExerciseIds.length > 0
      ? context.client
          .from("exercises")
          .select("id,name,target_muscle,difficulty_level,equipment_required")
          .in("id", normalizedExerciseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (muscleRes.error) throw new Error(muscleRes.error.message);
  if (idRes.error) throw new Error(idRes.error.message);

  const combined = [...(muscleRes.data ?? []), ...(idRes.data ?? [])];
  const unique = new Map<string, ExerciseCatalogRow>();
  combined.forEach((row) => {
    const id = String(row.id);
    unique.set(id, {
      id,
      name: String(row.name ?? ""),
      target_muscle: row.target_muscle ? String(row.target_muscle) : null,
      difficulty_level: row.difficulty_level ? String(row.difficulty_level) : null,
      equipment_required: toStringArray(row.equipment_required),
    });
  });
  return Array.from(unique.values());
}

function buildWeeklySetsByMuscle(input: {
  workoutDate: string;
  recommendations: TrainingIntelligenceResult["recommendations"];
  sessionsByExerciseId: Map<string, SessionAggregate[]>;
  planExerciseMap: Map<string, PlanExerciseContextRow>;
  exerciseCatalogMap: Map<string, ExerciseCatalogRow>;
}) {
  const sinceDate = daysAgo(input.workoutDate, 7);
  const byMuscle = new Map<string, number>();

  input.recommendations.forEach((recommendation) => {
    const exerciseId = recommendation.exercise_id;
    if (!exerciseId) return;
    const planExercise = input.planExerciseMap.get(recommendation.plan_exercise_id) ?? null;
    const catalogExercise = input.exerciseCatalogMap.get(exerciseId) ?? null;
    const muscleGroup =
      normalizeToken(planExercise?.muscle_group) ||
      normalizeToken(catalogExercise?.target_muscle);
    if (!muscleGroup) return;

    const weeklySets = (input.sessionsByExerciseId.get(exerciseId) ?? [])
      .filter((session) => session.workoutDate >= sinceDate)
      .reduce((sum, session) => sum + session.completedSets, 0);
    const current = byMuscle.get(muscleGroup) ?? 0;
    byMuscle.set(muscleGroup, current + weeklySets);
  });

  return byMuscle;
}

function selectRotationCandidate(input: {
  recommendation: TrainingIntelligenceResult["recommendations"][number];
  planExercise: PlanExerciseContextRow | null;
  currentExercise: ExerciseCatalogRow | null;
  exerciseCatalog: ExerciseCatalogRow[];
  injuredExerciseIds: Set<string>;
  recentlyUsedExerciseIds: Set<string>;
}) {
  const targetMuscle =
    normalizeToken(input.planExercise?.muscle_group) ||
    normalizeToken(input.currentExercise?.target_muscle);
  if (!targetMuscle) return null;

  const targetDifficulty = difficultyRank(
    input.planExercise?.difficulty_level ?? input.currentExercise?.difficulty_level,
  );
  const targetEquipment = new Set(
    (input.planExercise?.equipment_required ?? input.currentExercise?.equipment_required ?? []).map(
      (equipment) => normalizeToken(equipment),
    ),
  );
  const currentExerciseId = input.recommendation.exercise_id;

  const candidates = input.exerciseCatalog
    .filter((exercise) => normalizeToken(exercise.target_muscle) === targetMuscle)
    .filter((exercise) => exercise.id !== currentExerciseId)
    .filter((exercise) => !input.injuredExerciseIds.has(exercise.id))
    .map((exercise) => {
      const difficultyGap = Math.abs(difficultyRank(exercise.difficulty_level) - targetDifficulty);
      const equipmentOverlap = exercise.equipment_required
        .map((equipment) => normalizeToken(equipment))
        .filter((equipment) => targetEquipment.has(equipment)).length;
      const recentPenalty = input.recentlyUsedExerciseIds.has(exercise.id) ? 1 : 0;
      const score = equipmentOverlap * 3 - difficultyGap * 2 - recentPenalty * 4;
      return { exercise, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.exercise ?? null;
}

function computeFailureRate(
  setRows: RecommendationContext["setRows"],
  workoutDate: string,
) {
  const cutoffDate = `${daysAgo(workoutDate, 14)}T00:00:00.000Z`;
  const relevant = setRows.filter(
    (setRow) =>
      setRow.performed_at !== null &&
      setRow.performed_at >= cutoffDate &&
      (setRow.set_status === "completed" || setRow.set_status === "failed"),
  );
  if (relevant.length === 0) return 0;
  const failed = relevant.filter((setRow) => setRow.set_status === "failed").length;
  return failed / relevant.length;
}

function computeAcwr(
  setRows: RecommendationContext["setRows"],
  workoutDate: string,
) {
  const ref = parseDateOnly(workoutDate);
  const acuteFrom = new Date(ref);
  acuteFrom.setUTCDate(acuteFrom.getUTCDate() - 7);
  const chronicFrom = new Date(ref);
  chronicFrom.setUTCDate(chronicFrom.getUTCDate() - 28);

  const volumeInWindow = (from: Date, to: Date) =>
    setRows.reduce((sum, setRow) => {
      if (setRow.set_status !== "completed") return sum;
      if (!setRow.performed_at) return sum;
      const ts = new Date(setRow.performed_at);
      if (Number.isNaN(ts.getTime()) || ts < from || ts >= to) return sum;
      return sum + (setRow.actual_reps ?? 0) * (setRow.actual_weight_kg ?? 0);
    }, 0);

  const acute = volumeInWindow(acuteFrom, ref);
  const chronicAvg = volumeInWindow(chronicFrom, ref) / 4;
  if (acute <= 0 && chronicAvg <= 0) return 1;
  if (chronicAvg <= 0) return 2;
  return acute / chronicAvg;
}

function dedupeReasons(reasons: string[]) {
  return Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));
}

export async function applyTrainingBrain(
  context: BrainContext,
  input: {
    workoutDate: string;
    result: TrainingIntelligenceResult;
  },
): Promise<TrainingIntelligenceResult> {
  const exerciseIds = Array.from(
    new Set(
      input.result.recommendations
        .map((row) => row.exercise_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (exerciseIds.length === 0) {
    return input.result;
  }
  const planExerciseIds = Array.from(
    new Set(
      input.result.recommendations
        .map((row) => row.plan_exercise_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  try {
    const [
      stateRows,
      historyContext,
      fatigueSignal,
      injuries,
      activeInjuryExerciseIds,
      trainingLoadState,
      muscleFatigueRows,
      planExerciseRows,
      experienceLevel,
    ] = await Promise.all([
      loadAdaptationStateRows(context, exerciseIds),
      loadRecentExerciseContext(context, {
        exerciseIds,
        workoutDate: input.workoutDate,
      }),
      loadFatigueSignal(context, input.workoutDate),
      loadInjuryLevels(context, exerciseIds),
      loadActiveInjuryExerciseIds(context),
      getTrainingLoadState(context),
      getMuscleFatigueState(context),
      loadPlanExerciseContextRows(context, planExerciseIds),
      loadPlanExperienceLevel(context, input.result.plan_id),
    ]);

    const targetMuscles = planExerciseRows
      .map((row) => row.muscle_group)
      .filter((value): value is string => Boolean(value));
    const exerciseCatalogRows = await loadExerciseCatalogRows(context, {
      targetMuscles,
      includeExerciseIds: exerciseIds,
    });

    const stateMap = new Map(stateRows.map((row) => [row.exercise_id, row]));
    const planExerciseMap = new Map(planExerciseRows.map((row) => [row.id, row]));
    const exerciseCatalogMap = new Map(exerciseCatalogRows.map((row) => [row.id, row]));
    const muscleFatigueMap = new Map(
      (muscleFatigueRows ?? []).map((row) => [
        normalizeToken(row.muscle_group),
        row,
      ]),
    );
    const weeklySetsByMuscle = buildWeeklySetsByMuscle({
      workoutDate: input.workoutDate,
      recommendations: input.result.recommendations,
      sessionsByExerciseId: historyContext.sessionsByExerciseId,
      planExerciseMap,
      exerciseCatalogMap,
    });
    const recentlyUsedExerciseIds = new Set(
      Array.from(historyContext.sessionsByExerciseId.entries())
        .filter(([, sessions]) => sessions.length > 0)
        .map(([exerciseId]) => exerciseId),
    );

    const readinessScore = fatigueSignal.readinessAvg;
    const readinessBelow40 = readinessScore !== null && readinessScore < 40;
    const readinessBelow30 = readinessScore !== null && readinessScore < 30;
    const overtrainingRisk = toNullableNumber(trainingLoadState?.overtraining_risk);
    const plateauRisk = toNullableNumber(trainingLoadState?.plateau_risk);
    const loadAcwr = toNullableNumber(trainingLoadState?.acwr);
    const overtrainingHigh = (overtrainingRisk ?? 0) >= 70;
    const plateauHigh = (plateauRisk ?? 0) >= 70;
    const highFatigueMuscleCount = (muscleFatigueRows ?? []).filter(
      (row) => toNumber(row.fatigue_score, 0) >= 70,
    ).length;
    const highFatigueAcrossMuscles = highFatigueMuscleCount >= 2;
    const trainingLoadUpdatedAtMs =
      trainingLoadState?.updated_at && !Number.isNaN(new Date(trainingLoadState.updated_at).getTime())
        ? new Date(trainingLoadState.updated_at).getTime()
        : null;
    const deloadTriggeredNow =
      (loadAcwr ?? 0) > 1.5 &&
      (readinessScore ?? 100) < 35 &&
      highFatigueAcrossMuscles;
    const deloadCarryWindowActive =
      !deloadTriggeredNow &&
      trainingLoadUpdatedAtMs !== null &&
      Date.now() - trainingLoadUpdatedAtMs <= 7 * 24 * 60 * 60 * 1000 &&
      (loadAcwr ?? 1) >= 1.3 &&
      (readinessScore ?? 100) < 45 &&
      highFatigueAcrossMuscles;
    const autoDeloadActive = deloadTriggeredNow || deloadCarryWindowActive;
    const volumeRange = volumeRangeByExperience(experienceLevel);

    const recommendations = input.result.recommendations.map((recommendation) => {
      const exerciseId = recommendation.exercise_id;
      if (!exerciseId) return recommendation;

      const sessions = historyContext.sessionsByExerciseId.get(exerciseId) ?? [];
      const setRows = historyContext.setRowsByExerciseId.get(exerciseId) ?? [];
      const state = stateMap.get(exerciseId) ?? null;
      const injuryLevel = injuries.get(exerciseId) ?? "none";

      const ctx: RecommendationContext = {
        sessions,
        setRows,
        state,
        injuryLevel,
      };
      const planExercise = planExerciseMap.get(recommendation.plan_exercise_id) ?? null;
      const catalogExercise = exerciseCatalogMap.get(exerciseId) ?? null;
      const muscleGroup =
        normalizeToken(planExercise?.muscle_group) ||
        normalizeToken(catalogExercise?.target_muscle);
      const muscleFatigue = muscleGroup
        ? muscleFatigueMap.get(muscleGroup) ?? null
        : null;
      const muscleFatigueScore = muscleFatigue
        ? toNumber(muscleFatigue.fatigue_score, 0)
        : null;
      const highMuscleFatigue =
        muscleFatigueScore !== null && muscleFatigueScore >= 70;
      const veryHighMuscleFatigue =
        muscleFatigueScore !== null && muscleFatigueScore >= 85;

      const lastTwo = ctx.sessions.slice(0, 2);
      const exceededLastTwo =
        lastTwo.length >= 2 &&
        lastTwo.every(
          (session) =>
            session.avgReps !== null &&
            session.avgReps >= recommendation.recommended_reps.max + 1,
        );

      const failureRate = computeFailureRate(ctx.setRows, input.workoutDate);
      const acwr = computeAcwr(ctx.setRows, input.workoutDate);

      let action: "increase" | "maintain" | "reduce" | "deload" = "maintain";
      const reasons = [...recommendation.recommendation_reason];

      if (acwr > 1.5) {
        action = "deload";
        reasons.push(`ACWR ${round(acwr, 2)} above 1.5, trigger deload`);
      } else if (ctx.injuryLevel === "high") {
        action = "deload";
        reasons.push("High injury risk detected, deload applied");
      } else if (ctx.injuryLevel === "moderate" || failureRate >= 0.3) {
        action = "reduce";
        if (failureRate >= 0.3) {
          reasons.push(
            `Failure rate ${Math.round(failureRate * 100)}% over last 14 days`,
          );
        } else {
          reasons.push("Moderate injury risk detected, reduce progression");
        }
      } else if (highMuscleFatigue && failureRate >= 0.2) {
        action = "reduce";
        reasons.push(
          `Muscle fatigue ${round(muscleFatigueScore ?? 0, 1)} and elevated failure rate`,
        );
      } else if (exceededLastTwo) {
        action = "increase";
        reasons.push("Last 2 sessions exceeded rep range");
      }

      if (readinessBelow40 && action === "increase") {
        action = "maintain";
        reasons.push(`Readiness ${round(readinessScore ?? 0, 1)} below 40, hold progression`);
      }
      if (readinessBelow30 && recommendation.progression_action !== "substitute") {
        action = "deload";
        reasons.push(`Readiness ${round(readinessScore ?? 0, 1)} below 30, force recovery workout`);
      }
      if (overtrainingHigh) {
        action = loadAcwr !== null && loadAcwr > 1.6 ? "deload" : "reduce";
        reasons.push(
          `Overtraining risk ${round(overtrainingRisk ?? 0, 1)} detected, downregulate loading`,
        );
        if (loadAcwr !== null) {
          reasons.push(`ACWR ${round(loadAcwr, 2)} indicates high load stress`);
        }
      } else if (plateauHigh && !readinessBelow40 && action === "maintain") {
        action = "increase";
        reasons.push(
          `Plateau risk ${round(plateauRisk ?? 0, 1)} detected, increase overload stimulus`,
        );
      }

      const repeatedExerciseSessions = ctx.sessions.length > 6;
      let substitutionId = recommendation.exercise_substitution;
      let effectiveExerciseId = recommendation.exercise_id;
      const rotationRequired =
        plateauHigh && highMuscleFatigue && repeatedExerciseSessions;
      const substitutionRequested =
        recommendation.progression_action === "substitute" ||
        rotationRequired ||
        (overtrainingHigh && recommendation.recommended_reps.max <= 6) ||
        veryHighMuscleFatigue;
      if (substitutionRequested) {
        const rotationCandidate = selectRotationCandidate({
          recommendation,
          planExercise,
          currentExercise: catalogExercise,
          exerciseCatalog: exerciseCatalogRows,
          injuredExerciseIds: activeInjuryExerciseIds,
          recentlyUsedExerciseIds,
        });
        if (rotationCandidate && rotationCandidate.id !== recommendation.exercise_id) {
          substitutionId = rotationCandidate.id;
          effectiveExerciseId = rotationCandidate.id;
          reasons.push(
            `Exercise rotation applied: ${catalogExercise?.name ?? "Current exercise"} -> ${rotationCandidate.name}`,
          );
        }
      }

      const progressionModifier = clamp(
        toNumber(ctx.state?.progression_modifier, 1),
        0.7,
        1.3,
      );
      const fatigueModifier = clamp(
        toNumber(ctx.state?.fatigue_modifier, 1),
        0.7,
        1.2,
      );

      const baseWeight =
        recommendation.recommended_weight ??
        toNullableNumber(ctx.state?.last_weight) ??
        null;

      let nextWeight = baseWeight;
      if (nextWeight !== null) {
        if (action === "increase") {
          nextWeight *= 1.025;
        } else if (action === "reduce") {
          nextWeight *= 0.95;
        } else if (action === "deload") {
          nextWeight *= 0.9;
        }
        nextWeight = round(nextWeight * progressionModifier * fatigueModifier, 2);
      }

      let nextSets = recommendation.recommended_sets;
      if (fatigueSignal.highFatigue && !readinessBelow40) {
        nextSets = Math.max(1, nextSets - 1);
        reasons.push("High fatigue detected, reduce sets by 1");
      }
      if (readinessBelow40) {
        nextSets = Math.max(1, nextSets - 1);
        reasons.push(`Readiness ${round(readinessScore ?? 0, 1)} below 40, reduce sets by 1`);
      }
      let nextReps = recommendation.recommended_reps;
      let nextRestSeconds = recommendation.rest_seconds;
      if (readinessBelow30) {
        nextSets = Math.min(nextSets, 2);
        const repMin = Math.max(
          5,
          Math.min(recommendation.recommended_reps.min, 8),
        );
        const repMax = Math.max(
          repMin,
          Math.min(recommendation.recommended_reps.max, 12),
        );
        nextReps = { min: repMin, max: repMax };
        nextRestSeconds = Math.min(300, nextRestSeconds + 30);
        if (nextWeight !== null) {
          nextWeight = round(nextWeight * 0.85, 2);
        }
      }
      if (action === "deload") {
        nextSets = Math.max(1, nextSets - 1);
      }

      if (overtrainingHigh) {
        nextSets = Math.max(1, nextSets - 1);
        nextRestSeconds = Math.min(360, nextRestSeconds + 30);
        if (nextWeight !== null) {
          nextWeight = round(nextWeight * 0.95, 2);
        }
        if (recommendation.recommended_reps.max <= 6) {
          reasons.push("Avoid heavy compound loading during elevated overtraining risk");
        }
      }

      if (plateauHigh && !overtrainingHigh && !readinessBelow40) {
        nextSets = Math.min(10, nextSets + 1);
        nextRestSeconds = Math.max(45, nextRestSeconds - 15);
        if (nextWeight !== null) {
          nextWeight = round(nextWeight * 1.025, 2);
        } else {
          const repMin = Math.max(3, nextReps.min - 1);
          const repMax = Math.max(repMin, nextReps.max - 1);
          nextReps = { min: repMin, max: repMax };
        }
        reasons.push("Plateau mitigation: increased volume/intensity stimulus");
      }

      if (muscleGroup) {
        const currentWeeklySets = weeklySetsByMuscle.get(muscleGroup) ?? 0;
        if (
          (action === "increase" || plateauHigh) &&
          currentWeeklySets < volumeRange.min &&
          !readinessBelow40
        ) {
          nextSets = Math.min(12, nextSets + 1);
          reasons.push(
            `Adaptive volume scaling: ${muscleGroup} weekly sets below ${volumeRange.min}`,
          );
        } else if (
          currentWeeklySets > volumeRange.max ||
          (readinessBelow40 && action !== "increase")
        ) {
          nextSets = Math.max(1, nextSets - 1);
          reasons.push(
            `Adaptive volume scaling: ${muscleGroup} weekly sets above recovery capacity`,
          );
        }
      }

      if (highMuscleFatigue) {
        nextSets = Math.max(1, nextSets - 1);
        nextRestSeconds = Math.min(360, nextRestSeconds + 30);
        reasons.push(
          `Muscle fatigue ${round(muscleFatigueScore ?? 0, 1)} is high, reducing local load`,
        );
      }
      if (veryHighMuscleFatigue && nextWeight !== null) {
        nextWeight = round(nextWeight * 0.9, 2);
        reasons.push("Very high local muscle fatigue, intensity reduced by 10%");
      }

      if (autoDeloadActive) {
        action = "deload";
        nextSets = Math.max(1, Math.floor(nextSets * 0.65));
        if (nextWeight !== null) {
          nextWeight = round(nextWeight * 0.88, 2);
        }
        const repMin = Math.max(5, Math.min(nextReps.min, 8));
        const repMax = Math.max(repMin, Math.min(nextReps.max, 12));
        nextReps = { min: repMin, max: repMax };
        nextRestSeconds = Math.min(420, nextRestSeconds + 45);
        reasons.push(
          "Auto deload week active (ACWR/readiness/fatigue conditions), reducing volume and intensity",
        );
      }

      let nextAction =
        recommendation.progression_action === "substitute"
          ? recommendation.progression_action
          : action;
      if (
        overtrainingHigh &&
        recommendation.recommended_reps.max <= 6 &&
        recommendation.progression_action !== "substitute"
      ) {
        nextAction = "substitute";
      }
      if (substitutionId && recommendation.progression_action !== "deload") {
        nextAction = "substitute";
      }
      if (autoDeloadActive && nextAction !== "substitute") {
        nextAction = "deload";
      }

      return {
        ...recommendation,
        exercise_id: effectiveExerciseId,
        exercise_substitution: substitutionId ?? null,
        progression_action: nextAction,
        recommended_sets: nextSets,
        recommended_reps: nextReps,
        rest_seconds: nextRestSeconds,
        recommended_weight: nextWeight,
        recommendation_reason: dedupeReasons(reasons),
      };
    });

    return {
      ...input.result,
      recommendations,
    };
  } catch (error) {
    logger.warn({
      scope: "training-brain.apply",
      message: "Adaptive brain fallback to base recommendations",
      meta: {
        profileId: context.profileId,
        workoutDate: input.workoutDate,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return input.result;
  }
}

export async function updateExerciseAdaptationState(
  context: BrainContext,
  input: UpdateAdaptationInput,
) {
  try {
    const logsQuery = context.client
      .from("workout_logs")
      .select("id,workout_date,status")
      .eq("user_id", context.profileId)
      .eq("status", "completed");

    if (input.workoutLogId) {
      logsQuery.eq("id", input.workoutLogId);
    } else if (input.workoutDate) {
      logsQuery.eq("workout_date", input.workoutDate);
    } else {
      logsQuery.eq("workout_date", new Date().toISOString().slice(0, 10));
    }

    const logsRes = await logsQuery.limit(5);
    if (logsRes.error) throw new Error(logsRes.error.message);
    const logs = (logsRes.data ?? []) as Array<{ id: string; workout_date: string }>;
    if (logs.length === 0) return { updated: 0 };

    const logIds = logs.map((log) => String(log.id));
    const exerciseRowsRes = await context.client
      .from("workout_log_exercises")
      .select("id,exercise_id,workout_log_id,planned_reps_max")
      .eq("user_id", context.profileId)
      .in("workout_log_id", logIds)
      .not("exercise_id", "is", null);
    if (exerciseRowsRes.error) throw new Error(exerciseRowsRes.error.message);

    const exerciseRows = (exerciseRowsRes.data ?? []) as Array<{
      id: string;
      exercise_id: string;
      workout_log_id: string;
      planned_reps_max: number | null;
    }>;
    if (exerciseRows.length === 0) return { updated: 0 };

    const rowIds = exerciseRows.map((row) => String(row.id));
    const setResults = await Promise.all(
      chunk(rowIds, 250).map((ids) =>
        context.client
          .from("workout_log_sets")
          .select(
            "workout_log_exercise_id,actual_reps,actual_weight_kg,set_status,performed_at",
          )
          .eq("user_id", context.profileId)
          .in("workout_log_exercise_id", ids),
      ),
    );
    const setsByRowId = new Map<
      string,
      Array<{
        workout_log_exercise_id: string;
        actual_reps: number | null;
        actual_weight_kg: number | null;
        set_status: string;
        performed_at: string | null;
      }>
    >();
    setResults.forEach((res) => {
      if (res.error) throw new Error(res.error.message);
      (res.data ?? []).forEach((row) => {
        const key = String(row.workout_log_exercise_id);
        const current = setsByRowId.get(key) ?? [];
        current.push({
          workout_log_exercise_id: key,
          actual_reps: toNullableNumber(row.actual_reps),
          actual_weight_kg: toNullableNumber(row.actual_weight_kg),
          set_status: String(row.set_status ?? "completed"),
          performed_at: row.performed_at ? String(row.performed_at) : null,
        });
        setsByRowId.set(key, current);
      });
    });

    const latestDate = logs
      .map((log) => log.workout_date)
      .sort((a, b) => b.localeCompare(a))[0];
    const recoveryRes = await context.client
      .from("recovery_metrics")
      .select("fatigue_score,readiness_score")
      .eq("user_id", context.profileId)
      .lte("metric_date", latestDate)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recoveryRes.error) throw new Error(recoveryRes.error.message);

    const fatigueScore = toNullableNumber(recoveryRes.data?.fatigue_score);
    const readinessScore = toNullableNumber(recoveryRes.data?.readiness_score);
    let fatigueModifier = 1;
    if ((fatigueScore ?? 0) >= 75 || (readinessScore ?? 100) <= 35) {
      fatigueModifier = 0.9;
    } else if ((fatigueScore ?? 100) <= 35 && (readinessScore ?? 0) >= 70) {
      fatigueModifier = 1.03;
    }

    const byExerciseId = new Map<
      string,
      {
        completed: Array<{ reps: number; weight: number; performedAt: string | null }>;
        failedCount: number;
        totalCount: number;
        plannedRepMaxValues: number[];
      }
    >();

    exerciseRows.forEach((row) => {
      const exerciseId = String(row.exercise_id);
      const current = byExerciseId.get(exerciseId) ?? {
        completed: [],
        failedCount: 0,
        totalCount: 0,
        plannedRepMaxValues: [],
      };
      if (row.planned_reps_max !== null && row.planned_reps_max !== undefined) {
        current.plannedRepMaxValues.push(toNumber(row.planned_reps_max, 0));
      }
      (setsByRowId.get(String(row.id)) ?? []).forEach((setRow) => {
        if (setRow.set_status !== "completed" && setRow.set_status !== "failed") return;
        current.totalCount += 1;
        if (setRow.set_status === "failed") {
          current.failedCount += 1;
          return;
        }
        const reps = Math.max(0, toNumber(setRow.actual_reps, 0));
        const weight = Math.max(0, toNumber(setRow.actual_weight_kg, 0));
        current.completed.push({
          reps,
          weight,
          performedAt: setRow.performed_at,
        });
      });
      byExerciseId.set(exerciseId, current);
    });

    const rows = Array.from(byExerciseId.entries())
      .map(([exerciseId, value]) => {
        if (value.completed.length === 0) return null;
        const sorted = [...value.completed].sort((a, b) =>
          String(b.performedAt ?? "").localeCompare(String(a.performedAt ?? "")),
        );
        const last = sorted[0];
        const e1rm = Math.max(
          ...value.completed.map((setRow) => estimated1rm(setRow.weight, setRow.reps)),
        );
        const avgReps =
          value.completed.reduce((sum, setRow) => sum + setRow.reps, 0) /
          value.completed.length;
        const targetRepMax =
          value.plannedRepMaxValues.length > 0
            ? value.plannedRepMaxValues.reduce((sum, r) => sum + r, 0) /
              value.plannedRepMaxValues.length
            : avgReps;
        const failureRate =
          value.totalCount > 0 ? value.failedCount / value.totalCount : 0;
        let progressionModifier = 1;
        if (failureRate >= 0.3) progressionModifier = 0.95;
        else if (avgReps >= targetRepMax + 1) progressionModifier = 1.025;

        return {
          user_id: context.profileId,
          exercise_id: exerciseId,
          last_weight: round(last.weight, 2),
          last_reps: Math.max(0, Math.round(last.reps)),
          estimated_1rm: round(e1rm, 2),
          fatigue_modifier: round(fatigueModifier, 3),
          progression_modifier: round(progressionModifier, 3),
          last_trained_at: last.performedAt ?? `${latestDate}T00:00:00.000Z`,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) return { updated: 0 };

    const upsertRes = await context.client
      .from("exercise_adaptation_state")
      .upsert(rows, { onConflict: "user_id,exercise_id" });
    if (upsertRes.error) {
      if (ADAPTATION_TABLE_MISSING_CODES.has(upsertRes.error.code ?? "")) {
        return { updated: 0 };
      }
      throw new Error(upsertRes.error.message);
    }

    return { updated: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown adaptation update error";
    logger.warn({
      scope: "training-brain.update-adaptation-state",
      message: "Failed to update adaptation state",
      meta: {
        profileId: context.profileId,
        workoutDate: input.workoutDate ?? null,
        workoutLogId: input.workoutLogId ?? null,
        error: message,
      },
    });
    return { updated: 0 };
  }
}
