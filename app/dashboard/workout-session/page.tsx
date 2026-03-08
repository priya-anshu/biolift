"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, Loader2, Play, Pause, RefreshCcw, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type {
  ExerciseRecommendation,
  TrainingIntelligenceResult,
} from "@/lib/workout-planner/intelligenceEngine";

type SetStatus = "completed" | "failed" | "skipped" | "warmup";

type SessionSet = {
  id: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  set_status: SetStatus;
  performed_at: string | null;
};

type SessionExercise = {
  workout_log_exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  exercise_order: number;
  recommended_sets: number;
  recommended_reps: { min: number; max: number };
  recommended_weight: number | null;
  rest_seconds: number;
  progression_action: ExerciseRecommendation["progression_action"];
  recommendation_reason: string[];
  completed_sets: number;
  total_reps: number;
  total_volume_kg: number;
  completed: boolean;
  sets: SessionSet[];
};

type SessionWorkoutLog = {
  id: string;
  workout_date: string;
  status: string;
  completion_percentage: number;
  total_exercises: number;
  exercises_completed: number;
};

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

type PersonalRecordBadge = {
  workoutLogExerciseId: string;
  setNumber: number;
};

const actionBadgeClass: Record<ExerciseRecommendation["progression_action"], string> = {
  increase: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  maintain: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  reduce: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  deload: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  substitute: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return toNumber(value, 0);
}

function parseSetStatus(value: unknown): SetStatus {
  const normalized = String(value ?? "completed").toLowerCase();
  if (normalized === "failed" || normalized === "skipped" || normalized === "warmup") {
    return normalized;
  }
  return "completed";
}

function toAction(value: unknown): ExerciseRecommendation["progression_action"] {
  const normalized = String(value ?? "maintain").toLowerCase();
  if (
    normalized === "increase" ||
    normalized === "maintain" ||
    normalized === "reduce" ||
    normalized === "deload" ||
    normalized === "substitute"
  ) {
    return normalized;
  }
  return "maintain";
}

