import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecoveryState } from "@/lib/workout-planner/recoveryEngine";
import { getTrainingLoadState } from "@/lib/workout-planner/trainingLoadEngine";

type MuscleFatigueContext = {
  client: SupabaseClient;
  profileId: string;
};

type RecomputeMuscleFatigueInput = {
  referenceDate?: string;
};

type CompletedSetRow = {
  workout_log_exercise_id: string;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  performed_at: string | null;
  set_status: string;
};

type WorkoutLogExerciseRow = {
  id: string;
  exercise_id: string | null;
  muscle_group: string | null;
};

type ExerciseMuscleRow = {
  id: string;
  target_muscle: string | null;
  secondary_muscles: string[];
};

export type MuscleFatigueStateRow = {
  user_id: string;
  muscle_group: string;
  fatigue_score: number;
  last_trained_at: string | null;
  recovery_rate: number;
  updated_at: string;
};

const MUSCLE_FATIGUE_TABLE_MISSING_CODES = new Set(["42P01", "42703"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

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

function toStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : String(item ?? "")))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMuscleGroup(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseDateOnly(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(referenceDate: string, days: number) {
  const date = parseDateOnly(referenceDate);
  date.setUTCDate(date.getUTCDate() - days);
  return dateKey(date);
}

function chunk<T>(items: T[], size: number) {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildMuscleGroups(
  input: {
    targetMuscle: string | null;
    secondaryMuscles: string[];
    fallbackMuscle: string | null;
  },
) {
  const groups = [
    normalizeMuscleGroup(input.targetMuscle),
    ...input.secondaryMuscles.map((muscle) => normalizeMuscleGroup(muscle)),
    normalizeMuscleGroup(input.fallbackMuscle),
  ].filter(Boolean);
  return Array.from(new Set(groups));
}

async function loadCompletedSets(
  context: MuscleFatigueContext,
  input: { fromIso: string; toIso: string },
) {
  const result = await context.client
    .from("workout_log_sets")
    .select(
      "workout_log_exercise_id,actual_reps,actual_weight_kg,performed_at,set_status",
    )
    .eq("user_id", context.profileId)
    .eq("set_status", "completed")
    .gte("performed_at", input.fromIso)
    .lte("performed_at", input.toIso)
    .order("performed_at", { ascending: false })
    .limit(12000);
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map((row) => ({
    workout_log_exercise_id: String(row.workout_log_exercise_id),
    actual_reps: toNullableNumber(row.actual_reps),
    actual_weight_kg: toNullableNumber(row.actual_weight_kg),
    performed_at: row.performed_at ? String(row.performed_at) : null,
    set_status: String(row.set_status ?? "completed"),
  })) as CompletedSetRow[];
}

async function loadWorkoutLogExercises(
  context: MuscleFatigueContext,
  rowIds: string[],
) {
  if (rowIds.length === 0) return [] as WorkoutLogExerciseRow[];

  const results = await Promise.all(
    chunk(rowIds, 250).map((ids) =>
      context.client
        .from("workout_log_exercises")
        .select("id,exercise_id,muscle_group")
        .eq("user_id", context.profileId)
        .in("id", ids),
    ),
  );

  const out: WorkoutLogExerciseRow[] = [];
  results.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    (res.data ?? []).forEach((row) => {
      out.push({
        id: String(row.id),
        exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        muscle_group: row.muscle_group ? String(row.muscle_group) : null,
      });
    });
  });
  return out;
}

async function loadExerciseMuscles(
  context: MuscleFatigueContext,
  exerciseIds: string[],
) {
  if (exerciseIds.length === 0) return [] as ExerciseMuscleRow[];

  const results = await Promise.all(
    chunk(exerciseIds, 250).map((ids) =>
      context.client
        .from("exercises")
        .select("id,target_muscle,secondary_muscles")
        .in("id", ids),
    ),
  );

  const out: ExerciseMuscleRow[] = [];
  results.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    (res.data ?? []).forEach((row) => {
      out.push({
        id: String(row.id),
        target_muscle: row.target_muscle ? String(row.target_muscle) : null,
        secondary_muscles: toStrings(row.secondary_muscles),
      });
    });
  });
  return out;
}

