"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  Flame,
  Heart,
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

export default function ProgressPage() {
  const router = useRouter();
  const [range, setRange] = useState<"week" | "month">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProgressOverviewResponse | null>(null);

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
      heartRate: Math.round(Number(data?.stats.avgHeartRate ?? 0)),
    }),
    [data?.stats.activeMinutes, data?.stats.avgHeartRate, data?.stats.caloriesBurned, data?.stats.workoutsCount, range, snapshot?.workouts_completed_7d],
  );

  const goals = useMemo<Goal[]>(() => {
    const weeklyWorkouts = Number(snapshot?.workouts_completed_7d ?? data?.stats.workoutsCount ?? 0);
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
  }, [data?.stats.workoutsCount, range, snapshot?.consistency_score, snapshot?.optimal_volume_kg, snapshot?.weekly_volume_kg, snapshot?.workouts_completed_7d]);

  const recentWorkouts = data?.workouts ?? [];

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
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
              Progress & Analytics
            </h1>
            <p className="text-day-text-secondary dark:text-night-text-secondary">
              Track your fitness journey with detailed insights
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Flame className="w-6 h-6 text-orange-600 dark:text-orange-400" />
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
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
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
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            {progressData.heartRate || "-"}
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Avg Heart Rate
          </div>
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            Logged performance signal
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-day-accent-primary dark:text-night-accent" />
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
                  <div className="w-full bg-day-border dark:bg-night-border rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-day-border dark:border-night-border">
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

        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Recent Activity
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {recentWorkouts.slice(0, 4).map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-day-text-primary dark:text-night-text-primary text-sm">
                        {workout.name}
                      </h4>
                      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {Math.round(workout.duration_minutes)} min • {Math.round(workout.calories)} cal
                      </p>
                    </div>
                  </div>
                  <Badge variant="ghost" size="sm" className="capitalize">
                    {workout.type ?? workout.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              ))}
              {recentWorkouts.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  No recent workouts yet.
                </div>
              ) : null}
            </div>
            <div className="mt-4 pt-4 border-t border-day-border dark:border-night-border">
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-day-accent-primary dark:text-night-accent" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Progress Trends
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="h-64 bg-day-hover dark:bg-night-hover rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 mx-auto text-day-text-secondary dark:text-night-text-secondary mb-4" />
                <h3 className="text-lg font-medium text-day-text-primary dark:text-night-text-primary mb-2">
                  Progress Charts Coming Soon
                </h3>
                <p className="text-day-text-secondary dark:text-night-text-secondary">
                  Advanced analytics and visualizations will be available here
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
