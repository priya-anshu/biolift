import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { buildCoachInsight } from "@/lib/workout-planner/insightEngine";
import {
  getDashboardSummary,
  refreshLeaderboardForUser,
  getWorkoutRecommendations,
  isNoWorkoutPlanError,
} from "@/lib/workout-planner/service";
import { scheduleAiJob } from "@/lib/workout-planner/workerQueue";

function parseDays(value: string | null) {
  if (!value) return 7;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(1, Math.min(60, Math.floor(parsed)));
}

function parseLimit(value: string | null) {
  if (!value) return 6;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildDedupeKey(
  profileId: string,
  input: {
    workoutDate: string;
    planId?: string;
    dayIndex?: number;
    lookbackDays?: number;
  },
) {
  return [
    "recommendation_refresh",
    profileId,
    input.planId ?? "active",
    input.workoutDate,
    String(input.dayIndex ?? "auto"),
    String(input.lookbackDays ?? 42),
  ].join(":");
}

function buildRecoveryRecommendation(
  recovery: {
    readiness_score?: number | null;
    fatigue_score?: number | null;
  } | null,
  trainingLoad: {
    overtraining_risk?: number | null;
    plateau_risk?: number | null;
    acwr?: number | null;
  } | null,
) {
  const readiness = toNullableNumber(recovery?.readiness_score);
  const fatigue = toNullableNumber(recovery?.fatigue_score);
  const overtraining = toNullableNumber(trainingLoad?.overtraining_risk);
  const plateau = toNullableNumber(trainingLoad?.plateau_risk);
  const acwr = toNullableNumber(trainingLoad?.acwr);

  if (readiness === null && fatigue === null && overtraining === null && plateau === null && acwr === null) {
    return "Recovery guidance will appear after a few logged workouts or recovery check-ins.";
  }

  if ((readiness !== null && readiness < 30) || (overtraining !== null && overtraining >= 80) || (acwr !== null && acwr > 1.6)) {
    return "High recovery demand today. Keep intensity low and prioritize mobility work.";
  }
  if ((readiness !== null && readiness < 40) || (fatigue !== null && fatigue >= 70) || (overtraining !== null && overtraining >= 65)) {
    return "Moderate fatigue detected. Stay technical and keep a conservative effort cap.";
  }
  if (plateau !== null && plateau >= 70 && readiness !== null && readiness >= 55) {
    return "Performance plateau detected. A small overload step is recommended.";
  }
  return "Recovery signals are stable. Follow your planned workload and progress gradually.";
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "dashboard-summary",
      limit: 120,
      windowSeconds: 60,
    });

    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const recentLimit = parseLimit(request.nextUrl.searchParams.get("recentLimit"));
    const workoutDate = new Date().toISOString().slice(0, 10);
    const lookbackDays = 42;

    const [summary, recoveryRes, trainingLoadRes, leaderboardRes] = await Promise.all([
      getDashboardSummary(
        { client: api.client, profileId: api.current.profileId },
        {
          days,
          recentLimit,
          includeMotivation: false,
          language: api.current.preferredLanguage,
        },
      ),
      api.client
        .from("recovery_state")
        .select("readiness_score,fatigue_score,sleep_minutes,hrv,soreness,stress,updated_at")
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
      api.client
        .from("training_load_state")
        .select(
          "acwr,acute_load_7d,chronic_load_28d,fatigue_trend,plateau_risk,volume_trend_pct,overtraining_risk,optimal_volume_kg,updated_at",
        )
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
      api.client
        .from("leaderboard")
        .select("position,total_score,tier,updated_at,activity_days_14d,streak_days")
        .eq("user_id", api.current.profileId)
        .maybeSingle(),
    ]);

    if (
      recoveryRes.error &&
      recoveryRes.error.code !== "42P01" &&
      recoveryRes.error.code !== "42703"
    ) {
      throw new Error(recoveryRes.error.message);
    }
    if (
      trainingLoadRes.error &&
      trainingLoadRes.error.code !== "42P01" &&
      trainingLoadRes.error.code !== "42703"
    ) {
      throw new Error(trainingLoadRes.error.message);
    }
    if (leaderboardRes.error) {
      throw new Error(leaderboardRes.error.message);
    }

    let recommendationRead:
      | Awaited<
          ReturnType<
            typeof getWorkoutRecommendations
          >
        >
      | null = null;
    let requiresPlan = false;
    try {
      recommendationRead = await getWorkoutRecommendations(
        { client: api.client, profileId: api.current.profileId },
        {
          workoutDate,
          lookbackDays,
        },
      );
    } catch (recommendationError) {
      if (isNoWorkoutPlanError(recommendationError)) {
        requiresPlan = true;
      } else {
        throw recommendationError;
      }
    }

    if (recommendationRead) {
      const shouldEnqueue =
        recommendationRead.cacheState !== "exact" || recommendationRead.cacheTtl.isStale;
      if (shouldEnqueue) {
        await scheduleAiJob(api.adminClient, {
          scope: "dashboard.summary.refresh",
          swallowErrors: true,
          userId: api.current.profileId,
          jobType: "recommendation_refresh",
          payload: {
            workoutDate,
            lookbackDays,
          },
          dedupeKey: buildDedupeKey(api.current.profileId, {
            workoutDate,
            lookbackDays,
          }),
        });
      }
    }

    let previewExercises: Array<{
      plan_exercise_id: string;
      exercise_id: string | null;
      exercise_name: string;
      muscle_group: string;
      exercise_order: number;
      recommended_sets: number;
      recommended_reps: { min: number; max: number };
      recommended_weight: number | null;
      rest_seconds: number;
      progression_action: string;
      recommendation_reason: string[];
    }> = [];
    if (recommendationRead) {
      const recommendationRows = recommendationRead.recommendations.recommendations;
      const planExerciseIds = Array.from(
        new Set(recommendationRows.map((row) => row.plan_exercise_id)),
      );
      const planExerciseRes =
        planExerciseIds.length > 0
          ? await api.client
              .from("workout_plan_exercises")
              .select("id,exercise_name,muscle_group,exercise_order")
              .in("id", planExerciseIds)
          : { data: [], error: null };
      if (planExerciseRes.error) {
        throw new Error(planExerciseRes.error.message);
      }
      const byPlanExerciseId = new Map(
        (planExerciseRes.data ?? []).map((row) => [
          String(row.id),
          {
            exercise_name: String(row.exercise_name ?? "Exercise"),
            muscle_group: String(row.muscle_group ?? "general"),
            exercise_order: Number(row.exercise_order ?? 1),
          },
        ]),
      );
      previewExercises = recommendationRows
        .map((row) => {
          const details = byPlanExerciseId.get(row.plan_exercise_id);
          return {
            plan_exercise_id: row.plan_exercise_id,
            exercise_id: row.exercise_id,
            exercise_name: details?.exercise_name ?? "Exercise",
            muscle_group: details?.muscle_group ?? "general",
            exercise_order: details?.exercise_order ?? 1,
            recommended_sets: row.recommended_sets,
            recommended_reps: row.recommended_reps,
            recommended_weight: row.recommended_weight,
            rest_seconds: row.rest_seconds,
            progression_action: row.progression_action,
            recommendation_reason: row.recommendation_reason,
          };
        })
        .sort((a, b) => a.exercise_order - b.exercise_order);
    }

    const trainingStats = (summary as { trainingStats?: Record<string, unknown> }).trainingStats;
    const trainingLoad = trainingLoadRes.error ? null : trainingLoadRes.data ?? null;
    const recovery = recoveryRes.error ? null : recoveryRes.data ?? null;
    let leaderboard = leaderboardRes.data ?? null;
    if (!leaderboard) {
      leaderboard = await refreshLeaderboardForUser({
        client: api.adminClient,
        profileId: api.current.profileId,
      });
    }
    let leaderboardRank =
      leaderboard && Number(leaderboard.position ?? 0) > 0
        ? Number(leaderboard.position)
        : null;
    if (leaderboard && leaderboardRank === null) {
      const higherScoreRes = await api.adminClient
        .from("leaderboard")
        .select("id", { head: true, count: "exact" })
        .gt("total_score", Number(leaderboard.total_score ?? 0));
      if (higherScoreRes.error) {
        throw new Error(higherScoreRes.error.message);
      }
      leaderboardRank = Number(higherScoreRes.count ?? 0) + 1;
    }
    const coachInsight = buildCoachInsight({
      requiresPlan,
      recommendations: recommendationRead?.recommendations.recommendations ?? [],
      recovery,
      trainingLoad,
      trainingStats: {
        workouts_completed_7d: Number(trainingStats?.workouts_completed_7d ?? 0) || 0,
        consistency_score: Number(trainingStats?.consistency_score ?? 0) || 0,
        streak_days: Number(trainingStats?.streak_days ?? 0) || 0,
      },
      previewExercises,
      cacheState: recommendationRead?.cacheState ?? "baseline",
      cacheTtl: recommendationRead?.cacheTtl ?? null,
    });

    return NextResponse.json({
      ...summary,
      coachInsight,
      requiresPlan,
      todayWorkout: {
        workoutDate,
        cacheState: recommendationRead?.cacheState ?? "baseline",
        cacheTtl: recommendationRead?.cacheTtl ?? null,
        planId: recommendationRead?.recommendations.plan_id ?? null,
        readinessBand: recommendationRead?.recommendations.readiness_band ?? "yellow",
        readinessScore: recommendationRead?.recommendations.readiness_score ?? null,
        fatigueScore: recommendationRead?.recommendations.fatigue_score ?? null,
        previewExercises,
      },
      recoveryStatus: {
        ...recovery,
        recommendation: buildRecoveryRecommendation(recovery, trainingLoad),
      },
      progressSummary: {
        weeklyWorkouts:
          Number(trainingStats?.workouts_completed_7d ?? summary.metrics.workoutsThisPeriod) || 0,
        streakDays: Number(trainingStats?.streak_days ?? leaderboard?.streak_days ?? 0) || 0,
        weeklyVolumeKg: Number(trainingStats?.weekly_volume_kg ?? 0) || 0,
        consistencyScore: Number(trainingStats?.consistency_score ?? 0) || 0,
        volumeTrendPct: Number(trainingLoad?.volume_trend_pct ?? 0) || 0,
      },
      leaderboardSummary: leaderboard
        ? {
            rank: leaderboardRank,
            tier: leaderboard.tier,
            totalScore: leaderboard.total_score,
            activityDays14d: leaderboard.activity_days_14d,
            streakDays: leaderboard.streak_days,
            updatedAt: leaderboard.updated_at,
          }
        : null,
      trainingLoadState: trainingLoad,
      trainingStats,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load dashboard summary", {
      scope: "dashboard.summary",
    });
  }
}
