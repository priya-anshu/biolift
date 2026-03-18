"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Flame,
  Play,
  Search,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";

type ProgressOverviewResponse = {
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
  error?: string;
};

type WorkoutItem = ProgressOverviewResponse["workouts"][number];

function formatWorkoutDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/progress/overview?range=month", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProgressOverviewResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load workouts");
      }
      setWorkouts(payload.workouts ?? []);
    } catch (loadError) {
      setWorkouts([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load workouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const workoutTypes = useMemo(() => {
    const values = Array.from(
      new Set(
        workouts
          .map((workout) => workout.type?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();

    return ["all", ...values];
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...workouts]
      .filter((workout) => {
        const workoutType = workout.type?.toLowerCase() ?? "";
        const matchesSearch =
          normalizedSearch.length === 0 ||
          workout.name.toLowerCase().includes(normalizedSearch);
        const matchesType = filterType === "all" || workoutType === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "duration":
            return b.duration_minutes - a.duration_minutes;
          case "calories":
            return b.calories - a.calories;
          case "date":
          default:
            return (
              new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
            );
        }
      });
  }, [filterType, searchQuery, sortBy, workouts]);

  const stats = useMemo(() => {
    if (workouts.length === 0) return null;

    const totalWorkouts = workouts.length;
    const totalCalories = workouts.reduce((sum, workout) => sum + workout.calories, 0);
    const totalDuration = workouts.reduce(
      (sum, workout) => sum + workout.duration_minutes,
      0,
    );
    const avgCalories = Math.round(totalCalories / totalWorkouts);

    return {
      totalWorkouts,
      totalCalories: Math.round(totalCalories),
      totalDuration: Math.round(totalDuration),
      avgCalories,
    };
  }, [workouts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200" />
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-20 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="rounded-lg p-2 text-day-text-secondary transition hover:bg-day-hover hover:text-day-text-primary dark:text-night-text-secondary dark:hover:bg-night-hover dark:hover:text-night-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
              Workout History
            </h1>
            <p className="text-day-text-secondary dark:text-night-text-secondary">
              Track your fitness journey and progress
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/workout-session"
          className="inline-flex items-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
        >
          <Play className="mr-2 h-4 w-4" />
          Start Workout
        </Link>
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

      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-4"
        >
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalWorkouts}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Total Workouts
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalCalories}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Calories Burned
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalDuration}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Total Minutes
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.avgCalories}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Avg Calories/Workout
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col gap-4 md:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-day-border bg-day-card py-3 pl-10 pr-4 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="rounded-lg border border-day-border bg-day-card px-4 py-3 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          >
            {workoutTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all"
                  ? "All Types"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-lg border border-day-border bg-day-card px-4 py-3 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          >
            <option value="date">Sort by Date</option>
            <option value="duration">Sort by Duration</option>
            <option value="calories">Sort by Calories</option>
          </select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-4"
      >
        {filteredWorkouts.map((workout) => (
          <Card key={workout.id} className="p-6 transition-shadow hover:shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                    {workout.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                    <span className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {Math.round(workout.duration_minutes)} min
                    </span>
                    <span className="flex items-center">
                      <Flame className="mr-1 h-4 w-4" />
                      {Math.round(workout.calories)} cal
                    </span>
                    <span className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      {formatWorkoutDate(workout.performed_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="rounded-full border border-day-border px-2.5 py-1 text-xs font-semibold capitalize text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                  {workout.type ?? "workout"}
                </span>
                <Link
                  href="/dashboard/workout-session"
                  className="inline-flex items-center rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                >
                  <Play className="mr-1 h-4 w-4" />
                  Repeat
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {filteredWorkouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="py-12 text-center"
        >
          <Play className="mx-auto mb-4 h-16 w-16 text-day-text-secondary dark:text-night-text-secondary" />
          <h3 className="mb-2 text-lg font-medium text-day-text-primary dark:text-night-text-primary">
            {searchQuery || filterType !== "all" ? "No workouts found" : "No workouts yet"}
          </h3>
          <p className="mb-4 text-day-text-secondary dark:text-night-text-secondary">
            {searchQuery || filterType !== "all"
              ? "Try adjusting your search or filters"
              : "Start your fitness journey with your first workout"}
          </p>
          <Link
            href="/dashboard/workout-session"
            className="inline-flex items-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Your First Workout
          </Link>
        </motion.div>
      ) : null}
    </div>
  );
}