function formatAction(action: ExerciseRecommendation["progression_action"]) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function rowToNumber(text: string) {
  if (!text.trim()) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function WorkoutSessionPage() {
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingIntelligenceResult | null>(null);
  const [workoutLog, setWorkoutLog] = useState<SessionWorkoutLog | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft[]>>({});
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [prBadge, setPrBadge] = useState<PersonalRecordBadge | null>(null);
  const [finishing, setFinishing] = useState(false);

  const completed = workoutLog?.status === "completed";

  const progress = useMemo(() => {
    const targetSets = exercises.reduce((sum, row) => sum + row.recommended_sets, 0);
    const doneSets = exercises.reduce((sum, row) => sum + row.completed_sets, 0);
    const pct = targetSets > 0 ? (doneSets / targetSets) * 100 : 0;
    return { targetSets, doneSets, pct };
  }, [exercises]);

  const hydrateDrafts = useCallback(
    (
      rows: SessionExercise[],
      previousDrafts: Record<string, SetDraft[]> = {},
    ) => {
    const next: Record<string, SetDraft[]> = {};
    rows.forEach((exercise) => {
      const serverBySet = new Map(exercise.sets.map((setRow) => [setRow.set_number, setRow]));
      const currentRows = previousDrafts[exercise.workout_log_exercise_id] ?? [];
      const currentBySet = new Map(currentRows.map((row) => [row.setNumber, row]));
      const maxServerNumber =
        exercise.sets.length > 0 ? Math.max(...exercise.sets.map((setRow) => setRow.set_number)) : 0;
      const maxCurrentNumber =
        currentRows.length > 0 ? Math.max(...currentRows.map((row) => row.setNumber)) : 0;
      const count = Math.max(
        exercise.recommended_sets,
        exercise.sets.length,
        currentRows.length,
        maxServerNumber,
        maxCurrentNumber,
        1,
      );
      next[exercise.workout_log_exercise_id] = Array.from({ length: count }).map((_, idx) => {
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
          saving: false,
          error: null,
          performedAt: server?.performed_at ?? current?.performedAt ?? null,
        };
      });
    });
    setSetDrafts(next);
    },
    [],
  );

  const initializeSession = useCallback(async () => {
    setInitializing(true);
    setError(null);
    setNotice(null);
    try {
      const workoutDate = todayDateKey();
      const recRes = await fetch(
        `/api/workout-planner/recommendations?workoutDate=${workoutDate}&lookbackDays=42`,
        { cache: "no-store" },
      );
      const recPayload = (await recRes.json()) as {
        recommendations?: TrainingIntelligenceResult;
        error?: string;
      };
      if (!recRes.ok || !recPayload.recommendations) {
        throw new Error(recPayload.error ?? "Failed to load recommendations");
      }
      setResult(recPayload.recommendations);

      const logRes = await fetch("/api/workout-planner/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: workoutDate,
          planId: recPayload.recommendations.plan_id,
          status: "in_progress",
          source: "planner",
        }),
      });
      const logPayload = (await logRes.json()) as {
        log?: SessionWorkoutLog;
        error?: string;
      };
      if (!logRes.ok || !logPayload.log) {
        throw new Error(logPayload.error ?? "Failed to create workout log");
      }

      const startRes = await fetch("/api/workout-session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: logPayload.log.id,
          recommendations: recPayload.recommendations.recommendations,
        }),
      });
      const startPayload = (await startRes.json()) as {
        workoutLog?: SessionWorkoutLog;
        exercises?: Array<Record<string, unknown>>;
        error?: string;
      };
      if (!startRes.ok) {
        throw new Error(startPayload.error ?? "Failed to start session");
      }

      const parsedExercises: SessionExercise[] = (startPayload.exercises ?? [])
        .map((row) => ({
          workout_log_exercise_id: String(row.workout_log_exercise_id ?? ""),
          exercise_name: String(row.exercise_name ?? "Exercise"),
          muscle_group: String(row.muscle_group ?? ""),
          exercise_order: Math.max(1, Math.floor(toNumber(row.exercise_order, 1))),
          recommended_sets: Math.max(1, Math.floor(toNumber(row.recommended_sets, 1))),
          recommended_reps: {
            min: Math.max(
              1,
              Math.floor(
                toNumber((row.recommended_reps as { min?: unknown } | undefined)?.min, 6),
              ),
            ),
            max: Math.max(
              1,
              Math.floor(
                toNumber((row.recommended_reps as { max?: unknown } | undefined)?.max, 8),
              ),
            ),
          },
          recommended_weight: toNullableNumber(row.recommended_weight),
          rest_seconds: Math.max(15, Math.floor(toNumber(row.rest_seconds, 60))),
          progression_action: toAction(row.progression_action),
          recommendation_reason: Array.isArray(row.recommendation_reason)
            ? row.recommendation_reason.map((item) => String(item))
            : [],
          completed_sets: Math.max(0, Math.floor(toNumber(row.completed_sets, 0))),
          total_reps: Math.max(0, Math.floor(toNumber(row.total_reps, 0))),
          total_volume_kg: Number(toNumber(row.total_volume_kg, 0).toFixed(2)),
          completed: Boolean(row.completed),
          sets: Array.isArray(row.sets)
            ? row.sets
                .map((setRow) => ({
                  id: String((setRow as Record<string, unknown>).id ?? ""),
                  set_number: Math.max(
                    1,
                    Math.floor(toNumber((setRow as Record<string, unknown>).set_number, 1)),
                  ),
                  actual_weight_kg: toNullableNumber(
                    (setRow as Record<string, unknown>).actual_weight_kg,
                  ),
                  actual_reps: toNullableNumber(
                    (setRow as Record<string, unknown>).actual_reps,
                  ),
                  actual_rpe: toNullableNumber((setRow as Record<string, unknown>).actual_rpe),
                  set_status: parseSetStatus(
                    (setRow as Record<string, unknown>).set_status,
                  ),
                  performed_at: ((setRow as Record<string, unknown>).performed_at ??
                    null) as string | null,
                }))
                .sort((a, b) => a.set_number - b.set_number)
            : [],
        }))
        .sort((a, b) => a.exercise_order - b.exercise_order);

      setWorkoutLog(startPayload.workoutLog ?? logPayload.log);
      setExercises(parsedExercises);
      hydrateDrafts(parsedExercises);
      setActiveExerciseId(
        parsedExercises.find((row) => !row.completed)?.workout_log_exercise_id ??
          parsedExercises[0]?.workout_log_exercise_id ??
          null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setInitializing(false);
    }
  }, [hydrateDrafts]);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

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
  }, [restRunning, restSeconds]);

  useEffect(() => {
    if (!prBadge) return;
    const timeout = setTimeout(() => setPrBadge(null), 3500);
    return () => clearTimeout(timeout);
  }, [prBadge]);

  const updateRow = (exerciseId: string, setNumber: number, updater: (row: SetDraft) => SetDraft) => {
    setSetDrafts((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] ?? []).map((row) =>
        row.setNumber === setNumber ? updater(row) : row,
      ),
    }));
  };

  const addSetRow = (exercise: SessionExercise) => {
    setSetDrafts((prev) => {
      const current = prev[exercise.workout_log_exercise_id] ?? [];
      const nextSetNumber = current.length > 0 ? Math.max(...current.map((row) => row.setNumber)) + 1 : 1;
      if (nextSetNumber > 30) return prev;
      return {
        ...prev,
        [exercise.workout_log_exercise_id]: [
          ...current,
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
        ],
      };
    });
  };

  const applyServerPatch = (
    exerciseId: string,
    allSetsRaw: unknown,
    exerciseRaw: unknown,
    workoutRaw: unknown,
  ) => {
    const allSets: SessionSet[] = Array.isArray(allSetsRaw)
      ? allSetsRaw
          .map((row) => ({
            id: String((row as Record<string, unknown>).id ?? ""),
            set_number: Math.max(
              1,
              Math.floor(toNumber((row as Record<string, unknown>).set_number, 1)),
            ),
            actual_weight_kg: toNullableNumber(
              (row as Record<string, unknown>).actual_weight_kg,
            ),
            actual_reps: toNullableNumber((row as Record<string, unknown>).actual_reps),
            actual_rpe: toNullableNumber((row as Record<string, unknown>).actual_rpe),
            set_status: parseSetStatus((row as Record<string, unknown>).set_status),
            performed_at: ((row as Record<string, unknown>).performed_at ?? null) as string | null,
          }))
          .sort((a, b) => a.set_number - b.set_number)
      : [];

    const exercisePatch = exerciseRaw as Record<string, unknown> | undefined;
    let nextRows: SessionExercise[] = [];
    setExercises((prev) => {
      nextRows = prev.map((exercise) => {
        if (exercise.workout_log_exercise_id !== exerciseId) return exercise;
        return {
          ...exercise,
          sets: allSets,
          completed_sets: Math.max(
            0,
            Math.floor(toNumber(exercisePatch?.completed_sets, exercise.completed_sets)),
          ),
          total_reps: Math.max(0, Math.floor(toNumber(exercisePatch?.total_reps, exercise.total_reps))),
          total_volume_kg: Number(
            toNumber(exercisePatch?.total_volume_kg, exercise.total_volume_kg).toFixed(2),
          ),
          completed: Boolean(exercisePatch?.completed ?? exercise.completed),
        };
      });
      return nextRows;
    });
    if (nextRows.length > 0) {
      hydrateDrafts(nextRows, setDrafts);
      const activeRow = nextRows.find(
        (row) => row.workout_log_exercise_id === activeExerciseId,
      );
      if (activeRow?.completed) {
        setActiveExerciseId(
          nextRows.find((row) => !row.completed)?.workout_log_exercise_id ??
            activeRow.workout_log_exercise_id,
        );
      }
    }

    const workoutPatch = workoutRaw as Record<string, unknown> | undefined;
    if (workoutPatch) {
      setWorkoutLog((prev) =>
        prev
          ? {
              ...prev,
              status: String(workoutPatch.status ?? prev.status),
              completion_percentage: Number(
                toNumber(workoutPatch.completion_percentage, prev.completion_percentage).toFixed(2),
              ),
              total_exercises: Math.max(
                0,
                Math.floor(toNumber(workoutPatch.total_exercises, prev.total_exercises)),
              ),
              exercises_completed: Math.max(
                0,
                Math.floor(toNumber(workoutPatch.exercises_completed, prev.exercises_completed)),
              ),
            }
          : prev,
      );
    }
  };

  const saveSet = async (exercise: SessionExercise, row: SetDraft) => {
    if (!workoutLog || completed) return;
    const weight = rowToNumber(row.actualWeightKg);
    const reps = rowToNumber(row.actualReps);
    const rpe = rowToNumber(row.actualRpe);

    if (row.setStatus === "completed" && (reps === null || reps < 1)) {
      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
        ...current,
        error: "Completed sets require reps >= 1",
      }));
      return;
    }

    updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
      ...current,
      saving: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/workout-session/sets", {
        method: "POST",
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
      const payload = (await response.json()) as {
        allSets?: unknown;
        exercise?: unknown;
        workout?: unknown;
        personalRecord?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save set");
      }
      applyServerPatch(
        exercise.workout_log_exercise_id,
        payload.allSets,
        payload.exercise,
        payload.workout,
      );
      setRestSeconds(exercise.rest_seconds);
      setRestRunning(true);
      if (payload.personalRecord) {
        setPrBadge({
          workoutLogExerciseId: exercise.workout_log_exercise_id,
          setNumber: row.setNumber,
        });
      }
    } catch (err) {
      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save set",
      }));
    }
  };

  const deleteSet = async (exercise: SessionExercise, row: SetDraft) => {
    if (!workoutLog || completed) return;
    if (!row.saved) {
      setSetDrafts((prev) => {
        const current = prev[exercise.workout_log_exercise_id] ?? [];
        if (current.length <= 1) return prev;
        return {
          ...prev,
          [exercise.workout_log_exercise_id]: current.filter(
            (item) => item.setNumber !== row.setNumber,
          ),
        };
      });
      return;
    }

    updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
      ...current,
      saving: true,
      error: null,
    }));
    try {
      const response = await fetch("/api/workout-session/sets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: workoutLog.id,
          workoutLogExerciseId: exercise.workout_log_exercise_id,
          setNumber: row.setNumber,
        }),
      });
      const payload = (await response.json()) as {
        allSets?: unknown;
        exercise?: unknown;
        workout?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove set");
      }
      applyServerPatch(
        exercise.workout_log_exercise_id,
        payload.allSets,
        payload.exercise,
        payload.workout,
      );
    } catch (err) {
      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : "Failed to remove set",
      }));
    }
  };

  const finishWorkout = async () => {
    if (!workoutLog || completed) return;
    setFinishing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/workout-session/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: workoutLog.id,
          calendarStatus: "completed",
        }),
      });
      const payload = (await response.json()) as {
        workoutLog?: SessionWorkoutLog;
        error?: string;
      };
      if (!response.ok || !payload.workoutLog) {
        throw new Error(payload.error ?? "Failed to finish workout");
      }
      setWorkoutLog(payload.workoutLog);
      setNotice("Workout completed and saved.");
      setRestRunning(false);
      setRestSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish workout");
    } finally {
      setFinishing(false);
    }
  };

  if (initializing) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    );
  }

  if (error && !workoutLog) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Workout Session</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        <div className="mt-4">
          <Button onClick={initializeSession} icon={<RefreshCcw className="h-4 w-4" />}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Workout Session</h1>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              {workoutLog ? `Date: ${workoutLog.workout_date}` : "No active log"}
            </p>
            {result ? (
              <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                Readiness: {result.readiness_band.toUpperCase()} | Fatigue: {result.fatigue_score}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={initializeSession}
              icon={<RefreshCcw className="h-4 w-4" />}
            >
              Reload
            </Button>
            <Button onClick={finishWorkout} loading={finishing} disabled={completed}>
              {completed ? "Workout Finished" : "Finish Workout"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">Progress</p>
            <p className="mt-1 text-lg font-semibold">
              {progress.doneSets}/{progress.targetSets} sets
            </p>
          </div>
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Exercise Completion
            </p>
            <p className="mt-1 text-lg font-semibold">
              {exercises.filter((row) => row.completed).length}/{exercises.length}
            </p>
          </div>
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">Rest Timer</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <Clock3 className="h-4 w-4" />
              {formatClock(restSeconds)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
            <div
              className="h-2 rounded-full bg-linear-primary transition-all dark:bg-linear-night"
              style={{ width: `${Math.max(0, Math.min(progress.pct, 100))}%` }}
            />
          </div>
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
        </div>

        {notice ? (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </Card>

      {exercises.map((exercise) => (
        <Card
          key={exercise.workout_log_exercise_id}
          className={`p-4 sm:p-5 ${
            activeExerciseId === exercise.workout_log_exercise_id
              ? "ring-2 ring-day-accent-primary dark:ring-night-accent"
              : ""
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{exercise.exercise_name}</h2>
              <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                Recommended: {exercise.recommended_sets} sets x {exercise.recommended_reps.min}-
                {exercise.recommended_reps.max} reps | Weight:{" "}
                {exercise.recommended_weight === null
                  ? "Auto"
                  : `${exercise.recommended_weight} kg`}{" "}
                | Rest: {exercise.rest_seconds}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={actionBadgeClass[exercise.progression_action]} variant="ghost">
                {formatAction(exercise.progression_action)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveExerciseId(exercise.workout_log_exercise_id)}
              >
                {activeExerciseId === exercise.workout_log_exercise_id
                  ? "Current"
                  : "Set Current"}
              </Button>
            </div>
          </div>

          {exercise.recommendation_reason.length > 0 ? (
            <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
              {exercise.recommendation_reason.join(" | ")}
            </p>
          ) : null}

          <div className="mt-3 rounded-lg border border-day-border bg-day-hover/70 px-3 py-2 text-xs dark:border-night-border dark:bg-night-hover/50">
            Completed sets: {exercise.completed_sets}/{exercise.recommended_sets} | Total reps:{" "}
            {exercise.total_reps} | Volume: {exercise.total_volume_kg.toFixed(2)} kg
          </div>

          <div className="mt-4 space-y-3">
            {(setDrafts[exercise.workout_log_exercise_id] ?? []).map((row) => (
              <div
                key={`${exercise.workout_log_exercise_id}-${row.setNumber}`}
                className="rounded-lg border border-day-border bg-day-card p-3 dark:border-night-border dark:bg-night-card"
              >
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold">Set {row.setNumber}</p>
                  </div>
                  <input
                    className="input-field md:col-span-2"
                    placeholder="Weight"
                    value={row.actualWeightKg}
                    disabled={row.saving || completed}
                    onChange={(event) =>
                      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                        ...current,
                        actualWeightKg: event.target.value,
                        saved: false,
                        error: null,
                      }))
                    }
                  />
                  <input
                    className="input-field md:col-span-2"
                    placeholder="Reps"
                    value={row.actualReps}
                    disabled={row.saving || completed}
                    onChange={(event) =>
                      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                        ...current,
                        actualReps: event.target.value,
                        saved: false,
                        error: null,
                      }))
                    }
                  />
                  <input
                    className="input-field md:col-span-2"
                    placeholder="RPE (optional)"
                    value={row.actualRpe}
                    disabled={row.saving || completed}
                    onChange={(event) =>
                      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                        ...current,
                        actualRpe: event.target.value,
                        saved: false,
                        error: null,
                      }))
                    }
                  />
                  <select
                    className="input-field md:col-span-2"
                    value={row.setStatus}
                    disabled={row.saving || completed}
                    onChange={(event) =>
                      updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                        ...current,
                        setStatus: parseSetStatus(event.target.value),
                        saved: false,
                        error: null,
                      }))
                    }
                  >
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="skipped">Skipped</option>
                    <option value="warmup">Warmup</option>
                  </select>
                  <div className="flex gap-2 md:col-span-2">
                    <Button
                      size="sm"
                      disabled={row.saving || completed}
                      icon={row.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                      onClick={() => void saveSet(exercise, row)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={row.saving || completed}
                      onClick={() => void deleteSet(exercise, row)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {row.error ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{row.error}</p>
                ) : null}
                {row.saved && row.performedAt ? (
                  <p className="mt-2 text-[11px] text-day-text-secondary dark:text-night-text-secondary">
                    Saved at {new Date(row.performedAt).toLocaleTimeString()}
                  </p>
                ) : null}
                {prBadge?.workoutLogExerciseId === exercise.workout_log_exercise_id &&
                prBadge?.setNumber === row.setNumber ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    New Personal Record!
                  </motion.div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={completed}
              onClick={() => addSetRow(exercise)}
            >
              Add Set
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
