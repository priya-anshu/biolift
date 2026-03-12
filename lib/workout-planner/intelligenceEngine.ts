import type { SupabaseClient } from "@supabase/supabase-js";

type EngineContext = {
  client: SupabaseClient;
  profileId: string;
};

type ProgressionAction =
  | "increase"
  | "maintain"
  | "reduce"
  | "deload"
  | "substitute";

type ReadinessBand = "green" | "yellow" | "red";

export type TrainingIntelligenceRequest = {
  workoutDate: string;
  planId?: string;
  lookbackDays?: number;
  dayIndex?: number;
};

export type ExerciseRecommendation = {
  exercise_id: string | null;
  original_exercise_id: string | null;
  plan_exercise_id: string;
  recommended_weight: number | null;
  recommended_reps: { min: number; max: number };
  recommended_sets: number;
  rest_seconds: number;
  exercise_substitution: string | null;
  progression_action: ProgressionAction;
  recommendation_reason: string[];
  metrics: {
    latest_e1rm: number | null;
    weekly_volume_kg: number;
    volume_trend_7d_pct: number;
    strength_rate_pct_week: number | null;
    recent_avg_reps: number | null;
    recent_avg_rpe: number | null;
    failed_sets_recent: number;
  };
};

export type TrainingIntelligenceResult = {
  plan_id: string;
  workout_date: string;
  effective_day_index: number;
  readiness_band: ReadinessBand;
  readiness_score: number | null;
  fatigue_score: number;
  adherence_score: number;
  recommendations: ExerciseRecommendation[];
};

type PlanRow = {
  id: string;
  goal: string;
  experience_level: string;
};

type PlanExerciseRow = {
  id: string;
  day_index: number;
  exercise_order: number;
  exercise_id: string | null;
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  rpe: number | null;
  difficulty_level: string;
  equipment_required: string[];
};

type WorkoutLogRow = {
  id: string;
  workout_date: string;
  status: string;
  completion_percentage: number;
};

type LogExerciseRow = {
  id: string;
  workout_log_id: string;
  exercise_id: string | null;
  exercise_name: string;
  created_at: string;
};

type SetRow = {
  workout_log_exercise_id: string;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  actual_rpe: number | null;
  set_status: string;
  performed_at: string;
};

type PersonalRecordRow = {
  exercise_id: string;
  estimated_1rm: number;
  achieved_at: string;
};

type RecoveryRow = {
  readiness_score: number | null;
  fatigue_score: number | null;
  soreness_level: number | null;
};

type InjuryRow = {
  exercise_id: string | null;
  body_region: string;
  severity: number;
  pain_level: number;
  restricted_movements: string[];
  load_cap_percentage: number | null;
  medical_clearance_required: boolean;
};

type CatalogRow = {
  id: string;
  name: string;
  target_muscle: string;
  secondary_muscles: string[];
  difficulty_level: string;
  equipment_required: string[];
  instructions: string[];
};

type FatigueSummary = {
  fatigueScore: number;
  readinessScore: number | null;
  readinessBand: ReadinessBand;
};

