"use client";

import { memo, useEffect } from "react";
import { Clock3, Play, Pause } from "lucide-react";
import Button from "@/components/ui/Button";

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const WorkoutTimer = memo(function WorkoutTimer({
  restSeconds,
  restRunning,
  setRestSeconds,
  setRestRunning,
}: {
  restSeconds: number;
  restRunning: boolean;
  setRestSeconds: (value: number | ((prev: number) => number)) => void;
  setRestRunning: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  useEffect(() => {
    if (!restRunning || restSeconds <= 0) return;
    const timer = setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning, restSeconds, setRestRunning, setRestSeconds]);

  return (
    <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">Rest Timer</p>
      <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
        <Clock3 className="h-4 w-4" />
        {formatClock(restSeconds)}
      </p>
    </div>
  );
});

export const WorkoutTimerControls = memo(function WorkoutTimerControls({
  restRunning,
  setRestRunning,
  setRestSeconds,
}: {
  restRunning: boolean;
  setRestRunning: (value: boolean | ((prev: boolean) => boolean)) => void;
  setRestSeconds: (value: number) => void;
}) {
  return (
    <div className="mt-2 flex gap-2">
      <Button
        size="sm"
        variant="ghost"
        icon={restRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        onClick={() => setRestRunning((prev) => !prev)}
      >
        {restRunning ? "Pause Rest" : "Start Rest"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setRestRunning(false);
          setRestSeconds(0);
        }}
      >
        Reset Rest
      </Button>
    </div>
  );
});
