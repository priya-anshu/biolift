import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryContext = {
  client: SupabaseClient;
  profileId: string;
};

export type RecoveryStateRow = {
  user_id: string;
  readiness_score: number;
  fatigue_score: number;
  sleep_minutes: number | null;
  hrv: number | null;
  soreness: number | null;
  stress: number | null;
  updated_at: string;
};

const RECOVERY_TABLE_MISSING_CODES = new Set(["42P01", "42703"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
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

function parseDateOnly(dateText: string) {
  return new Date(`${dateText}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(referenceDate: string, days: number) {
  const d = parseDateOnly(referenceDate);
  d.setUTCDate(d.getUTCDate() - days);
  return dateKey(d);
}

function chunk<T>(items: T[], size: number) {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function hrvScore(latestHrv: number | null, baselineHrv: number | null) {
  if (latestHrv === null) return 50;
  if (baselineHrv !== null && baselineHrv > 0) {
    const ratio = latestHrv / baselineHrv;
    return clamp(((ratio - 0.8) / 0.4) * 100, 0, 100);
  }
  return clamp((latestHrv / 80) * 100, 0, 100);
}

function sleepScore(minutes: number | null) {
  if (minutes === null) return 50;
  return clamp(((minutes - 360) / 180) * 100, 0, 100);
}

function computeAcwr(acuteVolume: number, chronicWeeklyAverage: number) {
  if (acuteVolume <= 0 && chronicWeeklyAverage <= 0) return 1;
  if (chronicWeeklyAverage <= 0) return 2;
  return acuteVolume / chronicWeeklyAverage;
}

async function loadTrainingLoadVolume(
  context: RecoveryContext,
  referenceDate: string,
) {
  const fromDate = daysAgo(referenceDate, 35);
  const logsRes = await context.client
    .from("workout_logs")
    .select("id,workout_date,status")
    .eq("user_id", context.profileId)
    .gte("workout_date", fromDate)
    .lte("workout_date", referenceDate)
    .eq("status", "completed");
  if (logsRes.error) throw new Error(logsRes.error.message);

  const logRows = (logsRes.data ?? []) as Array<{
    id: string;
    workout_date: string;
  }>;
  const logDateById = new Map(logRows.map((row) => [String(row.id), row.workout_date]));
  const logIds = Array.from(logDateById.keys());
  if (logIds.length === 0) {
    return {
      acuteVolume: 0,
      chronicWeeklyAverage: 0,
      acwr: 1,
    };
  }

  const exerciseResults = await Promise.all(
    chunk(logIds, 250).map((ids) =>
      context.client
        .from("workout_log_exercises")
        .select("workout_log_id,total_volume_kg")
        .eq("user_id", context.profileId)
        .in("workout_log_id", ids),
    ),
  );

  const acuteStart = daysAgo(referenceDate, 7);
  const chronicStart = daysAgo(referenceDate, 28);
  let acuteVolume = 0;
  let chronicVolume = 0;
  exerciseResults.forEach((res) => {
    if (res.error) throw new Error(res.error.message);
    (res.data ?? []).forEach((row) => {
      const logId = String(row.workout_log_id);
      const workoutDate = logDateById.get(logId);
      if (!workoutDate) return;
      const volume = Math.max(0, toNumber(row.total_volume_kg, 0));
      if (workoutDate >= acuteStart && workoutDate <= referenceDate) {
        acuteVolume += volume;
      }
      if (workoutDate >= chronicStart && workoutDate <= referenceDate) {
        chronicVolume += volume;
      }
    });
  });

  const chronicWeeklyAverage = chronicVolume / 4;
  const acwr = computeAcwr(acuteVolume, chronicWeeklyAverage);
  return {
    acuteVolume: round(acuteVolume, 2),
    chronicWeeklyAverage: round(chronicWeeklyAverage, 2),
    acwr: round(acwr, 3),
  };
}

export async function recomputeRecoveryState(
  context: RecoveryContext,
  input?: { referenceDate?: string },
) {
  const referenceDateRaw = String(input?.referenceDate ?? "").trim();
  const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDateRaw)
    ? referenceDateRaw
    : new Date().toISOString().slice(0, 10);

  const [latestRecoveryRes, historyRecoveryRes, trainingLoad] = await Promise.all([
    context.client
      .from("recovery_metrics")
      .select(
        "sleep_duration_minutes,hrv_rmssd,soreness_level,stress_level,fatigue_score,readiness_score,metric_date",
      )
      .eq("user_id", context.profileId)
      .lte("metric_date", referenceDate)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("recovery_metrics")
      .select("hrv_rmssd,metric_date")
      .eq("user_id", context.profileId)
      .gte("metric_date", daysAgo(referenceDate, 14))
      .lte("metric_date", referenceDate)
      .order("metric_date", { ascending: false })
      .limit(30),
    loadTrainingLoadVolume(context, referenceDate),
  ]);
  if (latestRecoveryRes.error) throw new Error(latestRecoveryRes.error.message);
  if (historyRecoveryRes.error) throw new Error(historyRecoveryRes.error.message);

  const latest = latestRecoveryRes.data;
  const sleepMinutes = toNullableNumber(latest?.sleep_duration_minutes);
  const hrv = toNullableNumber(latest?.hrv_rmssd);
  const soreness = toNullableNumber(latest?.soreness_level);
  const stress = toNullableNumber(latest?.stress_level);

  const baselineHrvValues = (historyRecoveryRes.data ?? [])
    .map((row) => toNullableNumber(row.hrv_rmssd))
    .filter((value): value is number => value !== null);
  const baselineHrv =
    baselineHrvValues.length > 0
      ? baselineHrvValues.reduce((sum, value) => sum + value, 0) /
        baselineHrvValues.length
      : null;

  const sleepComponent = sleepScore(sleepMinutes);
  const hrvComponent = hrvScore(hrv, baselineHrv);
  const sorenessComponent =
    soreness !== null ? clamp(100 - soreness * 10, 0, 100) : 50;
  const stressComponent = stress !== null ? clamp(100 - stress * 10, 0, 100) : 50;
  const loadPenalty =
    trainingLoad.acwr > 1.5 ? 25 : trainingLoad.acwr > 1.3 ? 15 : trainingLoad.acwr < 0.6 ? 10 : 0;
  const loadComponent = clamp(100 - loadPenalty, 0, 100);

  const readinessScore = round(
    clamp(
      sleepComponent * 0.3 +
        hrvComponent * 0.25 +
        sorenessComponent * 0.2 +
        stressComponent * 0.15 +
        loadComponent * 0.1,
      0,
      100,
    ),
    2,
  );

  const dbFatigue = toNullableNumber(latest?.fatigue_score);
  const computedFatigue = clamp(
    (100 - readinessScore) * 0.6 +
      (trainingLoad.acwr > 1 ? (trainingLoad.acwr - 1) * 30 : 0) +
      (soreness ?? 4) * 2 +
      (stress ?? 4) * 1.5,
    0,
    100,
  );
  const fatigueScore = round(
    dbFatigue !== null ? dbFatigue * 0.6 + computedFatigue * 0.4 : computedFatigue,
    2,
  );

  const rowPayload = {
    user_id: context.profileId,
    readiness_score: readinessScore,
    fatigue_score: fatigueScore,
    sleep_minutes: sleepMinutes,
    hrv,
    soreness,
    stress,
    updated_at: new Date().toISOString(),
  };

  const upsertRes = await context.client
    .from("recovery_state")
    .upsert(rowPayload, { onConflict: "user_id" })
    .select(
      "user_id,readiness_score,fatigue_score,sleep_minutes,hrv,soreness,stress,updated_at",
    )
    .maybeSingle();

  if (upsertRes.error) {
    if (RECOVERY_TABLE_MISSING_CODES.has(upsertRes.error.code ?? "")) {
      return null;
    }
    throw new Error(upsertRes.error.message);
  }

  return (upsertRes.data ?? rowPayload) as RecoveryStateRow;
}

export async function getRecoveryState(context: RecoveryContext) {
  const result = await context.client
    .from("recovery_state")
    .select("user_id,readiness_score,fatigue_score,sleep_minutes,hrv,soreness,stress,updated_at")
    .eq("user_id", context.profileId)
    .maybeSingle();
  if (result.error) {
    if (RECOVERY_TABLE_MISSING_CODES.has(result.error.code ?? "")) {
      return null;
    }
    throw new Error(result.error.message);
  }
  return (result.data ?? null) as RecoveryStateRow | null;
}
