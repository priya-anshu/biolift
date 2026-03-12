"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Medal, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AICoachCard from "@/components/ai/AICoachCard";
import RecoveryStatusCard from "@/components/recovery/RecoveryStatusCard";
import TrainingLoadMeter from "@/components/training/TrainingLoadMeter";
import ConsistencyTracker from "@/components/training/ConsistencyTracker";
import { useAuth } from "@/lib/auth/AuthContext";

type ProgressionAction = "increase" | "maintain" | "reduce" | "deload" | "substitute";

type DashboardSummaryResponse = {
  requiresPlan?: boolean;
  metrics: {
    workoutsThisPeriod: number;
    caloriesBurned: number;
    activeMinutes: number;
  };
  trainingStats?: {
    workouts_completed_7d?: number | null;
    consistency_score?: number | null;
    streak_days?: number | null;
    weekly_volume_kg?: number | null;
  } | null;
  recentActivity: Array<{
    id: string;
    name: string;
    type: string | null;
    duration_minutes: number | null;
    calories: number | null;
    performed_at: string;
    status?: string;
  }>;
  todayWorkout?: {
    workoutDate: string;
    cacheState: string;
    planId: string | null;
    readinessBand: string;
    readinessScore: number | null;
    fatigueScore: number;
    previewExercises: Array<{
      plan_exercise_id: string;
      exercise_name: string;
      muscle_group: string;
      exercise_order: number;
      recommended_sets: number;
      recommended_reps: { min: number; max: number };
      recommended_weight: number | null;
      rest_seconds: number;
      progression_action: ProgressionAction;
      recommendation_reason: string[];
    }>;
  };
  recoveryStatus?: {
    readiness_score?: number | null;
    fatigue_score?: number | null;
    sleep_minutes?: number | null;
    soreness?: number | null;
    stress?: number | null;
    recommendation?: string;
  } | null;
  progressSummary?: {
    weeklyWorkouts: number;
    streakDays: number;
    weeklyVolumeKg: number;
    consistencyScore: number;
    volumeTrendPct: number;
  } | null;
  leaderboardSummary?: {
    rank: number | null;
    tier: string | null;
    totalScore: number | null;
  } | null;
  trainingLoadState?: {
    acwr?: number | null;
    acute_load_7d?: number | null;
    chronic_load_28d?: number | null;
    overtraining_risk?: number | null;
    plateau_risk?: number | null;
    volume_trend_pct?: number | null;
  } | null;
  error?: string;
};

function actionClass(action: ProgressionAction) {
  if (action === "increase") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (action === "maintain") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  }
  if (action === "reduce") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (action === "deload") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  }
  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
}

