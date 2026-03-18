"use client";

import { memo, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { SessionExercise, SessionWorkoutLog, SetStatus } from "./types";
import type { ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";

type SetDraft = {
  setNumber: number;
  actualWeightKg: string;
  actualReps: string;
  actualRpe: string;
  setStatus: SetStatus;
  saved: boolean;
  saving: boolean;
  error: string | null;
  performedAt: string | null;
};

const actionBadgeClass: Record<ExerciseRecommendation["progression_action"], string> = {
  increase: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  maintain: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  reduce: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  deload: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  substitute: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function formatAction(action: ExerciseRecommendation["progression_action"]) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function rowToNumber(text: string) {
  if (!text.trim()) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSetStatus(value: unknown): SetStatus {
  const normalized = String(value ?? "completed").toLowerCase();
  if (normalized === "failed" || normalized === "skipped" || normalized === "warmup") {
    return normalized as SetStatus;
  }
  return "completed";
}

export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  workoutLog,
  completed,
  canStartExercises,
  isActive,
  onSetActive,
  onSetSaved,
  onSetDeleted,
}: {
  exercise: SessionExercise;
  workoutLog: SessionWorkoutLog | null;
  completed: boolean;
  canStartExercises: boolean;
  isActive: boolean;
  onSetActive: () => void;
  onSetSaved: (payload: {
    setNumber: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    setStatus: SetStatus;
    allSets: unknown;
    exerciseUpdate: unknown;
    workoutUpdate: unknown;
    personalRecord: unknown;
  }) => void;
  onSetDeleted: (payload: {
    setNumber: number;
    allSets: unknown;
    exerciseUpdate: unknown;
    workoutUpdate: unknown;
  }) => void;
}) {
  const [drafts, setDrafts] = useState<SetDraft[]>([]);

  // Sync state with props
  useEffect(() => {
    setDrafts((currentDrafts) => {
      const serverBySet = new Map(exercise.sets.map((setRow) => [setRow.set_number, setRow]));
      const currentBySet = new Map(currentDrafts.map((row) => [row.setNumber, row]));
      
      const maxServerNumber = exercise.sets.length > 0 ? Math.max(...exercise.sets.map((s) => s.set_number)) : 0;
      const maxCurrentNumber = currentDrafts.length > 0 ? Math.max(...currentDrafts.map((s) => s.setNumber)) : 0;
      const count = Math.max(exercise.recommended_sets, exercise.sets.length, currentDrafts.length, maxServerNumber, maxCurrentNumber, 1);

      return Array.from({ length: count }).map((_, idx) => {
        const setNumber = idx + 1;
        const server = serverBySet.get(setNumber);
        const current = currentBySet.get(setNumber);
        
        return {
          setNumber,
          actualWeightKg:
            server?.actual_weight_kg === null || server?.actual_weight_kg === undefined
              ? current?.actualWeightKg ?? exercise.recommended_weight?.toString() ?? ""
              : String(server.actual_weight_kg),
          actualReps:
            server?.actual_reps === null || server?.actual_reps === undefined
              ? current?.actualReps ?? String(exercise.recommended_reps.min)
              : String(server.actual_reps),
          actualRpe:
            server?.actual_rpe === null || server?.actual_rpe === undefined
              ? current?.actualRpe ?? ""
              : String(server.actual_rpe),
          setStatus: parseSetStatus(server?.set_status ?? current?.setStatus ?? "completed"),
          saved: Boolean(server),
          saving: current?.saving ?? false,
          error: current?.error ?? null,
          performedAt: server?.performed_at ?? current?.performedAt ?? null,
        };
      });
    });
  }, [exercise]);

  const updateRow = (setNumber: number, updater: (row: SetDraft) => SetDraft) => {
    setDrafts((prev) => prev.map((row) => (row.setNumber === setNumber ? updater(row) : row)));
  };

  const adjustWeight = (setNumber: number, delta: number) => {
    updateRow(setNumber, (current) => {
      const currentValue = rowToNumber(current.actualWeightKg) ?? 0;
      const next = Math.max(0, Math.min(1500, currentValue + delta));
      return { ...current, actualWeightKg: next.toFixed(1), saved: false, error: null };
    });
  };

  const adjustReps = (setNumber: number, delta: number) => {
    updateRow(setNumber, (current) => {
      const currentValue = rowToNumber(current.actualReps) ?? 0;
      const next = Math.max(0, Math.min(200, currentValue + delta));
      return { ...current, actualReps: String(Math.round(next)), saved: false, error: null };
    });
  };

  const adjustRpe = (setNumber: number, delta: number) => {
    updateRow(setNumber, (current) => {
      const currentValue = rowToNumber(current.actualRpe) ?? 0;
      const next = Math.max(0, Math.min(10, currentValue + delta));
      return { ...current, actualRpe: next.toFixed(1), saved: false, error: null };
    });
  };

  const addSetRow = () => {
    setDrafts((prev) => {
      const nextSetNumber = prev.length > 0 ? Math.max(...prev.map((r) => r.setNumber)) + 1 : 1;
      if (nextSetNumber > 30) return prev;
      return [
        ...prev,
        {
          setNumber: nextSetNumber,
          actualWeightKg: exercise.recommended_weight?.toString() ?? "",
          actualReps: String(exercise.recommended_reps.min),
          actualRpe: "",
          setStatus: "completed",
          saved: false,
          saving: false,
          error: null,
          performedAt: null,
        },
      ];
    });
  };

  const saveSet = async (row: SetDraft) => {
    if (!workoutLog || completed) return;
    if (!canStartExercises) {
      updateRow(row.setNumber, (current) => ({ ...current, error: "Complete warmup before logging exercise sets." }));
      return;
    }
    const weight = rowToNumber(row.actualWeightKg);
    const reps = rowToNumber(row.actualReps);
    const rpe = rowToNumber(row.actualRpe);

    if (row.setStatus === "completed" && (reps === null || reps < 1)) {
      updateRow(row.setNumber, (current) => ({ ...current, error: "Completed sets require reps >= 1" }));
      return;
    }

    updateRow(row.setNumber, (current) => ({ ...current, saving: true, error: null }));

    try {
      const response = await fetch("/api/workout/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: workoutLog.id,
          workoutLogExerciseId: exercise.workout_log_exercise_id,
          setNumber: row.setNumber,
          actualWeightKg: weight,
          actualReps: reps,
          actualRpe: rpe,
          setStatus: row.setStatus,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save set");

      onSetSaved({
        setNumber: row.setNumber,
        weight,
        reps,
        rpe,
        setStatus: row.setStatus,
        allSets: payload.allSets,
        exerciseUpdate: payload.exercise,
        workoutUpdate: payload.workout,
        personalRecord: payload.personalRecord,
      });
    } catch (err) {
      updateRow(row.setNumber, (current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save set",
      }));
    }
  };

  const deleteSet = async (row: SetDraft) => {
    if (!workoutLog || completed) return;
    if (!canStartExercises) {
      updateRow(row.setNumber, (current) => ({ ...current, error: "Complete warmup before editing exercise sets." }));
      return;
    }
    if (!row.saved) {
      setDrafts((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item.setNumber !== row.setNumber);
      });
      return;
    }

    updateRow(row.setNumber, (current) => ({ ...current, saving: true, error: null }));
    try {
      const response = await fetch("/api/workout/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: workoutLog.id,
          workoutLogExerciseId: exercise.workout_log_exercise_id,
          setNumber: row.setNumber,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to remove set");

      onSetDeleted({
        setNumber: row.setNumber,
        allSets: payload.allSets,
        exerciseUpdate: payload.exercise,
        workoutUpdate: payload.workout,
      });
    } catch (err) {
      updateRow(row.setNumber, (current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to remove set",
      }));
    }
  };

  return (
    <Card className={`p-4 sm:p-5 ${isActive ? "ring-2 ring-day-accent-primary dark:ring-night-accent" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{exercise.exercise_name}</h2>
          <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
            Recommended: {exercise.recommended_sets} sets x {exercise.recommended_reps.min}-{exercise.recommended_reps.max} reps | Weight: {exercise.recommended_weight === null ? "Auto" : `${exercise.recommended_weight} kg`} | Rest: {exercise.rest_seconds}s
          </p>
          {exercise.superset_group ? (
            <p className="mt-1 text-[11px] font-medium text-day-text-secondary dark:text-night-text-secondary">
              Superset Group: {exercise.superset_group}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={actionBadgeClass[exercise.progression_action]} variant="ghost">
            {formatAction(exercise.progression_action)}
          </Badge>
          <Button size="sm" variant="ghost" onClick={onSetActive}>
            {isActive ? "Current" : "Set Current"}
          </Button>
        </div>
      </div>

      {exercise.recommendation_reason.length > 0 ? (
        <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
          {exercise.recommendation_reason.join(" | ")}
        </p>
      ) : null}

      {!canStartExercises ? (
        <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
          Complete warmup to unlock set logging.
        </p>
      ) : null}

      <div className="mt-3 rounded-lg border border-day-border bg-day-hover/70 px-3 py-2 text-xs dark:border-night-border dark:bg-night-hover/50">
        Completed sets: {exercise.completed_sets}/{exercise.recommended_sets} | Total reps: {exercise.total_reps} | Volume: {exercise.total_volume_kg.toFixed(2)} kg
      </div>

      <div className="mt-4 space-y-3">
        {drafts.map((row) => (
          <div key={row.setNumber} className="rounded-lg border border-day-border bg-day-card p-3 dark:border-night-border dark:bg-night-card">
            <div className="grid gap-2 md:grid-cols-12">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold">Set {row.setNumber}</p>
              </div>
              
              {/* Weight */}
              <div className="md:col-span-2 flex items-center gap-1">
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustWeight(row.setNumber, -2.5)}>-</button>
                <input className="input-field flex-1" type="number" min={0} max={1500} step={0.1} placeholder="Weight" value={row.actualWeightKg} disabled={row.saving || completed || !canStartExercises} onChange={(event) => updateRow(row.setNumber, (current) => ({ ...current, actualWeightKg: event.target.value, saved: false, error: null }))} />
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustWeight(row.setNumber, 2.5)}>+</button>
              </div>

              {/* Reps */}
              <div className="md:col-span-2 flex items-center gap-1">
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustReps(row.setNumber, -1)}>-</button>
                <input className="input-field flex-1" type="number" min={0} max={200} step={1} placeholder="Reps" value={row.actualReps} disabled={row.saving || completed || !canStartExercises} onChange={(event) => updateRow(row.setNumber, (current) => ({ ...current, actualReps: event.target.value, saved: false, error: null }))} />
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustReps(row.setNumber, 1)}>+</button>
              </div>

              {/* RPE */}
              <div className="md:col-span-2 flex items-center gap-1">
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustRpe(row.setNumber, -0.5)}>-</button>
                <input className="input-field flex-1" type="number" min={0} max={10} step={0.1} placeholder="RPE" value={row.actualRpe} disabled={row.saving || completed || !canStartExercises} onChange={(event) => updateRow(row.setNumber, (current) => ({ ...current, actualRpe: event.target.value, saved: false, error: null }))} />
                <button type="button" className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border" disabled={row.saving || completed || !canStartExercises} onClick={() => adjustRpe(row.setNumber, 0.5)}>+</button>
              </div>

              <select className="input-field md:col-span-2" value={row.setStatus} disabled={row.saving || completed || !canStartExercises} onChange={(event) => updateRow(row.setNumber, (current) => ({ ...current, setStatus: parseSetStatus(event.target.value), saved: false, error: null }))}>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="warmup">Warmup</option>
              </select>

              <div className="flex gap-2 md:col-span-2">
                <Button size="sm" disabled={row.saving || completed || !canStartExercises} icon={row.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined} onClick={() => void saveSet(row)}>Save</Button>
                <Button size="sm" variant="ghost" disabled={row.saving || completed || !canStartExercises} onClick={() => void deleteSet(row)}>Remove</Button>
              </div>
            </div>

            {row.error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{row.error}</p> : null}
            {row.saved && row.performedAt ? <p className="mt-2 text-[11px] text-day-text-secondary dark:text-night-text-secondary">Saved at {new Date(row.performedAt).toLocaleTimeString()}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Button size="sm" variant="ghost" disabled={completed || !canStartExercises} onClick={addSetRow}>Add Set</Button>
      </div>
    </Card>
  );
});
