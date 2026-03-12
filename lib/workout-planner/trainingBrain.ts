import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";
import { logger } from "@/lib/server/logger";
import { getRecoveryState } from "@/lib/workout-planner/recoveryEngine";
import { getTrainingLoadState } from "@/lib/workout-planner/trainingLoadEngine";

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

  try {
    const [stateRows, historyContext, fatigueSignal, injuries, trainingLoadState] = await Promise.all([
      loadAdaptationStateRows(context, exerciseIds),
      loadRecentExerciseContext(context, {
        exerciseIds,
        workoutDate: input.workoutDate,
      }),
      loadFatigueSignal(context, input.workoutDate),
      loadInjuryLevels(context, exerciseIds),
      getTrainingLoadState(context),
    ]);

    const stateMap = new Map(stateRows.map((row) => [row.exercise_id, row]));

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
      const readinessScore = fatigueSignal.readinessAvg;
      const readinessBelow40 = readinessScore !== null && readinessScore < 40;
      const readinessBelow30 = readinessScore !== null && readinessScore < 30;
      const overtrainingRisk = toNullableNumber(trainingLoadState?.overtraining_risk);
      const plateauRisk = toNullableNumber(trainingLoadState?.plateau_risk);
      const loadAcwr = toNullableNumber(trainingLoadState?.acwr);
      const overtrainingHigh = (overtrainingRisk ?? 0) >= 70;
      const plateauHigh = (plateauRisk ?? 0) >= 70;

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

      return {
        ...recommendation,
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
