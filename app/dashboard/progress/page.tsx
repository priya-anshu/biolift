"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  Flame,
  Heart,
  Scale,
  Target,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type ProgressOverviewResponse = {
  range: "week" | "month";
  workouts: Array<{
    id: string;
    name: string;
    type: string | null;
    duration_minutes: number;
    calories: number;
    performed_at: string;
    status: string;
    completion_percentage: number;
    volume_kg: number;
  }>;
  bodyWeightEntries: Array<{
    id: string;
    value: number;
    metric: string;
    recorded_at: string;
  }>;
  trainingStatsSnapshot: {
    snapshot_date: string;
    workouts_completed_7d: number;
    weekly_volume_kg: number;
    streak_days: number;
    consistency_score: number;
    acwr?: number | null;
    overtraining_risk?: number | null;
    optimal_volume_kg?: number | null;
  } | null;
  trainingStatsHistory: Array<{
    snapshot_date: string;
    workouts_completed_7d: number;
    weekly_volume_kg: number;
    consistency_score: number;
    streak_days: number;
    readiness_score?: number | null;
  }>;
  exerciseVolumeStats: Array<{
    week_start_date: string;
    exercise_id: string;
    exercise_name: string | null;
    sets_completed: number;
    reps_completed: number;
    weekly_volume_kg: number;
    best_weight_kg: number;
    best_estimated_1rm: number;
  }>;
  stats: {
    workoutsCount: number;
    caloriesBurned: number;
    activeMinutes: number;
    avgHeartRate: number | null;
  };
  error?: string;
};

type Goal = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  progress: number;
};

type WeightLogResponse = {
  entry?: {
    id: string;
    metric: string;
    value: number;
    unit: string | null;
    recorded_at: string;
  };
  error?: string;
};

