"use client";

import { Shield, Moon } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type RecoveryState = {
  readiness_score?: number | null;
  fatigue_score?: number | null;
  sleep_minutes?: number | null;
  soreness?: number | null;
  stress?: number | null;
  recommendation?: string | null;
} | null;

type RecoveryStatusCardProps = {
  recovery: RecoveryState;
};

function readinessBand(readiness: number) {
  if (readiness >= 65) {
    return { label: "Ready", color: "bg-emerald-500", badge: "success" as const };
  }
  if (readiness >= 40) {
    return { label: "Moderate", color: "bg-amber-500", badge: "warning" as const };
  }
  return { label: "Recover", color: "bg-red-500", badge: "danger" as const };
}

function formatSleep(minutes: number) {
  const hrs = minutes / 60;
  return `${hrs.toFixed(1)} h`;
}

export default function RecoveryStatusCard({ recovery }: RecoveryStatusCardProps) {
  const readiness = Math.max(0, Math.min(100, Number(recovery?.readiness_score ?? 50)));
  const fatigue = Math.max(0, Math.min(100, Number(recovery?.fatigue_score ?? 50)));
  const sleepMinutes = Number(recovery?.sleep_minutes ?? 0);
  const soreness = Number(recovery?.soreness ?? 0);
  const stress = Number(recovery?.stress ?? 0);
  const band = readinessBand(readiness);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-emerald-500" />
            Recovery Status
          </div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Readiness and fatigue signals from `recovery_state`.
          </p>
        </div>
        <Badge variant={band.badge} size="sm">
          {band.label}
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs text-day-text-secondary dark:text-night-text-secondary">
            <span>Readiness</span>
            <span>{Math.round(readiness)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
            <div className={`h-2 rounded-full ${band.color}`} style={{ width: `${readiness}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-day-text-secondary dark:text-night-text-secondary">
            <span>Fatigue</span>
            <span>{Math.round(fatigue)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
            <div
              className="h-2 rounded-full bg-orange-500"
              style={{ width: `${Math.max(0, Math.min(fatigue, 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 text-center dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">Sleep</div>
          <div className="mt-1 flex items-center justify-center gap-1 font-semibold">
            <Moon className="h-3.5 w-3.5" />
            {sleepMinutes > 0 ? formatSleep(sleepMinutes) : "-"}
          </div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 text-center dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">Soreness</div>
          <div className="mt-1 font-semibold">{soreness > 0 ? soreness : "-"}</div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 text-center dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">Stress</div>
          <div className="mt-1 font-semibold">{stress > 0 ? stress : "-"}</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-day-text-secondary dark:text-night-text-secondary">
        {recovery?.recommendation ?? "Log recovery signals to keep AI recommendations accurate."}
      </p>
    </Card>
  );
}

