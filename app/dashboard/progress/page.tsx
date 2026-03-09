"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bolt,
  Calendar,
  Clock,
  Flame,
  Heart,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

type Workout = {
  id: string;
  name: string;
  type: string | null;
  duration_minutes: number | null;
  calories: number | null;
  performed_at: string;
  status?: string;
  completion_percentage?: number | null;
  volume_kg?: number | null;
};

type Goal = {
  id: string;
  title: string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
};

type ProgressEntry = {
  value: number;
  metric: string;
  recorded_at: string;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function getRangeStart(range: "week" | "month") {
  const start = new Date();
  start.setDate(start.getDate() - (range === "week" ? 7 : 30));
  return start;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProgressPage() {
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [heartEntries, setHeartEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightValue, setWeightValue] = useState("");
  const [weightDate, setWeightDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [logStatus, setLogStatus] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/progress/overview?range=${timeRange}`, {
      cache: "no-store",
    });
    const payload = (await res.json()) as {
      workouts?: Workout[];
      goals?: Goal[];
      heartEntries?: ProgressEntry[];
      error?: string;
    };
    if (!res.ok) {
      setLogError(payload.error ?? "Failed to load progress data");
      setLoading(false);
      return;
    }

    setWorkouts(payload.workouts ?? []);
    setGoals(payload.goals ?? []);
    setHeartEntries(payload.heartEntries ?? []);
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedWorkouts = workouts.filter(
    (workout) => (workout.status ?? "completed") === "completed",
  );
  const workoutsCount = completedWorkouts.length;
  const caloriesBurned = completedWorkouts.reduce(
    (sum, workout) => sum + (workout.calories ?? 0),
    0,
  );
  const activeMinutes = completedWorkouts.reduce(
    (sum, workout) => sum + (workout.duration_minutes ?? 0),
    0,
  );
  const avgHeartRate = useMemo(() => {
    if (!heartEntries.length) return null;
    const avg =
      heartEntries.reduce((sum, entry) => sum + Number(entry.value), 0) /
      heartEntries.length;
    return Math.round(avg);
  }, [heartEntries]);

  const handleWeightLog = async () => {
    setLogStatus(null);
    setLogError(null);
    const value = Number(weightValue);
    if (!value || Number.isNaN(value)) {
      setLogError("Enter a valid body weight.");
      return;
    }
    const recordedAt = new Date(`${weightDate}T08:00:00Z`).toISOString();
    const response = await fetch("/api/progress/log-weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valueKg: value,
        recordedAt,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setLogError("Unable to save weight. Try again.");
      return;
    }
    setLogStatus("Body weight saved.");
    setWeightValue("");
    await loadData();
  };

  const chartData = useMemo(() => {
    const start = getRangeStart(timeRange);
    const days = timeRange === "week" ? 7 : 30;
    const buckets = new Map<
      string,
      {
        date: string;
        workouts: number;
        calories: number;
        minutes: number;
        volume: number;
        completed: number;
        scheduled: number;
        heart: number[];
      }
    >();

    for (let i = 0; i < days; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, {
        date: key,
        workouts: 0,
        calories: 0,
        minutes: 0,
        volume: 0,
        completed: 0,
        scheduled: 0,
        heart: [],
      });
    }

    workouts.forEach((workout) => {
      const key = workout.performed_at.slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) return;
      const status = workout.status ?? "completed";
      if (status === "completed") {
        bucket.workouts += 1;
        bucket.completed += 1;
      }
      if (
        status === "completed" ||
        status === "planned" ||
        status === "in_progress" ||
        status === "missed"
      ) {
        bucket.scheduled += 1;
      }
      bucket.calories += workout.calories ?? 0;
      bucket.minutes += workout.duration_minutes ?? 0;
      bucket.volume += workout.volume_kg ?? 0;
    });

    heartEntries.forEach((entry) => {
      const key = entry.recorded_at.slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.heart.push(Number(entry.value));
    });

    return Array.from(buckets.values()).map((bucket) => ({
      date: bucket.date,
      label: formatShortDate(bucket.date),
      workouts: bucket.workouts,
      calories: bucket.calories,
      minutes: bucket.minutes,
      volume: Number(bucket.volume.toFixed(2)),
      consistency:
        bucket.scheduled > 0
          ? Number(((bucket.completed / bucket.scheduled) * 100).toFixed(1))
          : 0,
      heart:
        bucket.heart.length > 0
          ? Math.round(
              bucket.heart.reduce((sum, value) => sum + value, 0) /
                bucket.heart.length,
            )
          : 0,
    }));
  }, [workouts, heartEntries, timeRange]);

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-day-border text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Progress & Analytics</h1>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Track your fitness journey with detailed insights.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["week", "month"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                timeRange === range
                  ? "bg-day-accent-primary text-white shadow-sm dark:bg-night-accent"
                  : "border border-day-border text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              }`}
            >
              {range === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            label: `Workouts this ${timeRange}`,
            value: workoutsCount.toString(),
            icon: Activity,
            tone: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
          },
          {
            label: "Calories Burned",
            value: caloriesBurned.toLocaleString(),
            icon: Flame,
            tone: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
          },
          {
            label: "Active Minutes",
            value: activeMinutes.toString(),
            icon: Clock,
            tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
          },
          {
            label: "Avg Heart Rate",
            value: avgHeartRate ? avgHeartRate.toString() : "—",
            icon: Heart,
            tone: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.tone}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-semibold">{stat.value}</div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              {stat.label}
            </div>
          </div>
        ))}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Goals Progress
          </div>
          <div className="mt-4 space-y-4">
            {goals.length === 0 ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                No goals yet. Add your first goal to start tracking.
              </div>
            ) : (
              goals.map((goal) => {
                const current = goal.current_value ?? 0;
                const target = goal.target_value ?? 0;
                const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{goal.title}</span>
                      <span className="text-day-text-secondary dark:text-night-text-secondary">
                        {current}/{target} {goal.unit ?? ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Recent Activity
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Loading activity…
              </div>
            ) : workouts.length === 0 ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                No workouts logged yet.
              </div>
            ) : (
              workouts.slice(0, 4).map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between rounded-xl border border-day-border px-3 py-2 text-sm text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-day-accent-primary to-day-accent-secondary text-white dark:from-night-accent dark:to-red-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                        {workout.name}
                      </div>
                      <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {(workout.duration_minutes ?? 0) > 0
                          ? `${workout.duration_minutes} min`
                          : "0 min"}{" "}
                        •{" "}
                        {(workout.calories ?? 0) > 0
                          ? `${workout.calories} cal`
                          : "0 cal"}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-day-hover px-2 py-0.5 text-[11px] font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                    {workout.type ?? "Workout"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Bodyweight Tracking
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-sm font-semibold">Daily Body Weight</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="number"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  placeholder="e.g. 72.5"
                  className="w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
                />
                <input
                  type="date"
                  value={weightDate}
                  onChange={(event) => setWeightDate(event.target.value)}
                  className="w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
                />
                <button
                  onClick={handleWeightLog}
                  className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
                >
                  Save
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-day-border p-4 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
              Record your weight daily to unlock fair ranking eligibility.
            </div>
            {logStatus ? (
              <div className="text-sm text-emerald-600 dark:text-emerald-300">{logStatus}</div>
            ) : null}
            {logError ? <div className="text-sm text-rose-500">{logError}</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Analytics Source
          </div>
          <div className="mt-4 space-y-3 text-sm text-day-text-secondary dark:text-night-text-secondary">
            <p>
              Workout analytics on this page are generated automatically from completed
              workout sessions.
            </p>
            <p>
              Source tables: <code>workout_logs</code>, <code>workout_log_exercises</code>,{" "}
              <code>workout_log_sets</code>, and <code>personal_records</code>.
            </p>
            <Link
              href="/dashboard/workout-session"
              className="inline-flex rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
            >
              Start Workout Session
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
          Progress Trends
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="min-h-[260px] rounded-xl border border-day-border bg-day-hover p-4 dark:border-night-border dark:bg-night-hover">
            <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
              <Activity className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Workouts per day
            </div>
            <div className="mt-3 h-56 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="workouts"
                    fill="var(--color-day-accent-primary)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-h-[260px] rounded-xl border border-day-border bg-day-hover p-4 dark:border-night-border dark:bg-night-hover">
            <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
              <Flame className="h-4 w-4 text-day-accent-secondary dark:text-night-accent" />
              Volume progression (kg)
            </div>
            <div className="mt-3 h-56 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="var(--color-day-accent-secondary)"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-h-[260px] rounded-xl border border-day-border bg-day-hover p-4 dark:border-night-border dark:bg-night-hover">
            <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
              <Bolt className="h-4 w-4 text-amber-500" />
              Training consistency (%)
            </div>
            <div className="mt-3 h-56 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="consistency"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-h-[260px] rounded-xl border border-day-border bg-day-hover p-4 dark:border-night-border dark:bg-night-hover">
            <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
              <Heart className="h-4 w-4 text-red-500" />
              Avg heart rate
            </div>
            <div className="mt-3 h-56 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="heart"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