type ExerciseSignal = {
  latestE1rm: number | null;
  latestWorkingWeightKg: number | null;
  weeklyVolumeKg: number;
  volumeTrend7dPct: number;
  strengthRatePctWeek: number | null;
  recentAvgReps: number | null;
  recentAvgRpe: number | null;
  failedSetsRecent: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 42;
const LOWER_BODY_KEYWORDS = [
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "legs",
  "lower",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value) || step <= 0) return value;
  return Math.round(value / step) * step;
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toNum(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toNullableNum(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = toNum(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function toStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (typeof x === "string" ? x : String(x ?? "")))
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseDateOnly(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function dayIndex(dateText: string) {
  const d = parseDateOnly(dateText).getUTCDay();
  return d === 0 ? 7 : d;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(ref: Date, days: number) {
  return new Date(ref.getTime() - days * DAY_MS);
}

function chunk<T>(items: T[], size: number) {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function exerciseKey(row: { exercise_id: string | null; exercise_name: string }) {
  return row.exercise_id ?? `name:${norm(row.exercise_name)}`;
}

function setE1rm(weight: number, reps: number) {
  return weight * (1 + Math.min(reps, 10) / 30);
}

function difficultyRank(level: string) {
  const l = norm(level);
  if (l === "beginner") return 1;
  if (l === "intermediate") return 2;
  return 3;
}

function isLowerBody(muscleGroup: string) {
  const m = norm(muscleGroup);
  return LOWER_BODY_KEYWORDS.some((k) => m.includes(k));
}

async function loadPlan(context: EngineContext, planId?: string): Promise<PlanRow> {
  const select = "id,goal,experience_level,created_at";

  if (planId) {
    const res = await context.client
      .from("workout_plans")
      .select(select)
      .eq("id", planId)
      .eq("user_id", context.profileId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("Workout plan not found");
    return {
      id: String(res.data.id),
      goal: String(res.data.goal),
      experience_level: String(res.data.experience_level),
    };
  }

  const res = await context.client
    .from("workout_plans")
    .select(select)
    .eq("user_id", context.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (res.data) {
    return {
      id: String(res.data.id),
      goal: String(res.data.goal),
      experience_level: String(res.data.experience_level),
    };
  }

  const fallback = await context.client
    .from("workout_plans")
    .select(select)
    .eq("user_id", context.profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallback.error) throw new Error(fallback.error.message);
  if (!fallback.data) throw new Error("No workout plan available");
  return {
    id: String(fallback.data.id),
    goal: String(fallback.data.goal),
    experience_level: String(fallback.data.experience_level),
  };
}

async function loadPlanExercises(
  context: EngineContext,
  planId: string,
  requestedDayIndex: number,
): Promise<{ rows: PlanExerciseRow[]; effectiveDayIndex: number }> {
  const select =
    "id,day_index,exercise_order,exercise_id,exercise_name,muscle_group,sets,reps_min,reps_max,rest_seconds,rpe,difficulty_level,equipment_required";

  const dayRes = await context.client
    .from("workout_plan_exercises")
    .select(select)
    .eq("plan_id", planId)
    .eq("day_index", requestedDayIndex)
    .order("exercise_order", { ascending: true });
  if (dayRes.error) throw new Error(dayRes.error.message);

  const mapRow = (row: Record<string, unknown>): PlanExerciseRow => ({
    id: String(row.id),
    day_index: toNum(row.day_index, requestedDayIndex),
    exercise_order: toNum(row.exercise_order, 1),
    exercise_id: row.exercise_id ? String(row.exercise_id) : null,
    exercise_name: String(row.exercise_name ?? ""),
    muscle_group: String(row.muscle_group ?? ""),
    sets: toNum(row.sets, 3),
    reps_min: toNum(row.reps_min, 8),
    reps_max: toNum(row.reps_max, 12),
    rest_seconds: toNum(row.rest_seconds, 60),
    rpe: toNullableNum(row.rpe),
    difficulty_level: String(row.difficulty_level ?? "intermediate"),
    equipment_required: toStrings(row.equipment_required),
  });

  const dayRows = (dayRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  if (dayRows.length > 0) {
    return { rows: dayRows, effectiveDayIndex: requestedDayIndex };
  }

  const allRes = await context.client
    .from("workout_plan_exercises")
    .select(select)
    .eq("plan_id", planId)
    .order("day_index", { ascending: true })
    .order("exercise_order", { ascending: true });
  if (allRes.error) throw new Error(allRes.error.message);
  const allRows = (allRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  if (allRows.length === 0) return { rows: [], effectiveDayIndex: requestedDayIndex };

  const firstDay = allRows[0].day_index;
  return {
    rows: allRows.filter((r) => r.day_index === firstDay),
    effectiveDayIndex: firstDay,
  };
}

async function loadWorkoutLogs(
  context: EngineContext,
  fromDate: string,
): Promise<WorkoutLogRow[]> {
  const res = await context.client
    .from("workout_logs")
    .select("id,workout_date,status,completion_percentage")
    .eq("user_id", context.profileId)
    .gte("workout_date", fromDate)
    .order("workout_date", { ascending: false })
    .limit(1000);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    id: String(row.id),
    workout_date: String(row.workout_date),
    status: String(row.status ?? "planned"),
    completion_percentage: toNum(row.completion_percentage, 0),
  }));
}

async function loadLogExercises(
  context: EngineContext,
  logIds: string[],
): Promise<LogExerciseRow[]> {
  if (logIds.length === 0) return [];
  const chunks = chunk(logIds, 250);
  const results = await Promise.all(
    chunks.map((ids) =>
      context.client
        .from("workout_log_exercises")
        .select("id,workout_log_id,exercise_id,exercise_name,created_at")
        .eq("user_id", context.profileId)
        .in("workout_log_id", ids)
        .order("created_at", { ascending: false }),
    ),
  );
  const out: LogExerciseRow[] = [];
  results.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    out.push(
      ...(res.data ?? []).map((row) => ({
        id: String(row.id),
        workout_log_id: String(row.workout_log_id),
        exercise_id: row.exercise_id ? String(row.exercise_id) : null,
        exercise_name: String(row.exercise_name ?? ""),
        created_at: String(row.created_at ?? new Date().toISOString()),
      })),
    );
  });
  return out;
}

async function loadSetRows(
  context: EngineContext,
  workoutLogExerciseIds: string[],
): Promise<SetRow[]> {
  if (workoutLogExerciseIds.length === 0) return [];
  const chunks = chunk(workoutLogExerciseIds, 250);
  const results = await Promise.all(
    chunks.map((ids) =>
      context.client
        .from("workout_log_sets")
        .select(
          "workout_log_exercise_id,actual_reps,actual_weight_kg,actual_rpe,set_status,performed_at",
        )
        .eq("user_id", context.profileId)
        .in("workout_log_exercise_id", ids)
        .order("performed_at", { ascending: false }),
    ),
  );
  const out: SetRow[] = [];
  results.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    out.push(
      ...(res.data ?? []).map((row) => ({
        workout_log_exercise_id: String(row.workout_log_exercise_id),
        actual_reps: toNullableNum(row.actual_reps),
        actual_weight_kg: toNullableNum(row.actual_weight_kg),
        actual_rpe: toNullableNum(row.actual_rpe),
        set_status: String(row.set_status ?? "completed"),
        performed_at: String(row.performed_at ?? new Date().toISOString()),
      })),
    );
  });
  return out;
}

async function loadGlobalSetsForFatigue(
  context: EngineContext,
  fromIso: string,
): Promise<SetRow[]> {
  const res = await context.client
    .from("workout_log_sets")
    .select(
      "workout_log_exercise_id,actual_reps,actual_weight_kg,actual_rpe,set_status,performed_at",
    )
    .eq("user_id", context.profileId)
    .gte("performed_at", fromIso)
    .order("performed_at", { ascending: false })
    .limit(5000);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    workout_log_exercise_id: String(row.workout_log_exercise_id),
    actual_reps: toNullableNum(row.actual_reps),
    actual_weight_kg: toNullableNum(row.actual_weight_kg),
    actual_rpe: toNullableNum(row.actual_rpe),
    set_status: String(row.set_status ?? "completed"),
    performed_at: String(row.performed_at ?? new Date().toISOString()),
  }));
}

