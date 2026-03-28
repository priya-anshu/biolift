"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
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
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="bodyweightChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.18} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#bodyweightChartFill)"
                dot={false}
                activeDot={{ r: 5, fill: "#3b82f6", stroke: "#111827", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
