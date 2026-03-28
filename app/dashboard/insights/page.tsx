"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Dumbbell,
  Gauge,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import AICoachCard from "@/components/ai/AICoachCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { CoachInsight } from "@/lib/workout-planner/insightEngine";

type InsightSummaryResponse = {
  coachInsight?: CoachInsight | null;
  requiresPlan?: boolean;
  todayWorkout?: {
    workoutDate: string;
    readinessBand?: string | null;
    readinessScore?: number | null;
    fatigueScore?: number | null;
    previewExercises?: Array<{
      plan_exercise_id: string;
      exercise_name: string;
      muscle_group: string;
      progression_action: string;
      recommended_sets: number;
      recommended_reps: { min: number; max: number };
      recommended_weight: number | null;
      rest_seconds: number;
    }>;
  } | null;
  recoveryStatus?: {
    readiness_score?: number | null;
    fatigue_score?: number | null;
    recommendation?: string | null;
  } | null;
  progressSummary?: {
    weeklyWorkouts: number;
    streakDays: number;
    consistencyScore: number;
    overtrainingRisk?: number | null;
    volumeTrendPct?: number | null;
  } | null;
  trainingLoadState?: {
    acwr?: number | null;
    overtraining_risk?: number | null;
    plateau_risk?: number | null;
    volume_trend_pct?: number | null;
  } | null;
  leaderboardSummary?: {
    rank: number | null;
    tier: string | null;
  } | null;
  error?: string;
};

function formatLoad(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InsightSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard/summary?days=7&recentLimit=6", {
          cache: "no-store",
        });
        const payload = (await response.json()) as InsightSummaryResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load insights");
        }
        if (!cancelled) {
          setSummary(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSummary(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to load insights");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewExercises = summary?.todayWorkout?.previewExercises ?? [];
  const automationItems = summary?.coachInsight?.automationItems ?? [];
  const readinessScore = toNullableNumber(summary?.recoveryStatus?.readiness_score);
  const fatigueScore = toNullableNumber(summary?.recoveryStatus?.fatigue_score);
  const acwr = toNullableNumber(summary?.trainingLoadState?.acwr);
  const weeklyWorkouts = Number(summary?.progressSummary?.weeklyWorkouts ?? 0) || 0;
  const consistency = Number(summary?.progressSummary?.consistencyScore ?? 0) || 0;
  const streakDays = Number(summary?.progressSummary?.streakDays ?? 0) || 0;
  const plateauRisk = toNullableNumber(summary?.trainingLoadState?.plateau_risk);
  const volumeTrendPct = toNullableNumber(summary?.trainingLoadState?.volume_trend_pct);

  const statCards = useMemo(
    () => [
      {
        label: "Readiness",
        value: readinessScore !== null ? `${Math.round(readinessScore)}/100` : "-",
        icon: Gauge,
      },
      {
        label: "Fatigue",
        value: fatigueScore !== null ? `${Math.round(fatigueScore)}/100` : "-",
        icon: ShieldCheck,
      },
      {
        label: "ACWR",
        value: acwr !== null ? formatLoad(acwr) : "-",
        icon: TrendingUp,
      },
      {
        label: "Weekly Workouts",
        value: String(weeklyWorkouts),
        icon: Dumbbell,
      },
    ],
    [acwr, fatigueScore, readinessScore, weeklyWorkouts],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-day-text-primary dark:text-night-text-primary">
          Insights
        </h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
        >
          Back To Dashboard
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
            <Bot className="h-8 w-8 text-day-accent-primary dark:text-night-accent" />
            Insights
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-day-text-secondary dark:text-night-text-secondary">
            See today&apos;s workout guidance and the real recovery signals behind it.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={summary?.requiresPlan ? "/dashboard/workout-planner" : "/dashboard/workout-session"}
            className="inline-flex items-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
          >
            {summary?.requiresPlan ? "Create Plan" : "Start Workout"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/progress"
            className="inline-flex items-center rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
          >
            View Progress
          </Link>
        </div>
      </div>

      <AICoachCard insight={summary?.coachInsight ?? null} requiresPlan={summary?.requiresPlan} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-day-accent-primary/10 p-2 dark:bg-night-accent/10">
                  <Icon className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
                </div>
                <span className="text-lg font-bold text-day-text-primary dark:text-night-text-primary">
                  {card.value}
                </span>
              </div>
              <p className="mt-3 text-sm text-day-text-secondary dark:text-night-text-secondary">
                {card.label}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Today&apos;s Session Preview
              </h2>
              <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                Your next session preview appears here when a plan and recommendation are ready.
              </p>
            </div>
            <Badge variant="primary" size="sm">
              {summary?.todayWorkout?.readinessBand ?? "Ready"}
            </Badge>
          </div>

          {previewExercises.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-day-border px-4 py-5 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
              No exercise preview is available yet. Create a plan or refresh today&apos;s workout to unlock adaptive guidance.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {previewExercises.slice(0, 5).map((exercise) => (
                <div
                  key={exercise.plan_exercise_id}
                  className="rounded-xl border border-day-border px-4 py-3 dark:border-night-border"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                        {exercise.exercise_name}
                      </div>
                      <div className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                        {exercise.recommended_sets} sets x {exercise.recommended_reps.min}-{exercise.recommended_reps.max} reps
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="ghost" size="sm">
                        {exercise.progression_action.replaceAll("_", " ")}
                      </Badge>
                      <div className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                        {exercise.recommended_weight ? `${exercise.recommended_weight} kg` : "Bodyweight"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
            Background Updates
          </h2>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            These updates happen automatically after workouts or recommendation refreshes.
          </p>

          <div className="mt-5 space-y-3">
            {automationItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-day-border px-4 py-5 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                Insight automation items will appear here once today&apos;s guidance is available.
              </div>
            ) : (
              automationItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-day-border px-4 py-4 dark:border-night-border"
                >
                  <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-day-text-secondary dark:text-night-text-secondary">
                    {item.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
            Recovery Summary
          </h2>
          <p className="mt-3 text-sm leading-6 text-day-text-secondary dark:text-night-text-secondary">
            {summary?.recoveryStatus?.recommendation ??
              "Recovery guidance will appear here as your workout and readiness signals accumulate."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Consistency
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {Math.round(consistency)}
              </div>
            </div>
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Streak
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {streakDays}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
            Competitive Snapshot
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Rank
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {summary?.leaderboardSummary?.rank ? `#${summary.leaderboardSummary.rank}` : "-"}
              </div>
            </div>
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Tier
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {summary?.leaderboardSummary?.tier ?? "Unranked"}
              </div>
            </div>
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Plateau Risk
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {plateauRisk !== null ? Math.round(plateauRisk) : "-"}
              </div>
            </div>
            <div className="rounded-xl bg-day-hover px-4 py-3 dark:bg-night-hover">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Volume Trend
              </div>
              <div className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {volumeTrendPct !== null ? `${Math.round(volumeTrendPct)}%` : "-"}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