async function loadPersonalRecords(
  context: EngineContext,
  exerciseIds: string[],
): Promise<PersonalRecordRow[]> {
  if (exerciseIds.length === 0) return [];
  const chunks = chunk(exerciseIds, 250);
  const results = await Promise.all(
    chunks.map((ids) =>
      context.client
        .from("personal_records")
        .select("exercise_id,estimated_1rm,achieved_at")
        .eq("user_id", context.profileId)
        .in("exercise_id", ids)
        .order("achieved_at", { ascending: false }),
    ),
  );
  const out: PersonalRecordRow[] = [];
  results.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    out.push(
      ...(res.data ?? []).map((row) => ({
        exercise_id: String(row.exercise_id),
        estimated_1rm: toNum(row.estimated_1rm, 0),
        achieved_at: String(row.achieved_at ?? new Date().toISOString()),
      })),
    );
  });
  return out;
}

async function loadRecoveryRows(
  context: EngineContext,
  fromDate: string,
): Promise<RecoveryRow[]> {
  const res = await context.client
    .from("recovery_metrics")
    .select("readiness_score,fatigue_score,soreness_level,metric_date")
    .eq("user_id", context.profileId)
    .gte("metric_date", fromDate)
    .order("metric_date", { ascending: false })
    .limit(30);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    readiness_score: toNullableNum(row.readiness_score),
    fatigue_score: toNullableNum(row.fatigue_score),
    soreness_level: toNullableNum(row.soreness_level),
  }));
}

