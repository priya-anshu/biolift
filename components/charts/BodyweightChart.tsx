"use client";

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

type BodyweightEntry = {
  recorded_at: string;
  value: number;
};

type BodyweightChartProps = {
  entries: BodyweightEntry[];
  loading?: boolean;
};

function startOfWeekIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function BodyweightChart({ entries, loading = false }: BodyweightChartProps) {
  const weeklyData = Object.values(
    entries.reduce<
      Record<
        string,
        {
          weekStart: string;
          sum: number;
          count: number;
        }
      >
    >((acc, row) => {
      const weekStart = startOfWeekIso(row.recorded_at);
      if (!weekStart) return acc;
      const current = acc[weekStart] ?? { weekStart, sum: 0, count: 0 };
      current.sum += Number(row.value ?? 0);
      current.count += 1;
      acc[weekStart] = current;
      return acc;
    }, {}),
  )
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
    .map((row) => ({
      label: shortDate(row.weekStart),
      value: Number((row.sum / Math.max(1, row.count)).toFixed(2)),
    }));

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold">Bodyweight Trend (Weekly)</div>
      <div className="mt-4 h-64">
        {loading ? (
          <div className="skeleton h-full rounded-lg" />
        ) : weeklyData.length === 0 ? (
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            No body weight entries yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
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

