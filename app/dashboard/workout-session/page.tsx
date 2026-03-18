"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PersonalRecordAlert from "@/components/workout/PersonalRecordAlert";
import WorkoutProgressRing from "@/components/workout/WorkoutProgressRing";
import { WorkoutTimer, WorkoutTimerControls } from "@/components/workout/WorkoutTimer";
import { SessionControls } from "@/components/workout/SessionControls";
import { ExerciseList } from "@/components/workout/ExerciseList";

import type { TrainingIntelligenceResult, ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";
import type { SessionSet, SessionExercise, SessionWorkoutLog, SetStatus } from "@/components/workout/types";

type PersonalRecordBadge = {
  workoutLogExerciseId: string;
  setNumber: number;
  exerciseName: string;
  weightKg: number | null;
  reps: number | null;
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
    return normalized as SetStatus;
  }
  return "completed";
}

function toAction(value: unknown): ExerciseRecommendation["progression_action"] {
  const normalized = String(value ?? "maintain").toLowerCase();
  if (normalized === "increase" || normalized === "maintain" || normalized === "reduce" || normalized === "deload" || normalized === "substitute") {
    return normalized as ExerciseRecommendation["progression_action"];
  }
  return "maintain";
}

export default function WorkoutSessionPage() {
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingIntelligenceResult | null>(null);
  const [workoutLog, setWorkoutLog] = useState<SessionWorkoutLog | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
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
      { key: "warmup", label: "Warmup", done: warmupCompleted, active: !warmupCompleted },
      ...exerciseSteps,
      { key: "cooldown", label: "Cooldown", done: cooldownCompleted, active: canFinishCooldown && !cooldownCompleted },
    ];
  }, [activeExerciseId, canFinishCooldown, cooldownCompleted, exercises, warmupCompleted]);

  const initializeSession = useCallback(async () => {
    setInitializing(true);
    setError(null);
    setNotice(null);
    setRequiresPlan(false);
    try {
      const workoutDate = todayDateKey();
      const sessionRes = await fetch(`/api/workout/session?workoutDate=${workoutDate}&lookbackDays=42`, { cache: "no-store" });
      const sessionPayload = await sessionRes.json();
      
      if (!sessionRes.ok) throw new Error(sessionPayload.error ?? "Failed to initialize workout session");
      if (sessionPayload.requiresPlan) {
        setRequiresPlan(true);
        setWorkoutLog(null);
        setExercises([]);
        setResult(null);
        return;
      }
      
      setResult(sessionPayload.recommendations ?? null);

      const parsedExercises: SessionExercise[] = (sessionPayload.exercises ?? []).map((row: any) => ({
        workout_log_exercise_id: String(row.workout_log_exercise_id ?? ""),
        exercise_name: String(row.exercise_name ?? "Exercise"),
        muscle_group: String(row.muscle_group ?? ""),
        superset_group: typeof row.superset_group === "string" && row.superset_group.trim().length > 0 ? row.superset_group.trim().toUpperCase() : null,
        exercise_order: Math.max(1, Math.floor(toNumber(row.exercise_order, 1))),
        recommended_sets: Math.max(1, Math.floor(toNumber(row.recommended_sets, 1))),
        recommended_reps: { min: Math.max(1, Math.floor(toNumber((row.recommended_reps)?.min, 6))), max: Math.max(1, Math.floor(toNumber((row.recommended_reps)?.max, 8))) },
        recommended_weight: toNullableNumber(row.recommended_weight),
        rest_seconds: Math.max(15, Math.floor(toNumber(row.rest_seconds, 60))),
        progression_action: toAction(row.progression_action),
        recommendation_reason: Array.isArray(row.recommendation_reason) ? row.recommendation_reason.map(String) : [],
        completed_sets: Math.max(0, Math.floor(toNumber(row.completed_sets, 0))),
        total_reps: Math.max(0, Math.floor(toNumber(row.total_reps, 0))),
        total_volume_kg: Number(toNumber(row.total_volume_kg, 0).toFixed(2)),
        completed: Boolean(row.completed),
        sets: Array.isArray(row.sets) ? row.sets.map((setRow: any) => ({
          id: String(setRow.id ?? ""),
          set_number: Math.max(1, Math.floor(toNumber(setRow.set_number, 1))),
          actual_weight_kg: toNullableNumber(setRow.actual_weight_kg),
          actual_reps: toNullableNumber(setRow.actual_reps),
          actual_rpe: toNullableNumber(setRow.actual_rpe),
          set_status: parseSetStatus(setRow.set_status),
          performed_at: (setRow.performed_at ?? null) as string | null,
        })).sort((a: any, b: any) => a.set_number - b.set_number) : [],
      })).sort((a: any, b: any) => a.exercise_order - b.exercise_order);

      if (!sessionPayload.workoutLog) throw new Error("Missing workout log from session response");

      setWorkoutLog(sessionPayload.workoutLog);
      setExercises(parsedExercises);
      setActiveExerciseId(parsedExercises.find((row: any) => !row.completed)?.workout_log_exercise_id ?? parsedExercises[0]?.workout_log_exercise_id ?? null);
      setWarmupCompleted(parsedExercises.some((row: any) => row.completed_sets > 0));
      setCooldownCompleted(sessionPayload.workoutLog.status === "completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!prBadge) return;
    const timeout = setTimeout(() => setPrBadge(null), 3500);
    return () => clearTimeout(timeout);
  }, [prBadge]);

  const applyServerPatch = useCallback((
    exerciseId: string,
    allSetsRaw: unknown,
    exerciseRaw: unknown,
    workoutRaw: unknown,
  ) => {
    const allSets: SessionSet[] = Array.isArray(allSetsRaw) ? allSetsRaw.map((row) => ({
      id: String((row as any).id ?? ""),
      set_number: Math.max(1, Math.floor(toNumber((row as any).set_number, 1))),
      actual_weight_kg: toNullableNumber((row as any).actual_weight_kg),
      actual_reps: toNullableNumber((row as any).actual_reps),
      actual_rpe: toNullableNumber((row as any).actual_rpe),
      set_status: parseSetStatus((row as any).set_status),
      performed_at: ((row as any).performed_at ?? null) as string | null,
    })).sort((a, b) => a.set_number - b.set_number) : [];

    const exercisePatch = exerciseRaw as any;
    let nextRows: SessionExercise[] = [];
    
    setExercises((prev) => {
      nextRows = prev.map((exercise) => {
        if (exercise.workout_log_exercise_id !== exerciseId) return exercise;
        return {
          ...exercise,
          sets: allSets,
          completed_sets: Math.max(0, Math.floor(toNumber(exercisePatch?.completed_sets, exercise.completed_sets))),
          total_reps: Math.max(0, Math.floor(toNumber(exercisePatch?.total_reps, exercise.total_reps))),
          total_volume_kg: Number(toNumber(exercisePatch?.total_volume_kg, exercise.total_volume_kg).toFixed(2)),
          completed: Boolean(exercisePatch?.completed ?? exercise.completed),
        };
      });
      return nextRows;
    });

    if (nextRows.length > 0) {
      const activeRow = nextRows.find((row) => row.workout_log_exercise_id === activeExerciseId);
      if (activeRow?.completed) {
        setActiveExerciseId(nextRows.find((row) => !row.completed)?.workout_log_exercise_id ?? activeRow.workout_log_exercise_id);
      }
    }

    const workoutPatch = workoutRaw as any;
    if (workoutPatch) {
      setWorkoutLog((prev) => prev ? {
        ...prev,
        status: String(workoutPatch.status ?? prev.status),
        completion_percentage: Number(toNumber(workoutPatch.completion_percentage, prev.completion_percentage).toFixed(2)),
        total_exercises: Math.max(0, Math.floor(toNumber(workoutPatch.total_exercises, prev.total_exercises))),
        exercises_completed: Math.max(0, Math.floor(toNumber(workoutPatch.exercises_completed, prev.exercises_completed))),
      } : prev);
    }
  }, [activeExerciseId]);

  const onSetSaved = useCallback((exerciseId: string, payload: any) => {
    applyServerPatch(exerciseId, payload.allSets, payload.exerciseUpdate, payload.workoutUpdate);
    const exercise = exercises.find(e => e.workout_log_exercise_id === exerciseId);
    if (exercise) {
      setRestSeconds(exercise.rest_seconds);
      setRestRunning(true);
      if (payload.personalRecord) {
        setPrBadge({
          workoutLogExerciseId: exerciseId,
          setNumber: payload.setNumber,
          exerciseName: exercise.exercise_name,
          weightKg: payload.weight,
          reps: payload.reps,
        });
      }
    }
  }, [applyServerPatch, exercises]);

  const onSetDeleted = useCallback((exerciseId: string, payload: any) => {
    applyServerPatch(exerciseId, payload.allSets, payload.exerciseUpdate, payload.workoutUpdate);
  }, [applyServerPatch]);

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
      const payload = await response.json();
      if (!response.ok || !payload.workoutLog) throw new Error(payload.error ?? "Failed to finish workout");
      
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
          <Link href="/dashboard/workout-planner" className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent">
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
          <Button onClick={initializeSession} icon={<RefreshCcw className="h-4 w-4" />}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PersonalRecordAlert visible={Boolean(prBadge)} exerciseName={prBadge?.exerciseName} weightKg={prBadge?.weightKg} reps={prBadge?.reps} />

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
            <Button variant="ghost" onClick={initializeSession} icon={<RefreshCcw className="h-4 w-4" />}>Reload</Button>
            <Button onClick={finishWorkout} loading={finishing} disabled={completed || !cooldownCompleted}>
              {completed ? "Workout Finished" : "Finish Workout"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">Progress</p>
            <div className="mt-2">
              <WorkoutProgressRing completedSets={progress.doneSets} totalSets={progress.targetSets} size={88} />
            </div>
          </div>
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">Exercise Completion</p>
            <p className="mt-1 text-lg font-semibold">{exercises.filter((row) => row.completed).length}/{exercises.length}</p>
          </div>
          <WorkoutTimer restSeconds={restSeconds} restRunning={restRunning} setRestSeconds={setRestSeconds} setRestRunning={setRestRunning} />
        </div>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
            <div className="h-2 rounded-full bg-linear-primary transition-all dark:bg-linear-night" style={{ width: `${Math.max(0, Math.min(progress.pct, 100))}%` }} />
          </div>
          <WorkoutTimerControls restRunning={restRunning} setRestRunning={setRestRunning} setRestSeconds={setRestSeconds} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">Session Flow</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {flowSteps.map((step) => (
              <div key={step.key} className={`rounded-lg border px-3 py-2 text-xs font-medium ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300" : step.active ? "border-day-accent-primary bg-sky-50 text-day-accent-primary dark:border-night-accent dark:bg-night-hover dark:text-night-accent" : "border-day-border bg-day-hover/60 text-day-text-secondary dark:border-night-border dark:bg-night-hover/40 dark:text-night-text-secondary"}`}>
                {step.label}
              </div>
            ))}
          </div>
        </div>

        {notice ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        {!completed ? (
          <SessionControls
            finishMood={finishMood}
            setFinishMood={setFinishMood}
            finishCalories={finishCalories}
            setFinishCalories={setFinishCalories}
            finishNotes={finishNotes}
            setFinishNotes={setFinishNotes}
          />
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Warmup</h2>
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">5-8 min movement prep, dynamic mobility, and ramp-up sets.</p>
          </div>
          <Button size="sm" variant={warmupCompleted ? "ghost" : "primary"} onClick={() => setWarmupCompleted(true)} disabled={warmupCompleted}>
            {warmupCompleted ? "Warmup Complete" : "Complete Warmup"}
          </Button>
        </div>
      </Card>

      <ExerciseList
        exercises={exercises}
        workoutLog={workoutLog}
        completed={completed}
        canStartExercises={canStartExercises}
        activeExerciseId={activeExerciseId}
        setActiveExerciseId={setActiveExerciseId}
        onSetSaved={onSetSaved}
        onSetDeleted={onSetDeleted}
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cooldown</h2>
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">3-5 min cooldown walk, breathing reset, and mobility work.</p>
          </div>
          <Button size="sm" variant={cooldownCompleted ? "ghost" : "primary"} onClick={() => setCooldownCompleted(true)} disabled={!canFinishCooldown || cooldownCompleted}>
            {cooldownCompleted ? "Cooldown Complete" : "Complete Cooldown"}
          </Button>
        </div>
        {!canFinishCooldown && !cooldownCompleted ? (
          <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">Finish all prescribed exercises before cooldown.</p>
        ) : null}
      </Card>
    </div>
  );
}
