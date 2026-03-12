"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Flame, Target, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import BodyweightChart from "@/components/charts/BodyweightChart";
import StrengthProgressChart from "@/components/charts/StrengthProgressChart";

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

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProgressPage() {
  const [range, setRange] = useState<"week" | "month">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProgressOverviewResponse | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightMessage, setWeightMessage] = useState<string | null>(null);

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

  const historyChart = useMemo(
    () =>
      (data?.trainingStatsHistory ?? []).map((row) => ({
        label: shortDate(row.snapshot_date),
        workouts: row.workouts_completed_7d,
        volume: Number(row.weekly_volume_kg ?? 0),
        consistency: Number(row.consistency_score ?? 0),
        readiness: Number(row.readiness_score ?? 0),
      })),
    [data?.trainingStatsHistory],
  );

  const snapshot = data?.trainingStatsSnapshot;

  const submitWeight = async () => {
    setWeightSaving(true);
    setWeightMessage(null);
    try {
      const valueKg = Number(weightKg);
      if (!Number.isFinite(valueKg) || valueKg <= 0) {
        throw new Error("Enter a valid body weight value.");
      }
      const response = await fetch("/api/progress/log-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valueKg,
          recordedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to log body weight");
      }
      setWeightMessage("Body weight logged.");
      setWeightKg("");
      await load();
    } catch (saveError) {
      setWeightMessage(
        saveError instanceof Error ? saveError.message : "Failed to log body weight",
      );
    } finally {
      setWeightSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Progress Overview</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Analytics only. Data is sourced from workout logs, set execution, and cached snapshots.
          </p>
        </div>
        <div className="flex gap-2">
          {(["week", "month"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setRange(entry)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                range === entry
                  ? "bg-day-accent-primary text-white dark:bg-night-accent"
                  : "border border-day-border text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              }`}
            >
              {entry === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
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

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[180px]">
            <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Body Weight (kg)
            </span>
            <input
              type="number"
              min={1}
              max={500}
              step={0.1}
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="input-field mt-1"
              placeholder="e.g. 72.4"
            />
          </label>
          <button
            type="button"
            disabled={weightSaving}
            onClick={() => void submitWeight()}
            className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-night-accent"
          >
            {weightSaving ? "Saving..." : "Log Weight"}
          </button>
        </div>
        {weightMessage ? (
          <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
            {weightMessage}
          </p>
        ) : null}
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-sky-500" />
            Workouts (7d)
          </div>
          <p className="mt-2 text-2xl font-semibold">{snapshot?.workouts_completed_7d ?? data?.stats.workoutsCount ?? 0}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-orange-500" />
            Weekly Volume
          </div>
          <p className="mt-2 text-2xl font-semibold">{Math.round(snapshot?.weekly_volume_kg ?? 0)} kg</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-emerald-500" />
            Consistency
          </div>
          <p className="mt-2 text-2xl font-semibold">{Math.round(snapshot?.consistency_score ?? 0)}%</p>
          <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
            Streak: {snapshot?.streak_days ?? 0} days
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-violet-500" />
            Load Signals
          </div>
          <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
            ACWR: {snapshot?.acwr !== null && snapshot?.acwr !== undefined ? Number(snapshot.acwr).toFixed(2) : "-"}
          </p>
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Overtraining risk: {snapshot?.overtraining_risk !== null && snapshot?.overtraining_risk !== undefined ? `${Math.round(Number(snapshot.overtraining_risk))}%` : "-"}
          </p>
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Optimal volume: {snapshot?.optimal_volume_kg !== null && snapshot?.optimal_volume_kg !== undefined ? `${Math.round(Number(snapshot.optimal_volume_kg))} kg` : "-"}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BodyweightChart entries={data?.bodyWeightEntries ?? []} loading={loading} />
        <StrengthProgressChart data={data?.exerciseVolumeStats ?? []} loading={loading} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-semibold">Weekly Training Volume</div>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="skeleton h-full rounded-lg" />
            ) : historyChart.length === 0 ? (
              <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">No training history yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Consistency Score</div>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="skeleton h-full rounded-lg" />
            ) : historyChart.length === 0 ? (
              <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">No consistency history yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="consistency" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Recovery Readiness Trend</div>
          <div className="mt-4 h-64">
            {loading ? (
              <div className="skeleton h-full rounded-lg" />
            ) : historyChart.length === 0 ? (
              <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                No readiness trend yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="readiness"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
          Analytics pipeline: workout_logs to workout_log_exercises to workout_log_sets, with snapshots from user_training_stats and exercise_volume_stats.
        </p>
      </Card>
    </div>
  );
}