async function loadActiveInjuries(context: EngineContext): Promise<InjuryRow[]> {
  const res = await context.client
    .from("injury_flags")
    .select(
      "exercise_id,body_region,severity,pain_level,status,restricted_movements,load_cap_percentage,medical_clearance_required",
    )
    .eq("user_id", context.profileId)
    .in("status", ["active", "monitoring", "recovering"])
    .order("flagged_on", { ascending: false })
    .limit(200);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    exercise_id: row.exercise_id ? String(row.exercise_id) : null,
    body_region: String(row.body_region ?? ""),
    severity: toNum(row.severity, 1),
    pain_level: toNum(row.pain_level, 0),
    restricted_movements: toStrings(row.restricted_movements),
    load_cap_percentage: toNullableNum(row.load_cap_percentage),
    medical_clearance_required: Boolean(row.medical_clearance_required),
  }));
}

async function loadCatalog(
  context: EngineContext,
  muscles: string[],
): Promise<CatalogRow[]> {
  let query = context.client
    .from("exercises")
    .select(
      "id,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,instructions,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(800);

  const normalized = muscles.map((m) => norm(m)).filter(Boolean);
  if (normalized.length > 0) {
    query = query.in("target_muscle", normalized);
  }

  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    target_muscle: String(row.target_muscle ?? ""),
    secondary_muscles: toStrings(row.secondary_muscles),
    difficulty_level: String(row.difficulty_level ?? "intermediate"),
    equipment_required: toStrings(row.equipment_required),
    instructions: toStrings(row.instructions),
  }));
}

function fatigueSummary(
  globalSets: SetRow[],
  recoveryRows: RecoveryRow[],
  analysisDate: Date,
): FatigueSummary {
  const w7 = daysAgo(analysisDate, 7);
  const w14 = daysAgo(analysisDate, 14);
  const w28 = daysAgo(analysisDate, 28);
  const completed = globalSets.filter((s) => s.set_status === "completed");

  const load = (from: Date, to: Date) =>
    completed.reduce((sum, s) => {
      const t = new Date(s.performed_at);
      if (t < from || t >= to) return sum;
      const reps = s.actual_reps ?? 0;
      const weight = s.actual_weight_kg ?? 0;
      return sum + Math.max(0, reps * weight);
    }, 0);

  const acute = load(w7, analysisDate);
  const chronic = load(w28, analysisDate) / 4;
  const acwr = chronic > 0 ? acute / chronic : acute > 0 ? 1.25 : 1;
  const acwrPenalty = clamp((acwr - 0.8) / 0.7, 0, 1);

  const workSets14 = globalSets.filter(
    (s) =>
      new Date(s.performed_at) >= w14 &&
      (s.set_status === "completed" || s.set_status === "failed"),
  );
  const failRate =
    workSets14.length > 0
      ? workSets14.filter((s) => s.set_status === "failed").length / workSets14.length
      : 0;

  const recentRecovery = recoveryRows.slice(0, 3);
  const avgReadiness =
    avg(
      recentRecovery
        .map((r) => r.readiness_score)
        .filter((v): v is number => v !== null),
    ) ?? 55;
  const avgSoreness =
    avg(
      recentRecovery
        .map((r) => r.soreness_level)
        .filter((v): v is number => v !== null),
    ) ?? 4;

  const calc = clamp(
    35 * acwrPenalty +
      25 * failRate +
      20 * (1 - clamp(avgReadiness / 100, 0, 1)) +
      20 * clamp(avgSoreness / 10, 0, 1),
    0,
    100,
  );

  const dbFatigue =
    recoveryRows.find((r) => r.fatigue_score !== null)?.fatigue_score ?? null;
  const readiness =
    recoveryRows.find((r) => r.readiness_score !== null)?.readiness_score ?? null;

  const fatigue = dbFatigue !== null ? round(0.6 * dbFatigue + 0.4 * calc, 1) : round(calc, 1);

  let band: ReadinessBand = "yellow";
  if (readiness !== null) {
    if (readiness >= 70 && fatigue < 40) band = "green";
    else if (readiness < 45 || fatigue > 65) band = "red";
  } else {
    if (fatigue < 40) band = "green";
    else if (fatigue > 65) band = "red";
  }

  return { fatigueScore: fatigue, readinessScore: readiness, readinessBand: band };
}