export async function getMuscleFatigueState(
  context: MuscleFatigueContext,
  input?: { muscleGroups?: string[] },
) {
  let query = context.client
    .from("muscle_fatigue_state")
    .select(
      "user_id,muscle_group,fatigue_score,last_trained_at,recovery_rate,updated_at",
    )
    .eq("user_id", context.profileId)
    .order("fatigue_score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);

  const normalizedMuscles = Array.from(
    new Set((input?.muscleGroups ?? []).map((muscle) => normalizeMuscleGroup(muscle)).filter(Boolean)),
  );
  if (normalizedMuscles.length > 0) {
    query = query.in("muscle_group", normalizedMuscles);
  }

  const res = await query;
  if (res.error) {
    if (MUSCLE_FATIGUE_TABLE_MISSING_CODES.has(res.error.code ?? "")) {
      return null;
    }
    throw new Error(res.error.message);
  }

  return (res.data ?? []).map((row) => ({
    user_id: String(row.user_id),
    muscle_group: normalizeMuscleGroup(String(row.muscle_group ?? "")),
    fatigue_score: round(Math.max(0, toNumber(row.fatigue_score, 0)), 2),
    last_trained_at: row.last_trained_at ? String(row.last_trained_at) : null,
    recovery_rate: round(clamp(toNumber(row.recovery_rate, 1), 0.1, 3), 3),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  })) as MuscleFatigueStateRow[];
}

export async function recomputeMuscleFatigueState(
  context: MuscleFatigueContext,
  input?: RecomputeMuscleFatigueInput,
) {
  const referenceDateRaw = String(input?.referenceDate ?? "").trim();
  const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDateRaw)
    ? referenceDateRaw
    : dateKey(new Date());

  const referenceEndIso = `${referenceDate}T23:59:59.999Z`;
  const fromIso = `${daysAgo(referenceDate, 42)}T00:00:00.000Z`;
  const [setRows, recoveryState, trainingLoadState, existingRows] = await Promise.all([
    loadCompletedSets(context, { fromIso, toIso: referenceEndIso }),
    getRecoveryState({
      client: context.client,
      profileId: context.profileId,
    }),
    getTrainingLoadState({
      client: context.client,
      profileId: context.profileId,
    }),
    getMuscleFatigueState(context),
  ]);

  const existingMap = new Map(
    (existingRows ?? []).map((row) => [normalizeMuscleGroup(row.muscle_group), row]),
  );

  if (setRows.length === 0 && existingMap.size === 0) {
    return { updated: 0, rows: [] as MuscleFatigueStateRow[] };
  }

  const workoutLogExerciseIds = Array.from(
    new Set(setRows.map((row) => row.workout_log_exercise_id).filter(Boolean)),
  );
  const workoutLogExercises = await loadWorkoutLogExercises(
    context,
    workoutLogExerciseIds,
  );
  const workoutLogExerciseMap = new Map(
    workoutLogExercises.map((row) => [row.id, row]),
  );
  const exerciseIds = Array.from(
    new Set(
      workoutLogExercises
        .map((row) => row.exercise_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const exerciseMuscles = await loadExerciseMuscles(context, exerciseIds);
  const exerciseMuscleMap = new Map(exerciseMuscles.map((row) => [row.id, row]));

  const referenceEnd = new Date(referenceEndIso);
  const since7 = parseDateOnly(daysAgo(referenceDate, 7));
  const since21 = parseDateOnly(daysAgo(referenceDate, 21));

  const aggregateByMuscle = new Map<
    string,
    { volume7d: number; volume21d: number; lastTrainedAt: string | null }
  >();

  setRows.forEach((setRow) => {
    if (!setRow.performed_at) return;
    const ts = new Date(setRow.performed_at);
    if (Number.isNaN(ts.getTime()) || ts < since21 || ts > referenceEnd) return;
    const reps = Math.max(0, toNumber(setRow.actual_reps, 0));
    const weight = Math.max(0, toNumber(setRow.actual_weight_kg, 0));
    const volumeKg = reps * weight;
    if (volumeKg <= 0) return;

    const workoutExercise = workoutLogExerciseMap.get(setRow.workout_log_exercise_id);
    const exerciseMuscle = workoutExercise?.exercise_id
      ? exerciseMuscleMap.get(workoutExercise.exercise_id)
      : null;
    const muscles = buildMuscleGroups({
      targetMuscle: exerciseMuscle?.target_muscle ?? null,
      secondaryMuscles: exerciseMuscle?.secondary_muscles ?? [],
      fallbackMuscle: workoutExercise?.muscle_group ?? null,
    });
    if (muscles.length === 0) return;

    muscles.forEach((muscle, index) => {
      const multiplier = index === 0 ? 1 : 0.45;
      const current = aggregateByMuscle.get(muscle) ?? {
        volume7d: 0,
        volume21d: 0,
        lastTrainedAt: null,
      };
      if (ts >= since7) {
        current.volume7d += volumeKg * multiplier;
      }
      current.volume21d += volumeKg * multiplier;
      if (!current.lastTrainedAt || ts > new Date(current.lastTrainedAt)) {
        current.lastTrainedAt = ts.toISOString();
      }
      aggregateByMuscle.set(muscle, current);
    });
  });

  const allMuscles = Array.from(
    new Set([...aggregateByMuscle.keys(), ...existingMap.keys()]),
  ).filter(Boolean);
  if (allMuscles.length === 0) {
    return { updated: 0, rows: [] as MuscleFatigueStateRow[] };
  }

  const readinessScore = toNullableNumber(recoveryState?.readiness_score) ?? 55;
  const fatigueScore = toNullableNumber(recoveryState?.fatigue_score) ?? 50;
  const soreness = toNullableNumber(recoveryState?.soreness) ?? 4;
  const acwr = toNullableNumber(trainingLoadState?.acwr) ?? 1;

  const sorenessModifier = clamp(1 + soreness / 20, 0.8, 1.6);
  const readinessPenalty = clamp((100 - readinessScore) / 130, 0, 0.7);
  const fatiguePenalty = clamp(fatigueScore / 180, 0, 0.65);
  const loadPenalty = acwr > 1 ? clamp((acwr - 1) * 0.35, 0, 0.5) : 0;
  const recoveryModifier = clamp(
    1 + readinessPenalty + fatiguePenalty + loadPenalty,
    0.7,
    2.0,
  );

  const referenceEndMs = referenceEnd.getTime();
  const rowsToUpsert = allMuscles.map((muscle) => {
    const current = aggregateByMuscle.get(muscle) ?? {
      volume7d: 0,
      volume21d: 0,
      lastTrainedAt: null,
    };
    const previous = existingMap.get(muscle) ?? null;

    const chronicWeekly = current.volume21d > 0 ? current.volume21d / 3 : 0;
    const recentVolumeFactor =
      chronicWeekly > 0
        ? clamp(current.volume7d / chronicWeekly, 0.35, 2.4)
        : current.volume7d > 0
          ? 1.15
          : 0.35;

    const rawFatigue = recentVolumeFactor * sorenessModifier * recoveryModifier * 32;
    const previousFatigue = previous?.fatigue_score ?? rawFatigue * 0.5;
    const lastTrainedAt = current.lastTrainedAt ?? previous?.last_trained_at ?? null;

    const derivedRecoveryRate = clamp(
      1 + (readinessScore - 55) / 120 - (fatigueScore - 50) / 180,
      0.2,
      2.2,
    );
    let recoveryRate = previous?.recovery_rate ?? derivedRecoveryRate;
    recoveryRate = clamp(recoveryRate, 0.1, 3);

    const hoursSinceLastTrained = lastTrainedAt
      ? clamp((referenceEndMs - new Date(lastTrainedAt).getTime()) / (1000 * 60 * 60), 0, 720)
      : 240;
    const fatigueReduction = hoursSinceLastTrained * recoveryRate * 0.12;
    let computedFatigue = clamp(
      rawFatigue * 0.65 + previousFatigue * 0.45 - fatigueReduction,
      0,
      100,
    );

    if (computedFatigue >= 80) {
      recoveryRate = clamp(recoveryRate * 0.9, 0.1, 3);
    } else if (computedFatigue <= 35 && readinessScore >= 65) {
      recoveryRate = clamp(recoveryRate * 1.05, 0.1, 3);
      computedFatigue = clamp(computedFatigue * 0.96, 0, 100);
    }

    return {
      user_id: context.profileId,
      muscle_group: muscle,
      fatigue_score: round(computedFatigue, 2),
      last_trained_at: lastTrainedAt,
      recovery_rate: round(recoveryRate, 3),
      updated_at: new Date().toISOString(),
    };
  });

  const upsertRes = await context.client
    .from("muscle_fatigue_state")
    .upsert(rowsToUpsert, { onConflict: "user_id,muscle_group" })
    .select(
      "user_id,muscle_group,fatigue_score,last_trained_at,recovery_rate,updated_at",
    );

  if (upsertRes.error) {
    if (MUSCLE_FATIGUE_TABLE_MISSING_CODES.has(upsertRes.error.code ?? "")) {
      return { updated: 0, rows: [] as MuscleFatigueStateRow[] };
    }
    throw new Error(upsertRes.error.message);
  }

  const rows = (upsertRes.data ?? []).map((row) => ({
    user_id: String(row.user_id),
    muscle_group: normalizeMuscleGroup(String(row.muscle_group ?? "")),
    fatigue_score: round(Math.max(0, toNumber(row.fatigue_score, 0)), 2),
    last_trained_at: row.last_trained_at ? String(row.last_trained_at) : null,
    recovery_rate: round(clamp(toNumber(row.recovery_rate, 1), 0.1, 3), 3),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  })) as MuscleFatigueStateRow[];

  return {
    updated: rows.length,
    rows,
  };
}
