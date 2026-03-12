"use client";

import { CalendarCheck, Flame, Target } from "lucide-react";
import Card from "@/components/ui/Card";

type ConsistencyTrackerProps = {
  weeklyWorkouts: number;
  streakDays: number;
  consistencyScore: number;
};

export default function ConsistencyTracker({
  weeklyWorkouts,
  streakDays,
  consistencyScore,
}: ConsistencyTrackerProps) {
  const normalized = Math.max(0, Math.min(100, consistencyScore));

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Target className="h-4 w-4 text-violet-500" />
        Consistency Tracker
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">
            Workout Streak
          </div>
          <div className="mt-1 flex items-center gap-1 text-base font-semibold">
            <Flame className="h-4 w-4 text-orange-500" />
            {Math.max(0, Math.floor(streakDays))} days
          </div>
        </div>
        <div className="rounded-lg border border-day-border bg-day-hover/60 p-2 dark:border-night-border dark:bg-night-hover/50">
          <div className="text-day-text-secondary dark:text-night-text-secondary">
            Workouts (7d)
          </div>
          <div className="mt-1 flex items-center gap-1 text-base font-semibold">
            <CalendarCheck className="h-4 w-4 text-sky-500" />
            {Math.max(0, Math.floor(weeklyWorkouts))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-day-text-secondary dark:text-night-text-secondary">
          <span>Consistency Score</span>
          <span>{Math.round(normalized)}%</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
          <div
            className="h-2 rounded-full bg-violet-500"
            style={{ width: `${normalized}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

