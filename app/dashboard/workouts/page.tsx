"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Flame, Play, Search } from "lucide-react";
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

export default function WorkoutsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<ProgressOverviewResponse["workouts"]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/progress/overview?range=month", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProgressOverviewResponse;
      if (!response.ok) throw new Error(payload.error ?? "Failed to load workouts");
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workouts.filter((workout) => {
      const matchesQuery =
        normalized.length === 0 || workout.name.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === "all" || workout.status.toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, workouts]);

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workout History</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Canonical session history from `workout_logs` and exercise execution.
          </p>
        </div>
        <Link
          href="/dashboard/workout-session"
          className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
        >
          Start Workout
        </Link>
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

      <section className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workout"
            className="w-full rounded-lg border border-day-border bg-day-card py-2 pl-10 pr-3 text-sm dark:border-night-border dark:bg-night-card"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm dark:border-night-border dark:bg-night-card"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="planned">Planned</option>
          <option value="missed">Missed</option>
          <option value="rest_day">Rest Day</option>
        </select>
      </section>

      <section className="space-y-3">
        {loading ? (
          <>
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
          </>
        ) : filtered.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              No workouts found.
            </p>
          </Card>
        ) : (
          filtered.map((workout) => (
            <Card key={workout.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{workout.name}</p>
                  <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {Math.round(workout.duration_minutes)} min
                    </span>
                    {"  |  "}
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" />
                      {Math.round(workout.calories)} cal
                    </span>
                    {"  |  "}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(workout.performed_at).toLocaleDateString()}
                    </span>
                    {"  |  Volume "}
                    {Math.round(workout.volume_kg)} kg
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-day-hover px-2 py-1 text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                    {workout.status.replaceAll("_", " ")}
                  </span>
                  <Link
                    href="/dashboard/workout-session"
                    className="inline-flex items-center gap-1 rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
