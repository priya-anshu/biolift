"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, Play, Pause, RefreshCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PersonalRecordAlert from "@/components/workout/PersonalRecordAlert";
import WorkoutProgressRing from "@/components/workout/WorkoutProgressRing";
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
  superset_group: string | null;
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
  exerciseName: string;
  weightKg: number | null;
  reps: number | null;
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
  const [warmupCompleted, setWarmupCompleted] = useState(false);
  const [cooldownCompleted, setCooldownCompleted] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [prBadge, setPrBadge] = useState<PersonalRecordBadge | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [requiresPlan, setRequiresPlan] = useState(false);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishCalories, setFinishCalories] = useState("");
  const [finishMood, setFinishMood] = useState("neutral");

  const completed = workoutLog?.status === "completed";

  const progress = useMemo(() => {
    const targetSets = exercises.reduce((sum, row) => sum + row.recommended_sets, 0);
    const doneSets = exercises.reduce((sum, row) => sum + row.completed_sets, 0);
    const pct = targetSets > 0 ? (doneSets / targetSets) * 100 : 0;
    return { targetSets, doneSets, pct };
  }, [exercises]);

  const canStartExercises = warmupCompleted;
  const allExercisesCompleted = exercises.length > 0 && exercises.every((row) => row.completed);
  const canFinishCooldown = warmupCompleted && allExercisesCompleted;

  const flowSteps = useMemo(() => {
    const exerciseSteps = exercises.map((exercise, index) => ({
      key: exercise.workout_log_exercise_id,
      label: `Exercise ${index + 1}: ${exercise.exercise_name}`,
      done: exercise.completed,
      active: activeExerciseId === exercise.workout_log_exercise_id,
    }));
    return [
      {
        key: "warmup",
        label: "Warmup",
        done: warmupCompleted,
        active: !warmupCompleted,
      },
      ...exerciseSteps,
      {
        key: "cooldown",
        label: "Cooldown",
        done: cooldownCompleted,
        active: canFinishCooldown && !cooldownCompleted,
      },
    ];
  }, [
    activeExerciseId,
    canFinishCooldown,
    cooldownCompleted,
    exercises,
    warmupCompleted,
  ]);

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
    setRequiresPlan(false);
    try {
      const workoutDate = todayDateKey();
      const sessionRes = await fetch(
        `/api/workout/session?workoutDate=${workoutDate}&lookbackDays=42`,
        { cache: "no-store" },
      );
      const sessionPayload = (await sessionRes.json()) as {
        workoutLog?: SessionWorkoutLog;
        recommendations?: TrainingIntelligenceResult;
        exercises?: Array<Record<string, unknown>>;
        requiresPlan?: boolean;
        error?: string;
      };
      if (!sessionRes.ok) {
        throw new Error(sessionPayload.error ?? "Failed to initialize workout session");
      }
      if (sessionPayload.requiresPlan) {
        setRequiresPlan(true);
        setWorkoutLog(null);
        setExercises([]);
        setSetDrafts({});
        setResult(null);
        return;
      }
      setResult(sessionPayload.recommendations ?? null);

      const parsedExercises: SessionExercise[] = (sessionPayload.exercises ?? [])
        .map((row) => ({
          workout_log_exercise_id: String(row.workout_log_exercise_id ?? ""),
          exercise_name: String(row.exercise_name ?? "Exercise"),
          muscle_group: String(row.muscle_group ?? ""),
          superset_group:
            typeof row.superset_group === "string" && row.superset_group.trim().length > 0
              ? row.superset_group.trim().toUpperCase()
              : null,
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

      if (!sessionPayload.workoutLog) {
        throw new Error("Missing workout log from session response");
      }
      setWorkoutLog(sessionPayload.workoutLog);
      setExercises(parsedExercises);
      hydrateDrafts(parsedExercises);
      setActiveExerciseId(
        parsedExercises.find((row) => !row.completed)?.workout_log_exercise_id ??
          parsedExercises[0]?.workout_log_exercise_id ??
          null,
      );
      setWarmupCompleted(parsedExercises.some((row) => row.completed_sets > 0));
      setCooldownCompleted(sessionPayload.workoutLog.status === "completed");
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

  const adjustWeight = (exerciseId: string, setNumber: number, delta: number) => {
    updateRow(exerciseId, setNumber, (current) => {
      const currentValue = rowToNumber(current.actualWeightKg) ?? 0;
      const next = Math.max(0, Math.min(1500, currentValue + delta));
      return {
        ...current,
        actualWeightKg: next.toFixed(1),
        saved: false,
        error: null,
      };
    });
  };

  const adjustReps = (exerciseId: string, setNumber: number, delta: number) => {
    updateRow(exerciseId, setNumber, (current) => {
      const currentValue = rowToNumber(current.actualReps) ?? 0;
      const next = Math.max(0, Math.min(200, currentValue + delta));
      return {
        ...current,
        actualReps: String(Math.round(next)),
        saved: false,
        error: null,
      };
    });
  };

  const adjustRpe = (exerciseId: string, setNumber: number, delta: number) => {
    updateRow(exerciseId, setNumber, (current) => {
      const currentValue = rowToNumber(current.actualRpe) ?? 0;
      const next = Math.max(0, Math.min(10, currentValue + delta));
      return {
        ...current,
        actualRpe: next.toFixed(1),
        saved: false,
        error: null,
      };
    });
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
    if (!canStartExercises) {
      setError("Complete warmup before logging exercise sets.");
      return;
    }
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
          exerciseName: exercise.exercise_name,
          weightKg: weight,
          reps,
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
    if (!canStartExercises) {
      setError("Complete warmup before editing exercise sets.");
      return;
    }
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
      const response = await fetch("/api/workout/session", {
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
      const notes = finishNotes.trim();
      const response = await fetch("/api/workout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutLogId: workoutLog.id,
          calendarStatus: "completed",
          caloriesBurned: finishCalories.trim().length > 0 ? Number(finishCalories) : null,
          notes: notes.length > 0 ? notes : null,
          workoutMood: finishMood,
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
      setFinishNotes("");
      setFinishCalories("");
      setFinishMood("neutral");
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

  if (requiresPlan) {
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Workout Session</h1>
        <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
          Generate your first workout plan before starting a session.
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/workout-planner"
            className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
          >
            Generate Your First Workout Plan
          </Link>
        </div>
      </Card>
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
      <PersonalRecordAlert
        visible={Boolean(prBadge)}
        exerciseName={prBadge?.exerciseName}
        weightKg={prBadge?.weightKg}
        reps={prBadge?.reps}
      />

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
            <Button
              onClick={finishWorkout}
              loading={finishing}
              disabled={completed || !cooldownCompleted}
            >
              {completed ? "Workout Finished" : "Finish Workout"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Progress
            </p>
            <div className="mt-2">
              <WorkoutProgressRing
                completedSets={progress.doneSets}
                totalSets={progress.targetSets}
                size={88}
              />
            </div>
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

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
            Session Flow
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {flowSteps.map((step) => (
              <div
                key={step.key}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  step.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : step.active
                      ? "border-day-accent-primary bg-sky-50 text-day-accent-primary dark:border-night-accent dark:bg-night-hover dark:text-night-accent"
                      : "border-day-border bg-day-hover/60 text-day-text-secondary dark:border-night-border dark:bg-night-hover/40 dark:text-night-text-secondary"
                }`}
              >
                {step.label}
              </div>
            ))}
          </div>
        </div>

        {notice ? (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        {!completed ? (
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
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Warmup</h2>
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              5-8 min movement prep, dynamic mobility, and ramp-up sets.
            </p>
          </div>
          <Button
            size="sm"
            variant={warmupCompleted ? "ghost" : "primary"}
            onClick={() => setWarmupCompleted(true)}
            disabled={warmupCompleted}
          >
            {warmupCompleted ? "Warmup Complete" : "Complete Warmup"}
          </Button>
        </div>
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

          {!canStartExercises ? (
            <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
              Complete warmup to unlock set logging.
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
                  <div className="md:col-span-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustWeight(exercise.workout_log_exercise_id, row.setNumber, -2.5)}
                    >
                      -
                    </button>
                    <input
                      className="input-field flex-1"
                      type="number"
                      min={0}
                      max={1500}
                      step={0.1}
                      placeholder="Weight"
                      value={row.actualWeightKg}
                      disabled={row.saving || completed || !canStartExercises}
                      onChange={(event) =>
                        updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                          ...current,
                          actualWeightKg: event.target.value,
                          saved: false,
                          error: null,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustWeight(exercise.workout_log_exercise_id, row.setNumber, 2.5)}
                    >
                      +
                    </button>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustReps(exercise.workout_log_exercise_id, row.setNumber, -1)}
                    >
                      -
                    </button>
                    <input
                      className="input-field flex-1"
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      placeholder="Reps"
                      value={row.actualReps}
                      disabled={row.saving || completed || !canStartExercises}
                      onChange={(event) =>
                        updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                          ...current,
                          actualReps: event.target.value,
                          saved: false,
                          error: null,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustReps(exercise.workout_log_exercise_id, row.setNumber, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustRpe(exercise.workout_log_exercise_id, row.setNumber, -0.5)}
                    >
                      -
                    </button>
                    <input
                      className="input-field flex-1"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      placeholder="RPE (optional)"
                      value={row.actualRpe}
                      disabled={row.saving || completed || !canStartExercises}
                      onChange={(event) =>
                        updateRow(exercise.workout_log_exercise_id, row.setNumber, (current) => ({
                          ...current,
                          actualRpe: event.target.value,
                          saved: false,
                          error: null,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-day-border px-2 py-1 text-xs dark:border-night-border"
                      disabled={row.saving || completed || !canStartExercises}
                      onClick={() => adjustRpe(exercise.workout_log_exercise_id, row.setNumber, 0.5)}
                    >
                      +
                    </button>
                  </div>
                  <select
                    className="input-field md:col-span-2"
                    value={row.setStatus}
                    disabled={row.saving || completed || !canStartExercises}
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
                      disabled={row.saving || completed || !canStartExercises}
                      icon={row.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                      onClick={() => void saveSet(exercise, row)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={row.saving || completed || !canStartExercises}
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
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={completed || !canStartExercises}
              onClick={() => addSetRow(exercise)}
            >
              Add Set
            </Button>
          </div>
        </Card>
      ))}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cooldown</h2>
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              3-5 min cooldown walk, breathing reset, and mobility work.
            </p>
          </div>
          <Button
            size="sm"
            variant={cooldownCompleted ? "ghost" : "primary"}
            onClick={() => setCooldownCompleted(true)}
            disabled={!canFinishCooldown || cooldownCompleted}
          >
            {cooldownCompleted ? "Cooldown Complete" : "Complete Cooldown"}
          </Button>
        </div>
        {!canFinishCooldown && !cooldownCompleted ? (
          <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Finish all prescribed exercises before cooldown.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