function adherenceScore(logs: WorkoutLogRow[], analysisDate: Date) {
  const start = daysAgo(analysisDate, 28);
  const plannedStatuses = new Set(["planned", "in_progress", "completed", "missed"]);
  const filtered = logs.filter((l) => parseDateOnly(l.workout_date) >= start);
  const planned = filtered.filter((l) => plannedStatuses.has(l.status));
  if (planned.length === 0) return 50;
  const completed = planned.filter((l) => l.status === "completed").length;
  const quality = avg(planned.map((l) => clamp(l.completion_percentage, 0, 100))) ?? 0;
  return round(
    clamp((0.7 * (completed / planned.length) + 0.3 * (quality / 100)) * 100, 0, 100),
    1,
  );
}

function computeSignal(
  planExercise: PlanExerciseRow,
  logExercises: LogExerciseRow[],
  setRows: SetRow[],
  prs: PersonalRecordRow[],
  analysisDate: Date,
): ExerciseSignal {
  const rowIds = new Set(logExercises.map((r) => r.id));
  const relevantSets = setRows.filter((s) => rowIds.has(s.workout_log_exercise_id));

  const sessions = logExercises
    .map((row) => {
      const sets = relevantSets.filter((s) => s.workout_log_exercise_id === row.id);
      const completed = sets.filter((s) => s.set_status === "completed" && (s.actual_reps ?? 0) >= 1);
      const failed = sets.filter((s) => s.set_status === "failed");
      const ts =
        sets.map((s) => new Date(s.performed_at).getTime()).sort((a, b) => b - a)[0] ??
        new Date(row.created_at).getTime();
      return {
        ts: new Date(ts),
        avgReps:
          avg(
            completed
              .map((s) => s.actual_reps)
              .filter((v): v is number => v !== null),
          ) ?? null,
        avgRpe:
          avg(
            completed
              .map((s) => s.actual_rpe)
              .filter((v): v is number => v !== null),
          ) ?? null,
        completedCount: completed.length,
        failedCount: failed.length,
      };
    })
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 2);

  const recentAvgReps =
    avg(sessions.map((s) => s.avgReps).filter((v): v is number => v !== null)) ?? null;
  const recentAvgRpe =
    avg(sessions.map((s) => s.avgRpe).filter((v): v is number => v !== null)) ?? null;
  const failedSetsRecent = sessions.reduce((sum, s) => sum + s.failedCount, 0);

  const weekStart = daysAgo(analysisDate, 7);
  const prevWeekStart = daysAgo(analysisDate, 14);
  const volume = (from: Date, to: Date) =>
    relevantSets.reduce((sum, s) => {
      if (s.set_status !== "completed") return sum;
      const ts = new Date(s.performed_at);
      if (ts < from || ts >= to) return sum;
      return sum + Math.max(0, (s.actual_reps ?? 0) * (s.actual_weight_kg ?? 0));
    }, 0);
  const weeklyVolumeKg = volume(weekStart, analysisDate);
  const weeklyVolumePrev = volume(prevWeekStart, weekStart);
  const volumeTrend7dPct =
    weeklyVolumePrev > 0
      ? ((weeklyVolumeKg - weeklyVolumePrev) / weeklyVolumePrev) * 100
      : weeklyVolumeKg > 0
        ? 100
        : 0;

  const recentWeights = relevantSets
    .filter((s) => s.set_status === "completed" && (s.actual_weight_kg ?? 0) > 0)
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
    .slice(0, 3)
    .map((s) => s.actual_weight_kg as number);
  const latestWorkingWeightKg = median(recentWeights);

  const events: Array<{ value: number; ts: Date }> = [];
  relevantSets.forEach((s) => {
    if (s.set_status !== "completed") return;
    if ((s.actual_reps ?? 0) < 1 || (s.actual_weight_kg ?? 0) <= 0) return;
    events.push({
      value: setE1rm(s.actual_weight_kg as number, s.actual_reps as number),
      ts: new Date(s.performed_at),
    });
  });
  prs.forEach((pr) => events.push({ value: pr.estimated_1rm, ts: new Date(pr.achieved_at) }));

  const latestE1rm = events.length > 0 ? Math.max(...events.map((e) => e.value)) : null;
  const baselineStart = daysAgo(analysisDate, 42);
  const baselineEnd = daysAgo(analysisDate, 21);
  const recentStart = daysAgo(analysisDate, 21);
  const baseline = events
    .filter((e) => e.ts >= baselineStart && e.ts < baselineEnd)
    .map((e) => e.value);
  const recent = events.filter((e) => e.ts >= recentStart).map((e) => e.value);
  const baselineMax = baseline.length > 0 ? Math.max(...baseline) : null;
  const recentMax = recent.length > 0 ? Math.max(...recent) : null;
  const strengthRatePctWeek =
    baselineMax && recentMax && baselineMax > 0
      ? (((recentMax - baselineMax) / baselineMax) / 3) * 100
      : null;

  // If no history exists, leave signal mostly neutral.
  const neutralReps = recentAvgReps === null ? planExercise.reps_min : recentAvgReps;

  return {
    latestE1rm: latestE1rm !== null ? round(latestE1rm, 2) : null,
    latestWorkingWeightKg:
      latestWorkingWeightKg !== null ? round(latestWorkingWeightKg, 2) : null,
    weeklyVolumeKg: round(weeklyVolumeKg, 2),
    volumeTrend7dPct: round(volumeTrend7dPct, 2),
    strengthRatePctWeek:
      strengthRatePctWeek !== null ? round(strengthRatePctWeek, 2) : null,
    recentAvgReps: neutralReps !== null ? round(neutralReps, 2) : null,
    recentAvgRpe: recentAvgRpe !== null ? round(recentAvgRpe, 2) : null,
    failedSetsRecent,
  };
}