function formatDateInput(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function toRecordedAtIso(dateValue: string) {
  const parsed = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function formatChartDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeight(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)} kg`;
}

function toDayKey(value: string) {
  return value.slice(0, 10);
}

export default function ProgressPage() {
  const router = useRouter();
  const [range, setRange] = useState<"week" | "month">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProgressOverviewResponse | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [weightDate, setWeightDate] = useState(formatDateInput());
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weightNotice, setWeightNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/progress/overview?range=${range}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProgressOverviewResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load progress");
      }
      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = data?.trainingStatsSnapshot;

  const progressData = useMemo(
    () => ({
      workouts:
        range === "week"
          ? Number(snapshot?.workouts_completed_7d ?? data?.stats.workoutsCount ?? 0)
          : Number(data?.stats.workoutsCount ?? 0),
      calories: Math.round(Number(data?.stats.caloriesBurned ?? 0)),
      minutes: Math.round(Number(data?.stats.activeMinutes ?? 0)),
      heartRate:
        data?.stats.avgHeartRate === null || data?.stats.avgHeartRate === undefined
          ? null
          : Math.round(Number(data.stats.avgHeartRate)),
    }),
    [
      data?.stats.activeMinutes,
      data?.stats.avgHeartRate,
      data?.stats.caloriesBurned,
      data?.stats.workoutsCount,
      range,
      snapshot?.workouts_completed_7d,
    ],
  );

  const goals = useMemo<Goal[]>(() => {
    const weeklyWorkouts = Number(
      snapshot?.workouts_completed_7d ?? data?.stats.workoutsCount ?? 0,
    );
    const weeklyVolume = Math.round(Number(snapshot?.weekly_volume_kg ?? 0));
    const optimalVolume = Math.max(
      1,
      Math.round(Number(snapshot?.optimal_volume_kg ?? (weeklyVolume || 1))),
    );
    const consistency = Math.round(Number(snapshot?.consistency_score ?? 0));

    return [
      {
        id: "weekly-workouts",
        title: "Weekly Workouts",
        current: weeklyWorkouts,
        target: range === "week" ? 7 : 20,
        unit: "workouts",
        progress: Math.min(
          Math.round((weeklyWorkouts / (range === "week" ? 7 : 20)) * 100),
          100,
        ),
      },
      {
        id: "weekly-volume",
        title: "Training Volume",
        current: weeklyVolume,
        target: optimalVolume,
        unit: "kg",
        progress: Math.min(Math.round((weeklyVolume / optimalVolume) * 100), 100),
      },
      {
        id: "consistency",
        title: "Consistency Score",
        current: consistency,
        target: 100,
        unit: "%",
        progress: Math.min(consistency, 100),
      },
    ];
  }, [
    data?.stats.workoutsCount,
    range,
    snapshot?.consistency_score,
    snapshot?.optimal_volume_kg,
    snapshot?.weekly_volume_kg,
    snapshot?.workouts_completed_7d,
  ]);

  const recentWorkouts = useMemo(() => data?.workouts ?? [], [data?.workouts]);

  const weightTrendData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - (range === "week" ? 6 : 29));
    const cutoffTime = cutoffDate.getTime();

    const byDay = new Map<
      string,
      {
        dayKey: string;
        label: string;
        fullDate: string;
        weight: number;
      }
    >();

    (data?.bodyWeightEntries ?? []).forEach((entry) => {
      const recordedTime = new Date(entry.recorded_at).getTime();
      if (!Number.isFinite(recordedTime) || recordedTime < cutoffTime) {
        return;
      }

      const dayKey = toDayKey(entry.recorded_at);
      byDay.set(dayKey, {
        dayKey,
        label: formatChartDate(entry.recorded_at),
        fullDate: formatFullDate(entry.recorded_at),
        weight: Number(Number(entry.value).toFixed(1)),
      });
    });

    return Array.from(byDay.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [data?.bodyWeightEntries, range]);

  const currentWeight =
    weightTrendData.length > 0 ? weightTrendData[weightTrendData.length - 1].weight : null;
  const previousWeight =
    weightTrendData.length > 1 ? weightTrendData[weightTrendData.length - 2].weight : null;
  const weightChange =
    currentWeight !== null && previousWeight !== null
      ? Number((currentWeight - previousWeight).toFixed(1))
      : null;

  const activityChartData = useMemo(() => {
    const byDay = new Map<
      string,
      {
        dayKey: string;
        label: string;
        fullDate: string;
        workouts: number;
        minutes: number;
        calories: number;
        volume: number;
      }
    >();

    recentWorkouts
      .slice()
      .sort((a, b) => a.performed_at.localeCompare(b.performed_at))
      .forEach((workout) => {
        const dayKey = toDayKey(workout.performed_at);
        const current = byDay.get(dayKey) ?? {
          dayKey,
          label: formatChartDate(workout.performed_at),
          fullDate: formatFullDate(workout.performed_at),
          workouts: 0,
          minutes: 0,
          calories: 0,
          volume: 0,
        };

        current.workouts += workout.status === "completed" ? 1 : 0;
        current.minutes += Math.max(0, Math.round(Number(workout.duration_minutes ?? 0)));
        current.calories += Math.max(0, Math.round(Number(workout.calories ?? 0)));
        current.volume += Number(Number(workout.volume_kg ?? 0).toFixed(2));
        byDay.set(dayKey, current);
      });

    return Array.from(byDay.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [recentWorkouts]);

  const trainingLoadChartData = useMemo(() => {
    const history = (data?.trainingStatsHistory ?? []).slice(-(range === "week" ? 14 : 30));
    return history.map((entry) => ({
      dayKey: entry.snapshot_date,
      label: formatChartDate(entry.snapshot_date),
      fullDate: formatFullDate(entry.snapshot_date),
      volume: Math.round(Number(entry.weekly_volume_kg ?? 0)),
      consistency: Math.round(Number(entry.consistency_score ?? 0)),
      workouts: Math.round(Number(entry.workouts_completed_7d ?? 0)),
    }));
  }, [data?.trainingStatsHistory, range]);

  const topExerciseData = useMemo(() => {
    const byExercise = new Map<
      string,
      {
        exercise: string;
        shortLabel: string;
        volume: number;
        bestWeight: number;
      }
    >();

    (data?.exerciseVolumeStats ?? []).forEach((entry) => {
      const exerciseName = entry.exercise_name?.trim() || "Exercise";
      const current = byExercise.get(exerciseName) ?? {
        exercise: exerciseName,
        shortLabel:
          exerciseName.length > 14 ? `${exerciseName.slice(0, 14).trim()}...` : exerciseName,
        volume: 0,
        bestWeight: 0,
      };

      current.volume += Number(entry.weekly_volume_kg ?? 0);
      current.bestWeight = Math.max(current.bestWeight, Number(entry.best_weight_kg ?? 0));
      byExercise.set(exerciseName, current);
    });

    return Array.from(byExercise.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6)
      .map((entry) => ({
        ...entry,
        volume: Math.round(entry.volume),
        bestWeight: Number(entry.bestWeight.toFixed(1)),
      }));
  }, [data?.exerciseVolumeStats]);

  const handleWeightSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedWeight = Number(weightValue);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setWeightError("Enter a valid weight in kilograms.");
      setWeightNotice(null);
      return;
    }

    setWeightSaving(true);
    setWeightError(null);
    setWeightNotice(null);

    try {
      const response = await fetch("/api/progress/log-weight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueKg: parsedWeight,
          recordedAt: toRecordedAtIso(weightDate),
        }),
      });
      const payload = (await response.json()) as WeightLogResponse;
      if (!response.ok || !payload.entry) {
        throw new Error(payload.error ?? "Failed to log body weight");
      }
      const entry = payload.entry;

      setData((current) => {
        if (!current) return current;
        const nextEntries = [...current.bodyWeightEntries, entry].sort((a, b) =>
          a.recorded_at.localeCompare(b.recorded_at),
        );
        return {
          ...current,
          bodyWeightEntries: nextEntries,
        };
      });
      setWeightValue("");
      setWeightNotice(
        `Saved ${parsedWeight.toFixed(1)} kg for ${formatFullDate(entry.recorded_at)}.`,
      );
    } catch (submitError) {
      setWeightError(
        submitError instanceof Error ? submitError.message : "Failed to log body weight",
      );
    } finally {
      setWeightSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
              Progress & Analytics
            </h1>
            <p className="text-day-text-secondary dark:text-night-text-secondary">
              Daily weight tracking and live charts from your saved progress history
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={range === "week" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setRange("week")}
          >
            Week
          </Button>
          <Button
            variant={range === "month" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setRange("month")}
          >
            Month
          </Button>
        </div>
      </motion.div>

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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5"
      >
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {progressData.workouts}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Workouts This {range === "week" ? "Week" : "Month"}
          </div>
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">
            Range synced to live data
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {progressData.calories.toLocaleString()}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Calories Burned
          </div>
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">
            Current {range} overview
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {progressData.minutes}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Active Minutes
          </div>
          <div className="mt-2 text-xs text-green-600 dark:text-green-400">
            From workout logs
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {progressData.heartRate ?? "-"}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Avg Heart Rate
          </div>
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            Logged performance signal
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
            <Scale className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {formatWeight(currentWeight)}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Latest Body Weight
          </div>
          <div
            className={`mt-2 text-xs ${
              weightChange === null
                ? "text-day-text-secondary dark:text-night-text-secondary"
                : weightChange <= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-orange-600 dark:text-orange-400"
            }`}
          >
            {weightChange === null
              ? "Add two entries to see change"
              : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg since last entry`}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr,1.05fr]"
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Scale className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
                <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                  Daily Weight Tracker
                </h2>
              </div>
              <Badge variant="info" size="sm">
                progress_entries
              </Badge>
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Log today or backfill a past day. Charts update immediately from your saved history.
            </p>
          </div>
          <div className="p-6">
            <form className="grid gap-4 md:grid-cols-[1fr,0.9fr,auto]" onSubmit={handleWeightSubmit}>
              <label className="space-y-2">
                <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                  Weight (kg)
                </span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="0.1"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  placeholder="72.4"
                  className="w-full rounded-lg border border-day-border bg-day-card px-4 py-3 text-sm text-day-text-primary outline-none transition focus:border-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:border-night-accent"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                  Date
                </span>
                <input
                  type="date"
                  value={weightDate}
                  onChange={(event) => setWeightDate(event.target.value)}
                  max={formatDateInput()}
                  className="w-full rounded-lg border border-day-border bg-day-card px-4 py-3 text-sm text-day-text-primary outline-none transition focus:border-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:border-night-accent"
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" loading={weightSaving} className="w-full md:w-auto">
                  Save Weight
                </Button>
              </div>
            </form>

            {weightError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {weightError}
              </div>
            ) : null}
            {weightNotice ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                {weightNotice}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-day-hover p-4 dark:bg-night-hover">
                <div className="text-xs uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Latest
                </div>
                <div className="mt-1 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatWeight(currentWeight)}
                </div>
              </div>
              <div className="rounded-lg bg-day-hover p-4 dark:bg-night-hover">
                <div className="text-xs uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Entries
                </div>
                <div className="mt-1 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                  {weightTrendData.length}
                </div>
              </div>
              <div className="rounded-lg bg-day-hover p-4 dark:bg-night-hover">
                <div className="text-xs uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Trend
                </div>
                <div className="mt-1 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                  {weightChange === null
                    ? "Pending"
                    : weightChange <= 0
                      ? "Moving down"
                      : "Moving up"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Goals Progress
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                      {goal.title}
                    </span>
                    <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-day-accent-primary to-day-accent-secondary transition-all duration-300 dark:from-night-accent dark:to-red-600"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-day-border pt-4 dark:border-night-border">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => router.push("/dashboard/workout-planner")}
              >
                View All Goals
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

            <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Body Weight Trend
              </h2>
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Latest saved entry per day from your progress history
            </p>
          </div>
          <div className="p-6">
            {weightTrendData.length === 0 ? (
              <div className="flex h-72 items-center justify-center rounded-lg bg-day-hover dark:bg-night-hover">
                <div className="text-center">
                  <Scale className="mx-auto mb-3 h-12 w-12 text-day-text-secondary dark:text-night-text-secondary" />
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Add your first weight entry to start the chart.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.35} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
                    <Tooltip
                      formatter={(value: number | string | undefined) => [
                        `${Number(value ?? 0).toFixed(1)} kg`,
                        "Weight",
                      ]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#2563EB"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#2563EB" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Daily Activity
              </h2>
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Workout sessions and active minutes across the selected range
            </p>
          </div>
          <div className="p-6">
            {activityChartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center rounded-lg bg-day-hover dark:bg-night-hover">
                <div className="text-center">
                  <Activity className="mx-auto mb-3 h-12 w-12 text-day-text-secondary dark:text-night-text-secondary" />
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Complete a workout to populate the activity chart.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityChartData}>
                    <defs>
                      <linearGradient id="minutesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.35} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="minutes" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="workouts" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""} />
                    <Legend />
                    <Area
                      yAxisId="minutes"
                      type="monotone"
                      dataKey="minutes"
                      stroke="#10B981"
                      fill="url(#minutesFill)"
                      name="Minutes"
                    />
                    <Bar
                      yAxisId="workouts"
                      dataKey="workouts"
                      fill="#F97316"
                      radius={[6, 6, 0, 0]}
                      name="Completed Workouts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr,0.95fr]"
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Training Load History
              </h2>
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Weekly volume and consistency from saved training snapshots
            </p>
          </div>
          <div className="p-6">
            {trainingLoadChartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center rounded-lg bg-day-hover dark:bg-night-hover">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-3 h-12 w-12 text-day-text-secondary dark:text-night-text-secondary" />
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Training snapshots will appear here once they are generated.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trainingLoadChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.35} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="volume" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="consistency" orientation="right" tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""} />
                    <Legend />
                    <Line
                      yAxisId="volume"
                      type="monotone"
                      dataKey="volume"
                      stroke="#8B5CF6"
                      strokeWidth={3}
                      dot={false}
                      name="Weekly Volume (kg)"
                    />
                    <Line
                      yAxisId="consistency"
                      type="monotone"
                      dataKey="consistency"
                      stroke="#06B6D4"
                      strokeWidth={3}
                      dot={false}
                      name="Consistency (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Top Exercise Volume
              </h2>
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Highest total volume based on stored exercise stats
            </p>
          </div>
          <div className="p-6">
            {topExerciseData.length === 0 ? (
              <div className="flex h-72 items-center justify-center rounded-lg bg-day-hover dark:bg-night-hover">
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-3 h-12 w-12 text-day-text-secondary dark:text-night-text-secondary" />
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Strength history will appear after completed training sessions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topExerciseData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.25} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="shortLabel" tickLine={false} axisLine={false} width={110} />
                    <Tooltip
                      formatter={(value: number | string | undefined, name) =>
                        name === "Best Weight"
                          ? [`${Number(value ?? 0).toFixed(1)} kg`, name]
                          : [`${Math.round(Number(value ?? 0))} kg`, name]
                      }
                    />
                    <Legend />
                    <Bar dataKey="volume" fill="#2563EB" radius={[0, 6, 6, 0]} name="Volume" />
                    <Bar dataKey="bestWeight" fill="#14B8A6" radius={[0, 6, 6, 0]} name="Best Weight" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Recent Activity
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {recentWorkouts.slice(0, 5).map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-day-hover dark:hover:bg-night-hover"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                        {workout.name}
                      </h4>
                      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {Math.round(workout.duration_minutes)} min - {Math.round(workout.calories)} cal
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="ghost" size="sm" className="capitalize">
                      {workout.type ?? workout.status.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {Math.round(workout.volume_kg)} kg
                    </span>
                  </div>
                </div>
              ))}
              {recentWorkouts.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  No recent workouts yet.
                </div>
              ) : null}
            </div>
            <div className="mt-4 border-t border-day-border pt-4 dark:border-night-border">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => router.push("/dashboard/workouts")}
              >
                View All Workouts
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}


