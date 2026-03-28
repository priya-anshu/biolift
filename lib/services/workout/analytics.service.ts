import type { ServiceContext } from "./types";
import { getMotivationSnapshot } from "./execution.service";
import { clampIntValue, parseNumeric, toIsoDateOnly, daysAgoDate, computeDateStreak, tierForScore } from "./utils";

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

async function getComputedLeaderboardPosition(
  context: ServiceContext,
  totalScore: number,
) {
  const higherScoreRes = await context.client
    .from("leaderboard")
    .select("id", { head: true, count: "exact" })
    .gt("total_score", totalScore);
  if (higherScoreRes.error) throw new Error(higherScoreRes.error.message);
  return Number(higherScoreRes.count ?? 0) + 1;
}

export async function getRankingOverview(context: ServiceContext) {
  const refreshedEntry = await refreshLeaderboardForUser(context);
  const leaderboardRes = await context.client
    .from("leaderboard")
    .select(
      "id,user_id,total_score,strength_score,stamina_score,consistency_score,improvement_score,tier,position,activity_days_14d,streak_days,updated_at,profiles(name,avatar_url)",
    )
    .order("total_score", { ascending: false })
    .order("consistency_score", { ascending: false })
    .order("improvement_score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);
  if (leaderboardRes.error) throw new Error(leaderboardRes.error.message);

  const normalized: Array<Record<string, unknown>> = (
    (leaderboardRes.data ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => {
      const profileRaw = row.profiles;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      return {
        ...row,
        profiles: profile ?? null,
      };
    })
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }));

  const leaderboardEntry =
    normalized.find((row) => String(row.user_id) === context.profileId) ?? null;
  const fallbackPosition = await getComputedLeaderboardPosition(
    context,
    parseNumeric(refreshedEntry.total_score, 0),
  );
  const myEntry = leaderboardEntry
    ? ({
        ...leaderboardEntry,
        position:
          Number(leaderboardEntry.position ?? 0) > 0
            ? leaderboardEntry.position
            : fallbackPosition,
      } as Record<string, unknown>)
    : ({
        ...refreshedEntry,
        position: fallbackPosition,
        profiles: null,
      } as Record<string, unknown>);

  return {
    profileId: context.profileId,
    leaderboard: normalized,
    myEntry,
    activityDays: Number(myEntry?.activity_days_14d ?? 0),
    streakDays: Number(myEntry?.streak_days ?? 0),
  };
}