function matchInjuries(planExercise: PlanExerciseRow, injuries: InjuryRow[]) {
  const exId = planExercise.exercise_id;
  const exName = norm(planExercise.exercise_name);
  const muscle = norm(planExercise.muscle_group);
  return injuries.filter((injury) => {
    if (injury.exercise_id && exId && injury.exercise_id === exId) return true;
    const region = norm(injury.body_region);
    const regionMatch = region && (muscle.includes(region) || region.includes(muscle));
    const movementMatch = injury.restricted_movements.some((m) => {
      const token = norm(m);
      return token && (exName.includes(token) || token.includes(exName));
    });
    return regionMatch || movementMatch;
  });
}

function pickSubstitute(
  planExercise: PlanExerciseRow,
  injuries: InjuryRow[],
  catalog: CatalogRow[],
) {
  const restricted = injuries
    .flatMap((i) => i.restricted_movements)
    .map((x) => norm(x))
    .filter(Boolean);
  const target = norm(planExercise.muscle_group);
  const diff = difficultyRank(planExercise.difficulty_level);
  const eq = new Set(planExercise.equipment_required.map((x) => norm(x)));

  const candidates = catalog
    .filter((c) => c.id !== planExercise.exercise_id)
    .filter((c) => {
      const t = norm(c.target_muscle);
      const sec = c.secondary_muscles.map((x) => norm(x));
      return t === target || sec.includes(target);
    })
    .filter((c) => difficultyRank(c.difficulty_level) <= diff)
    .filter((c) => {
      const text = `${norm(c.name)} ${c.instructions.map((i) => norm(i)).join(" ")}`;
      return !restricted.some((token) => text.includes(token));
    })
    .map((c) => {
      let score = 0;
      if (norm(c.target_muscle) === target) score += 3;
      if (difficultyRank(c.difficulty_level) === diff) score += 2;
      if (c.equipment_required.map((x) => norm(x)).some((x) => eq.has(x))) score += 1;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.c ?? null;
}

function decideAction(
  planExercise: PlanExerciseRow,
  signal: ExerciseSignal,
  fatigue: FatigueSummary,
  adherence: number,
  injuries: InjuryRow[],
): { action: ProgressionAction; reasons: string[] } {
  const reasons: string[] = [];
  const targetRpe = planExercise.rpe ?? 8;
  const over =
    signal.recentAvgReps !== null &&
    signal.recentAvgReps >= planExercise.reps_max + 1 &&
    (signal.recentAvgRpe === null || signal.recentAvgRpe <= targetRpe - 0.5);
  const under =
    signal.failedSetsRecent >= 2 ||
    (signal.recentAvgReps !== null && signal.recentAvgReps < planExercise.reps_min) ||
    (signal.recentAvgRpe !== null && signal.recentAvgRpe >= targetRpe + 1);

  const severeInjury = injuries.some(
    (i) => i.medical_clearance_required || i.severity >= 4 || i.pain_level >= 8,
  );
  const moderateInjury = injuries.some((i) => i.severity >= 3 || i.pain_level >= 6);

  if (severeInjury) {
    reasons.push("Severe injury signal detected");
    return { action: "substitute", reasons };
  }
  if (fatigue.readinessBand === "red" || fatigue.fatigueScore >= 70 || under || moderateInjury) {
    if (fatigue.fatigueScore >= 75 || fatigue.readinessBand === "red") {
      reasons.push("High fatigue / low readiness");
      if (under) reasons.push("Recent set failures below target");
      return { action: "deload", reasons };
    }
    reasons.push("Performance and recovery suggest reduction");
    if (under) reasons.push("Recent set failures below target");
    return { action: moderateInjury ? "substitute" : "reduce", reasons };
  }
  if (fatigue.readinessBand === "green" && adherence >= 70 && over) {
    reasons.push("Target reps exceeded at manageable RPE");
    reasons.push("Recovery and adherence support progressive overload");
    return { action: "increase", reasons };
  }
  reasons.push("Maintain load to consolidate");
  return { action: "maintain", reasons };
}

function recommendationFromAction(
  planExercise: PlanExerciseRow,
  signal: ExerciseSignal,
  action: ProgressionAction,
  reasons: string[],
  substitution: CatalogRow | null,
  injuries: InjuryRow[],
): ExerciseRecommendation {
  let sets = planExercise.sets;
  let repsMin = planExercise.reps_min;
  let repsMax = planExercise.reps_max;
  let rest = planExercise.rest_seconds;

  if (action === "increase") {
    rest = Math.max(30, rest - 10);
    reasons.push("Slightly reduced rest to preserve density");
  } else if (action === "reduce") {
    sets = Math.max(1, sets - 1);
    repsMax = Math.max(repsMin, repsMax - 1);
    rest += 30;
    reasons.push("Reduced set count and increased rest");
  } else if (action === "deload") {
    sets = Math.max(1, sets - 2);
    repsMin = Math.max(1, repsMin - 1);
    repsMax = Math.max(repsMin, repsMax - 2);
    rest += 60;
    reasons.push("Deload week prescription");
  } else if (action === "substitute") {
    sets = Math.max(1, sets - 1);
    rest += 30;
    reasons.push("Substitution selected for injury-aware programming");
  }

  const targetMid = Math.max(1, Math.round((repsMin + repsMax) / 2));
  const baseWeight =
    signal.latestWorkingWeightKg ??
    (signal.latestE1rm !== null ? signal.latestE1rm / (1 + targetMid / 30) : null);
  let factor = 1;
  if (action === "increase") factor = isLowerBody(planExercise.muscle_group) ? 1.05 : 1.025;
  if (action === "reduce") factor = 0.95;
  if (action === "deload" || action === "substitute") factor = 0.9;

  let weight = baseWeight !== null ? roundToStep(baseWeight * factor, 0.5) : null;
  const cap = injuries
    .map((i) => i.load_cap_percentage)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)[0];
  if (weight !== null && cap !== undefined) {
    weight = Math.min(weight, weight * (cap / 100));
    weight = round(roundToStep(weight, 0.5), 2);
    reasons.push(`Load capped at ${cap}%`);
  } else if (weight !== null) {
    weight = round(weight, 2);
  }

  return {
    exercise_id: substitution?.id ?? planExercise.exercise_id,
    original_exercise_id: planExercise.exercise_id,
    plan_exercise_id: planExercise.id,
    recommended_weight: weight,
    recommended_reps: { min: repsMin, max: repsMax },
    recommended_sets: sets,
    rest_seconds: rest,
    exercise_substitution: substitution?.id ?? null,
    progression_action: action,
    recommendation_reason: reasons,
    metrics: {
      latest_e1rm: signal.latestE1rm,
      weekly_volume_kg: signal.weeklyVolumeKg,
      volume_trend_7d_pct: signal.volumeTrend7dPct,
      strength_rate_pct_week: signal.strengthRatePctWeek,
      recent_avg_reps: signal.recentAvgReps,
      recent_avg_rpe: signal.recentAvgRpe,
      failed_sets_recent: signal.failedSetsRecent,
    },
  };
}

function assertRequest(request: TrainingIntelligenceRequest) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.workoutDate)) {
    throw new Error("workoutDate must be YYYY-MM-DD");
  }
}

