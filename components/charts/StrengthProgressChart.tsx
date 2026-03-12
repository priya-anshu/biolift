"use client";

import { useMemo, useState } from "react";
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

type ExerciseVolumePoint = {
  week_start_date: string;
  exercise_id: string;
  exercise_name: string | null;
  best_estimated_1rm: number;
};

type StrengthProgressChartProps = {
  data: ExerciseVolumePoint[];
  loading?: boolean;
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function prioritizeExercise(options: Array<{ id: string; name: string }>) {
  const priorities = ["bench press", "squat", "deadlift"];
  for (const label of priorities) {
    const hit = options.find((option) => option.name.toLowerCase().includes(label));
    if (hit) return hit.id;
  }
  return options[0]?.id ?? "";
}

export default function StrengthProgressChart({
  data,
  loading = false,
}: StrengthProgressChartProps) {
  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((row) => {
      if (!row.exercise_id) return;
      if (!map.has(row.exercise_id)) {
        map.set(row.exercise_id, row.exercise_name ?? "Exercise");
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const [exerciseId, setExerciseId] = useState("");
  const effectiveExerciseId =
    exerciseId && exerciseOptions.some((option) => option.id === exerciseId)
      ? exerciseId
      : prioritizeExercise(exerciseOptions);

  const chartData = useMemo(
    () =>
      data
        .filter((row) => row.exercise_id === effectiveExerciseId)
        .sort(
          (a, b) =>
            new Date(a.week_start_date).getTime() - new Date(b.week_start_date).getTime(),
        )
        .map((row) => ({
          label: formatShortDate(row.week_start_date),
          e1rm: Number(row.best_estimated_1rm ?? 0),
        })),
    [data, effectiveExerciseId],
  );

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Strength Progress (Estimated 1RM)</div>
        <select
          value={effectiveExerciseId}
          onChange={(event) => setExerciseId(event.target.value)}
          className="rounded-lg border border-day-border bg-day-card px-3 py-1.5 text-xs dark:border-night-border dark:bg-night-card"
          disabled={exerciseOptions.length === 0}
        >
          {exerciseOptions.length === 0 ? (
            <option value="">No exercise data</option>
          ) : (
            exerciseOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="mt-4 h-64">
        {loading ? (
          <div className="skeleton h-full rounded-lg" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            No strength progression data yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="e1rm"
                stroke="#0ea5e9"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
