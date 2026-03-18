"use client";

import { memo } from "react";

export const SessionControls = memo(function SessionControls({
  finishMood,
  setFinishMood,
  finishCalories,
  setFinishCalories,
  finishNotes,
  setFinishNotes,
}: {
  finishMood: string;
  setFinishMood: (val: string) => void;
  finishCalories: string;
  setFinishCalories: (val: string) => void;
  finishNotes: string;
  setFinishNotes: (val: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-day-border bg-day-hover/60 p-3 dark:border-night-border dark:bg-night-hover/50 sm:grid-cols-3">
      <label className="space-y-1 text-xs">
        <span className="text-day-text-secondary dark:text-night-text-secondary">
          Workout Mood
        </span>
        <select
          className="input-field"
          value={finishMood}
          onChange={(event) => setFinishMood(event.target.value)}
        >
          <option value="great">Great</option>
          <option value="good">Good</option>
          <option value="neutral">Neutral</option>
          <option value="low">Low Energy</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-day-text-secondary dark:text-night-text-secondary">
          Calories Burned (optional)
        </span>
        <input
          className="input-field"
          type="number"
          min={0}
          max={100000}
          value={finishCalories}
          onChange={(event) => setFinishCalories(event.target.value)}
        />
      </label>
      <label className="space-y-1 text-xs sm:col-span-3">
        <span className="text-day-text-secondary dark:text-night-text-secondary">
          Notes (optional)
        </span>
        <textarea
          rows={2}
          className="input-field"
          value={finishNotes}
          onChange={(event) => setFinishNotes(event.target.value)}
          placeholder="How did the session feel?"
        />
      </label>
    </div>
  );
});
