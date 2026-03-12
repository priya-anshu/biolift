import type { SupabaseClient } from "@supabase/supabase-js";

type TrainingLoadContext = {
  client: SupabaseClient;
  profileId: string;
};

export type TrainingLoadStateRow = {
  user_id: string;
  acute_load_7d: number;
  chronic_load_28d: number;
  acwr: number;
  fatigue_trend: number;
  plateau_risk: number;
  volume_trend_pct: number;
  overtraining_risk: number;
  optimal_volume_kg: number;
  updated_at: string;
};

const TRAINING_LOAD_TABLE_MISSING_CODES = new Set(["42P01", "42703"]);

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

function weekStartDateKey(referenceDate: string) {
  const date = parseDateOnly(referenceDate);
  const utcDay = date.getUTCDay();
  const offset = utcDay === 0 ? -6 : 1 - utcDay;
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
}

function chunk<T>(items: T[], size: number) {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function estimated1rm(weightKg: number, reps: number) {
  return weightKg * (1 + Math.min(reps, 10) / 30);
}

function computeAcwr(acuteLoad7d: number, chronicLoad28d: number) {
  if (acuteLoad7d <= 0 && chronicLoad28d <= 0) return 1;
  if (chronicLoad28d <= 0) return 2;
  return acuteLoad7d / chronicLoad28d;
}

async function loadWeeklyVolumeFromExerciseStats(
  context: TrainingLoadContext,
  referenceDate: string,
) {
  const startWeek = weekStartDateKey(daysAgo(referenceDate, 35));
  const result = await context.client
    .from("exercise_volume_stats")
    .select("week_start_date,weekly_volume_kg")
    .eq("user_id", context.profileId)
    .gte("week_start_date", startWeek)
    .lte("week_start_date", weekStartDateKey(referenceDate))
    .order("week_start_date", { ascending: false })
    .limit(4000);
  if (result.error) {
    if (TRAINING_LOAD_TABLE_MISSING_CODES.has(result.error.code ?? "")) {
      return new Map<string, number>();
    }
    throw new Error(result.error.message);
  }

  const weekly = new Map<string, number>();
  (result.data ?? []).forEach((row) => {
    const key = String(row.week_start_date ?? "");
    if (!key) return;
    const current = weekly.get(key) ?? 0;
    weekly.set(key, current + Math.max(0, toNumber(row.weekly_volume_kg, 0)));
  });
  return weekly;
}

async function loadVolumeSignals(
  context: TrainingLoadContext,
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

  const logs = (logsRes.data ?? []) as Array<{
    id: string;
    workout_date: string;
  }>;
  const dateByLogId = new Map(logs.map((row) => [String(row.id), row.workout_date]));
  const logIds = Array.from(dateByLogId.keys());

  let acuteLoad7d = 0;
  let chronicTotal28d = 0;
  let lastWeekVolume = 0;
  let previousWeekVolume = 0;

  const acuteFrom = daysAgo(referenceDate, 7);
  const previousFrom = daysAgo(referenceDate, 14);
  const chronicFrom = daysAgo(referenceDate, 28);

  if (logIds.length > 0) {
    const volumeChunks = await Promise.all(
      chunk(logIds, 250).map((ids) =>
        context.client
          .from("workout_log_exercises")
          .select("workout_log_id,total_volume_kg")
          .eq("user_id", context.profileId)
          .in("workout_log_id", ids),
      ),
    );
    volumeChunks.forEach((res) => {
      if (res.error) throw new Error(res.error.message);
      (res.data ?? []).forEach((row) => {
        const logId = String(row.workout_log_id);
        const workoutDate = dateByLogId.get(logId);
        if (!workoutDate) return;
        const volume = Math.max(0, toNumber(row.total_volume_kg, 0));
        if (workoutDate >= acuteFrom && workoutDate <= referenceDate) {
          acuteLoad7d += volume;
          lastWeekVolume += volume;
        }
        if (workoutDate >= previousFrom && workoutDate < acuteFrom) {
          previousWeekVolume += volume;
        }
        if (workoutDate >= chronicFrom && workoutDate <= referenceDate) {
          chronicTotal28d += volume;
        }
      });
    });
  }

  let chronicLoad28d = chronicTotal28d / 4;

  if (chronicLoad28d <= 0) {
    const weeklyFromStats = await loadWeeklyVolumeFromExerciseStats(
      context,
      referenceDate,
    );
    if (weeklyFromStats.size > 0) {
      const weeks = Array.from(weeklyFromStats.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-4)
        .map((entry) => entry[1]);
      const total = weeks.reduce((sum, value) => sum + value, 0);
      chronicLoad28d = weeks.length > 0 ? total / weeks.length : 0;

      const currentWeek = weekStartDateKey(referenceDate);
      const previousWeek = weekStartDateKey(daysAgo(referenceDate, 7));
      lastWeekVolume = weeklyFromStats.get(currentWeek) ?? lastWeekVolume;
      previousWeekVolume = weeklyFromStats.get(previousWeek) ?? previousWeekVolume;
      if (acuteLoad7d <= 0) acuteLoad7d = lastWeekVolume;
    }
  }

  const acwr = computeAcwr(acuteLoad7d, chronicLoad28d);
  const volumeTrendPct =
    previousWeekVolume > 0
      ? ((lastWeekVolume - previousWeekVolume) / previousWeekVolume) * 100
      : lastWeekVolume > 0
        ? 100
        : 0;

  return {
    acuteLoad7d: round(acuteLoad7d, 2),
    chronicLoad28d: round(chronicLoad28d, 2),
    acwr: round(acwr, 3),
    volumeTrendPct: round(volumeTrendPct, 2),
  };
}

async function loadPlateauRisk(
  context: TrainingLoadContext,
  referenceDate: string,
) {
  const performedFromIso = `${daysAgo(referenceDate, 28)}T00:00:00.000Z`;
  const performedToIso = `${referenceDate}T23:59:59.999Z`;

  const setsRes = await context.client
    .from("workout_log_sets")
    .select("actual_reps,actual_weight_kg,set_status,performed_at")
    .eq("user_id", context.profileId)
    .eq("set_status", "completed")
    .gte("performed_at", performedFromIso)
    .lte("performed_at", performedToIso)
    .order("performed_at", { ascending: false })
    .limit(6000);
  if (setsRes.error) throw new Error(setsRes.error.message);

  const sets = (setsRes.data ?? []) as Array<{
    actual_reps: number | null;
    actual_weight_kg: number | null;
    performed_at: string | null;
  }>;
  if (sets.length === 0) {
    return {
      plateauRisk: 35,
      strengthTrendPct: null as number | null,
    };
  }

  const recentFrom = `${daysAgo(referenceDate, 7)}T00:00:00.000Z`;
  const baselineFrom = `${daysAgo(referenceDate, 21)}T00:00:00.000Z`;
  const baselineTo = recentFrom;

  const recentE1rm: number[] = [];
  const baselineE1rm: number[] = [];

  sets.forEach((row) => {
    const reps = Math.max(0, toNumber(row.actual_reps, 0));
    const weight = Math.max(0, toNumber(row.actual_weight_kg, 0));
    if (reps < 1 || weight <= 0 || !row.performed_at) return;
    const e1rm = estimated1rm(weight, reps);
    if (row.performed_at >= recentFrom && row.performed_at <= performedToIso) {
      recentE1rm.push(e1rm);
    } else if (row.performed_at >= baselineFrom && row.performed_at < baselineTo) {
      baselineE1rm.push(e1rm);
    }
  });

  if (recentE1rm.length === 0 || baselineE1rm.length === 0) {
    return {
      plateauRisk: 40,
      strengthTrendPct: null as number | null,
    };
  }

  const recentBest = Math.max(...recentE1rm);
  const baselineBest = Math.max(...baselineE1rm);
  const strengthTrendPct =
    baselineBest > 0 ? ((recentBest - baselineBest) / baselineBest) * 100 : 0;

  let plateauRisk = 20;
  if (strengthTrendPct < -2) plateauRisk = 90;
  else if (strengthTrendPct < 0.5) plateauRisk = 80;
  else if (strengthTrendPct < 1) plateauRisk = 70;
  else if (strengthTrendPct < 2) plateauRisk = 45;

  return {
    plateauRisk,
    strengthTrendPct: round(strengthTrendPct, 2),
  };
}

async function loadFatigueTrendSignals(
  context: TrainingLoadContext,
  referenceDate: string,
) {
  const fromDate = daysAgo(referenceDate, 14);
  const statsRes = await context.client
    .from("user_training_stats")
    .select("snapshot_date,fatigue_score,weekly_volume_kg")
    .eq("user_id", context.profileId)
    .gte("snapshot_date", fromDate)
    .lte("snapshot_date", referenceDate)
    .order("snapshot_date", { ascending: false })
    .limit(10);
  if (statsRes.error) {
    if (TRAINING_LOAD_TABLE_MISSING_CODES.has(statsRes.error.code ?? "")) {
      return {
        fatigueDelta: 0,
        latestWeeklyVolume: null as number | null,
      };
    }
    throw new Error(statsRes.error.message);
  }

  const rows = (statsRes.data ?? []) as Array<{
    snapshot_date: string;
    fatigue_score: number | null;
    weekly_volume_kg: number | null;
  }>;

  const fatigueValues = rows
    .map((row) => toNullableNumber(row.fatigue_score))
    .filter((value): value is number => value !== null);
  const latestFatigue = fatigueValues[0] ?? null;
  const previousFatigueAvg =
    fatigueValues.length > 1
      ? fatigueValues.slice(1).reduce((sum, value) => sum + value, 0) /
        (fatigueValues.length - 1)
      : latestFatigue;
  const fatigueDelta =
    latestFatigue !== null && previousFatigueAvg !== null
      ? latestFatigue - previousFatigueAvg
      : 0;

  const latestWeeklyVolume =
    toNullableNumber(rows[0]?.weekly_volume_kg) ??
    toNullableNumber(rows.find((row) => row.weekly_volume_kg !== null)?.weekly_volume_kg);

  return {
    fatigueDelta: round(fatigueDelta, 2),
    latestWeeklyVolume,
  };
}

function acwrZone(acwr: number) {
  if (acwr < 0.8) return "detraining";
  if (acwr <= 1.3) return "optimal";
  if (acwr <= 1.6) return "fatigue";
  return "overtraining";
}

function computeOvertrainingRisk(acwr: number, fatigueTrend: number) {
  const zone = acwrZone(acwr);
  const zoneBase =
    zone === "detraining" ? 20 : zone === "optimal" ? 35 : zone === "fatigue" ? 70 : 90;
  const blended = clamp(zoneBase * 0.6 + fatigueTrend * 0.4, 0, 100);
  if (zone === "overtraining") return Math.max(85, blended);
  return blended;
}

export async function recomputeTrainingLoadState(
  context: TrainingLoadContext,
  input?: { referenceDate?: string },
) {
  const referenceDateRaw = String(input?.referenceDate ?? "").trim();
  const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDateRaw)
    ? referenceDateRaw
    : new Date().toISOString().slice(0, 10);

  const [volumeSignals, plateauSignals, fatigueSignals] = await Promise.all([
    loadVolumeSignals(context, referenceDate),
    loadPlateauRisk(context, referenceDate),
    loadFatigueTrendSignals(context, referenceDate),
  ]);

  const acwrPenalty =
    volumeSignals.acwr > 1.4
      ? clamp((volumeSignals.acwr - 1.4) * 60, 0, 30)
      : volumeSignals.acwr < 0.8
        ? clamp((0.8 - volumeSignals.acwr) * 35, 0, 20)
        : 0;
  const fatigueTrend = round(
    clamp(50 + fatigueSignals.fatigueDelta * 5 + acwrPenalty, 0, 100),
    2,
  );

  const overtrainingRisk = round(
    computeOvertrainingRisk(volumeSignals.acwr, fatigueTrend),
    2,
  );

  const baselineVolume =
    volumeSignals.chronicLoad28d > 0
      ? volumeSignals.chronicLoad28d
      : volumeSignals.acuteLoad7d > 0
        ? volumeSignals.acuteLoad7d
        : Math.max(0, toNumber(fatigueSignals.latestWeeklyVolume, 0));

  let optimalVolumeKg = baselineVolume;
  const plateauHigh = plateauSignals.plateauRisk >= 70;
  const fatigueHigh = fatigueTrend >= 70 || overtrainingRisk >= 70;
  if (fatigueHigh) {
    optimalVolumeKg = baselineVolume * 0.8;
  } else if (plateauHigh) {
    optimalVolumeKg = baselineVolume * 1.1;
  }
  optimalVolumeKg = round(Math.max(0, optimalVolumeKg), 2);

  const payload = {
    user_id: context.profileId,
    acute_load_7d: volumeSignals.acuteLoad7d,
    chronic_load_28d: volumeSignals.chronicLoad28d,
    acwr: volumeSignals.acwr,
    fatigue_trend: fatigueTrend,
    plateau_risk: round(plateauSignals.plateauRisk, 2),
    volume_trend_pct: volumeSignals.volumeTrendPct,
    overtraining_risk: overtrainingRisk,
    optimal_volume_kg: optimalVolumeKg,
    updated_at: new Date().toISOString(),
  };

  const upsertRes = await context.client
    .from("training_load_state")
    .upsert(payload, { onConflict: "user_id" })
    .select(
      "user_id,acute_load_7d,chronic_load_28d,acwr,fatigue_trend,plateau_risk,volume_trend_pct,overtraining_risk,optimal_volume_kg,updated_at",
    )
    .maybeSingle();

  if (upsertRes.error) {
    if (TRAINING_LOAD_TABLE_MISSING_CODES.has(upsertRes.error.code ?? "")) {
      return null;
    }
    throw new Error(upsertRes.error.message);
  }

  return (upsertRes.data ?? payload) as TrainingLoadStateRow;
}

export async function getTrainingLoadState(context: TrainingLoadContext) {
  const res = await context.client
    .from("training_load_state")
    .select(
      "user_id,acute_load_7d,chronic_load_28d,acwr,fatigue_trend,plateau_risk,volume_trend_pct,overtraining_risk,optimal_volume_kg,updated_at",
    )
    .eq("user_id", context.profileId)
    .maybeSingle();
  if (res.error) {
    if (TRAINING_LOAD_TABLE_MISSING_CODES.has(res.error.code ?? "")) {
      return null;
    }
    throw new Error(res.error.message);
  }
  return (res.data ?? null) as TrainingLoadStateRow | null;
}