function actionLabel(action: ProgressionAction) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);

  const [recoveryForm, setRecoveryForm] = useState({
    sleepHours: "7.5",
    soreness: "3",
    stress: "3",
    energy: "7",
  });
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const [injuryForm, setInjuryForm] = useState({
    bodyRegion: "",
    painLevel: "3",
    severity: "2",
  });
  const [injurySaving, setInjurySaving] = useState(false);
  const [injuryMessage, setInjuryMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/summary?days=7&recentLimit=5", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardSummaryResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load dashboard");
      }
      setSummary(payload);
    } catch (loadError) {
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const displayName = useMemo(() => {
    const metadata = user?.user_metadata as
      | { full_name?: string; name?: string; user_name?: string }
      | undefined;
    return (
      metadata?.full_name ||
      metadata?.name ||
      metadata?.user_name ||
      user?.email?.split("@")[0] ||
      "Athlete"
    );
  }, [user]);

  const todayExercises = summary?.todayWorkout?.previewExercises ?? [];
  const requiresPlan = Boolean(summary?.requiresPlan);
  const recovery = summary?.recoveryStatus ?? null;
  const progress = summary?.progressSummary ?? null;
  const leaderboard = summary?.leaderboardSummary ?? null;
  const trainingLoad = summary?.trainingLoadState ?? null;
  const trainingStats = summary?.trainingStats ?? null;

  const submitRecovery = async () => {
    setRecoverySaving(true);
    setRecoveryMessage(null);
    try {
      const sleepHours = Number(recoveryForm.sleepHours);
      const response = await fetch("/api/recovery-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricDate: new Date().toISOString().slice(0, 10),
          sleepDurationMinutes: Number.isFinite(sleepHours)
            ? Math.max(0, Math.round(sleepHours * 60))
            : null,
          sorenessLevel: Number(recoveryForm.soreness),
          stressLevel: Number(recoveryForm.stress),
          energyLevel: Number(recoveryForm.energy),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save recovery metrics");
      }
      setRecoveryMessage("Recovery metrics saved.");
      await load();
    } catch (saveError) {
      setRecoveryMessage(
        saveError instanceof Error ? saveError.message : "Failed to save recovery metrics",
      );
    } finally {
      setRecoverySaving(false);
    }
  };

  const submitInjury = async () => {
    if (!injuryForm.bodyRegion.trim()) {
      setInjuryMessage("Body region is required.");
      return;
    }

    setInjurySaving(true);
    setInjuryMessage(null);
    try {
      const response = await fetch("/api/injury-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyRegion: injuryForm.bodyRegion.trim(),
          painLevel: Number(injuryForm.painLevel),
          severity: Number(injuryForm.severity),
          injuryType: "other",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to report injury");
      }
      setInjuryMessage("Injury flag recorded.");
      setInjuryForm((current) => ({ ...current, bodyRegion: "" }));
    } catch (saveError) {
      setInjuryMessage(
        saveError instanceof Error ? saveError.message : "Failed to report injury",
      );
    } finally {
      setInjurySaving(false);
    }
  };

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <section>
        <h1 className="text-2xl font-semibold">Welcome back, {displayName}</h1>
        <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
          {requiresPlan
            ? "Generate your first plan to start smart workout sessions."
            : "Dashboard to session is now one flow: start workout, log sets, finish, AI adapts."}
        </p>
      </section>

      {error ? (
        <Card className="p-5">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
          >
            Retry
          </button>
        </Card>
      ) : null}

      <AICoachCard
        requiresPlan={requiresPlan}
        recommendations={todayExercises}
        recovery={recovery}
        trainingLoad={trainingLoad}
        trainingStats={trainingStats}
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
              Today&apos;s Workout
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {todayExercises.length > 0
                ? `${todayExercises.length} planned exercises`
                : "No planned exercises yet"}
            </h2>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Warmup - Main exercises - Cooldown
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {requiresPlan ? null : (
              <Link
                href="/dashboard/workout-session"
                className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
              >
                Start Workout
              </Link>
            )}
            <Link
              href="/dashboard/workout-planner"
              className="rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
            >
              {requiresPlan ? "Generate Your First Workout Plan" : "View Full Workout"}
            </Link>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-12 rounded-lg" />
              <div className="skeleton h-12 rounded-lg" />
              <div className="skeleton h-12 rounded-lg" />
            </div>
          ) : requiresPlan ? (
            <div className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary">
              Generate your first workout plan to unlock today&apos;s session.
            </div>
          ) : todayExercises.length === 0 ? (
            <div className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary">
              Baseline plan will appear after your first generated workout.
            </div>
          ) : (
            todayExercises.slice(0, 5).map((exercise) => (
              <div
                key={exercise.plan_exercise_id}
                className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 dark:border-night-border dark:bg-night-hover/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{exercise.exercise_name}</p>
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {exercise.recommended_sets} sets x {exercise.recommended_reps.min}-
                      {exercise.recommended_reps.max} reps {" | "}
                      {exercise.recommended_weight === null
                        ? "Auto load"
                        : `${exercise.recommended_weight} kg`}
                      {" | Rest "}
                      {exercise.rest_seconds}s
                    </p>
                  </div>
                  <Badge className={actionClass(exercise.progression_action)} variant="ghost" size="sm">
                    {actionLabel(exercise.progression_action)}
                  </Badge>
                </div>
                {exercise.recommendation_reason.length > 0 ? (
                  <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                    AI: {exercise.recommendation_reason[0]}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <RecoveryStatusCard recovery={recovery} />
        <TrainingLoadMeter loadState={trainingLoad} />
        <ConsistencyTracker
          weeklyWorkouts={
            progress?.weeklyWorkouts ??
            Number(trainingStats?.workouts_completed_7d ?? summary?.metrics.workoutsThisPeriod ?? 0)
          }
          streakDays={progress?.streakDays ?? Number(trainingStats?.streak_days ?? 0)}
          consistencyScore={
            progress?.consistencyScore ?? Number(trainingStats?.consistency_score ?? 0)
          }
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-sky-500" />
            Workouts This Week
          </div>
          <p className="mt-2 text-xl font-semibold">{summary?.metrics.workoutsThisPeriod ?? 0}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-orange-500" />
            Calories This Week
          </div>
          <p className="mt-2 text-xl font-semibold">
            {Math.round(summary?.metrics.caloriesBurned ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-blue-500" />
            Active Minutes
          </div>
          <p className="mt-2 text-xl font-semibold">
            {Math.round(summary?.metrics.activeMinutes ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Medal className="h-4 w-4 text-violet-500" />
            Leaderboard
          </div>
          <p className="mt-2 text-xl font-semibold">#{leaderboard?.rank ?? "-"}</p>
          <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
            {leaderboard?.tier ?? "Unranked"} | Score {Math.round(Number(leaderboard?.totalScore ?? 0))}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm font-semibold">Recovery Check-In</div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Log sleep/soreness/stress/energy so AI can adapt tomorrow.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Sleep (hours)
              </span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                className="input-field mt-1"
                value={recoveryForm.sleepHours}
                onChange={(event) =>
                  setRecoveryForm((current) => ({
                    ...current,
                    sleepHours: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Soreness (0-10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className="input-field mt-1"
                value={recoveryForm.soreness}
                onChange={(event) =>
                  setRecoveryForm((current) => ({
                    ...current,
                    soreness: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Stress (0-10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className="input-field mt-1"
                value={recoveryForm.stress}
                onChange={(event) =>
                  setRecoveryForm((current) => ({
                    ...current,
                    stress: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Energy (0-10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className="input-field mt-1"
                value={recoveryForm.energy}
                onChange={(event) =>
                  setRecoveryForm((current) => ({
                    ...current,
                    energy: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <button
            type="button"
            disabled={recoverySaving}
            onClick={() => void submitRecovery()}
            className="mt-3 rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-night-accent"
          >
            {recoverySaving ? "Saving..." : "Save Recovery Metrics"}
          </button>
          {recoveryMessage ? (
            <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
              {recoveryMessage}
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Injury Report</div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Report pain signals to help AI substitute risky movements.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs sm:col-span-2">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Body Region
              </span>
              <input
                className="input-field mt-1"
                placeholder="e.g. Left shoulder"
                value={injuryForm.bodyRegion}
                onChange={(event) =>
                  setInjuryForm((current) => ({
                    ...current,
                    bodyRegion: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Pain Level (0-10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className="input-field mt-1"
                value={injuryForm.painLevel}
                onChange={(event) =>
                  setInjuryForm((current) => ({
                    ...current,
                    painLevel: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Severity (1-5)
              </span>
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                className="input-field mt-1"
                value={injuryForm.severity}
                onChange={(event) =>
                  setInjuryForm((current) => ({
                    ...current,
                    severity: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <button
            type="button"
            disabled={injurySaving}
            onClick={() => void submitInjury()}
            className="mt-3 rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover disabled:opacity-60 dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
          >
            {injurySaving ? "Saving..." : "Report Injury"}
          </button>
          {injuryMessage ? (
            <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
              {injuryMessage}
            </p>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