export async function getNextWorkoutRecommendations(
  context: EngineContext,
  request: TrainingIntelligenceRequest,
): Promise<TrainingIntelligenceResult> {
  assertRequest(request);

  const analysisDate = parseDateOnly(request.workoutDate);
  const requestedDay = request.dayIndex ?? dayIndex(request.workoutDate);
  const lookback = clamp(request.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 14, 90);
  const lookbackDate = dateKey(daysAgo(analysisDate, lookback));
  const recoveryDate = dateKey(daysAgo(analysisDate, 7));

  const plan = await loadPlan(context, request.planId);
  const day = await loadPlanExercises(context, plan.id, requestedDay);
  if (day.rows.length === 0) {
    return {
      plan_id: plan.id,
      workout_date: request.workoutDate,
      effective_day_index: day.effectiveDayIndex,
      readiness_band: "yellow",
      readiness_score: null,
      fatigue_score: 50,
      adherence_score: 50,
      recommendations: [],
    };
  }

  const exerciseIds = Array.from(
    new Set(day.rows.map((r) => r.exercise_id).filter((x): x is string => Boolean(x))),
  );

  const [logs, prs, recovery, injuries, globalSets, catalog] = await Promise.all([
    loadWorkoutLogs(context, lookbackDate),
    loadPersonalRecords(context, exerciseIds),
    loadRecoveryRows(context, recoveryDate),
    loadActiveInjuries(context),
    loadGlobalSetsForFatigue(context, daysAgo(analysisDate, 28).toISOString()),
    loadCatalog(context, day.rows.map((r) => r.muscle_group)),
  ]);

  const logExercises = await loadLogExercises(
    context,
    logs.map((l) => l.id),
  );
  const targetKeys = new Set(day.rows.map((r) => exerciseKey(r)));
  const relevantLogExercises = logExercises.filter((row) => targetKeys.has(exerciseKey(row)));

  const relevantSets = await loadSetRows(
    context,
    relevantLogExercises.map((r) => r.id),
  );

  const fatigue = fatigueSummary(globalSets, recovery, analysisDate);
  const adherence = adherenceScore(logs, analysisDate);

  const recommendations = day.rows.map((planExercise) => {
    const key = exerciseKey(planExercise);
    const exRows = relevantLogExercises.filter((r) => exerciseKey(r) === key);
    const ids = new Set(exRows.map((r) => r.id));
    const sets = relevantSets.filter((s) => ids.has(s.workout_log_exercise_id));
    const exPrs =
      planExercise.exercise_id !== null
        ? prs.filter((pr) => pr.exercise_id === planExercise.exercise_id)
        : [];
    const signal = computeSignal(planExercise, exRows, sets, exPrs, analysisDate);
    const matchedInjuries = matchInjuries(planExercise, injuries);
    const substitute =
      matchedInjuries.length > 0
        ? pickSubstitute(planExercise, matchedInjuries, catalog)
        : null;
    const decision = decideAction(
      planExercise,
      signal,
      fatigue,
      adherence,
      matchedInjuries,
    );
    return recommendationFromAction(
      planExercise,
      signal,
      decision.action,
      [...decision.reasons],
      substitute,
      matchedInjuries,
    );
  });

  return {
    plan_id: plan.id,
    workout_date: request.workoutDate,
    effective_day_index: day.effectiveDayIndex,
    readiness_band: fatigue.readinessBand,
    readiness_score: fatigue.readinessScore,
    fatigue_score: fatigue.fatigueScore,
    adherence_score: adherence,
    recommendations,
  };
}
