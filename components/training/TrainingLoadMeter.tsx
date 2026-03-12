"use client";

import { Activity, Gauge } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type TrainingLoadState = {
  acwr?: number | null;
  acute_load_7d?: number | null;
  chronic_load_28d?: number | null;
  overtraining_risk?: number | null;
} | null;

type TrainingLoadMeterProps = {
  loadState: TrainingLoadState;
};

function classifyAcwr(acwr: number) {
  if (acwr < 0.8) {
    return { label: "Low", variant: "warning" as const };
  }
  if (acwr <= 1.3) {
    return { label: "Optimal", variant: "success" as const };
  }
  if (acwr <= 1.6) {
    return { label: "High", variant: "warning" as const };
  }
  return { label: "Risk", variant: "danger" as const };
}

function clampMeter(acwr: number) {
  const max = 2;
  return Math.max(0, Math.min(100, (acwr / max) * 100));
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(Number(value))} kg`;
}

export default function TrainingLoadMeter({ loadState }: TrainingLoadMeterProps) {
  const acwr = Number(loadState?.acwr ?? 1);
  const zone = classifyAcwr(acwr);
  const marker = clampMeter(acwr);
  const overtraining = Math.max(
    0,
    Math.min(100, Number(loadState?.overtraining_risk ?? 0)),
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-sky-500" />
            Training Load Meter
          </div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Acute/Chronic load balance from `training_load_state`.
          </p>
        </div>
        <Badge variant={zone.variant} size="sm">
          {zone.label}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full border border-day-border dark:border-night-border">
          <div className="flex h-full">
            <div className="w-2/5 bg-amber-400/80" />
            <div className="w-2/5 bg-emerald-500/80" />
            <div className="w-1/5 bg-red-500/80" />
          </div>
        </div>
        <div className="relative mt-1 h-2">
          <div
            className="absolute top-0 h-2 w-0.5 bg-day-text-primary dark:bg-night-text-primary"
            style={{ left: `calc(${marker}% - 1px)` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-day-text-secondary dark:text-night-text-secondary">
          <span>Low</span>
          <span>Optimal</span>
          <span>High</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">ACWR</div>
          <div className="mt-1 font-semibold">{Number.isFinite(acwr) ? acwr.toFixed(2) : "-"}</div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">
            Overtraining Risk
          </div>
          <div className="mt-1 font-semibold">{Math.round(overtraining)}%</div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">Acute 7d</div>
          <div className="mt-1 font-semibold">{formatKg(loadState?.acute_load_7d)}</div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">Chronic 28d</div>
          <div className="mt-1 font-semibold">{formatKg(loadState?.chronic_load_28d)}</div>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
        <Activity className="h-3.5 w-3.5" />
        Keep ACWR around 0.8-1.3 for sustainable progression.
      </div>
    </Card>
  );
}

