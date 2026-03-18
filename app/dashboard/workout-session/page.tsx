"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Dumbbell,
  Heart,
  Pause,
  Play,
  RefreshCcw,
  SkipBack,
  SkipForward,
  Target,
  Timer,
  X,
  Zap,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PersonalRecordAlert from "@/components/workout/PersonalRecordAlert";
import { WorkoutTimerControls } from "@/components/workout/WorkoutTimer";
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

type SetMutationPayload = {
  allSets?: unknown;
  exerciseUpdate?: unknown;
  workoutUpdate?: unknown;
  personalRecord?: unknown;
  setNumber?: unknown;
  weight?: unknown;
  reps?: unknown;
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatSeconds(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
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

function asRecord(value: unknown) {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function parseSessionSet(row: unknown): SessionSet {
  const setRow = asRecord(row);
  return {
    id: String(setRow.id ?? ""),
    set_number: Math.max(1, Math.floor(toNumber(setRow.set_number, 1))),
    actual_weight_kg: toNullableNumber(setRow.actual_weight_kg),
    actual_reps: toNullableNumber(setRow.actual_reps),
    actual_rpe: toNullableNumber(setRow.actual_rpe),
    set_status: parseSetStatus(setRow.set_status),
    performed_at: (setRow.performed_at ?? null) as string | null,
  };
}

function parseSessionExercise(row: unknown): SessionExercise {
  const exerciseRow = asRecord(row);
  const recommendedReps = asRecord(exerciseRow.recommended_reps);

  return {
    workout_log_exercise_id: String(exerciseRow.workout_log_exercise_id ?? ""),
    exercise_name: String(exerciseRow.exercise_name ?? "Exercise"),
    muscle_group: String(exerciseRow.muscle_group ?? ""),
    superset_group:
      typeof exerciseRow.superset_group === "string" &&
      exerciseRow.superset_group.trim().length > 0
        ? exerciseRow.superset_group.trim().toUpperCase()
        : null,
    exercise_order: Math.max(1, Math.floor(toNumber(exerciseRow.exercise_order, 1))),
    recommended_sets: Math.max(1, Math.floor(toNumber(exerciseRow.recommended_sets, 1))),
    recommended_reps: {
      min: Math.max(1, Math.floor(toNumber(recommendedReps.min, 6))),
      max: Math.max(1, Math.floor(toNumber(recommendedReps.max, 8))),
    },
    recommended_weight: toNullableNumber(exerciseRow.recommended_weight),
    rest_seconds: Math.max(15, Math.floor(toNumber(exerciseRow.rest_seconds, 60))),
    progression_action: toAction(exerciseRow.progression_action),
    recommendation_reason: Array.isArray(exerciseRow.recommendation_reason)
      ? exerciseRow.recommendation_reason.map(String)
      : [],
    completed_sets: Math.max(0, Math.floor(toNumber(exerciseRow.completed_sets, 0))),
    total_reps: Math.max(0, Math.floor(toNumber(exerciseRow.total_reps, 0))),
    total_volume_kg: Number(toNumber(exerciseRow.total_volume_kg, 0).toFixed(2)),
    completed: Boolean(exerciseRow.completed),
    sets: Array.isArray(exerciseRow.sets)
      ? exerciseRow.sets.map(parseSessionSet).sort((a, b) => a.set_number - b.set_number)
      : [],
  };
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

  const activeExerciseIndex = useMemo(
    () => exercises.findIndex((exercise) => exercise.workout_log_exercise_id === activeExerciseId),
    [activeExerciseId, exercises],
  );

  const activeExercise =
    activeExerciseIndex >= 0 ? exercises[activeExerciseIndex] : exercises[0] ?? null;

  const completedExercises = useMemo(
    () => exercises.filter((exercise) => exercise.completed).length,
    [exercises],
  );

  const sessionPercent = Math.round(Math.max(0, Math.min(progress.pct, 100)));

  const displayedRestSeconds =
    restRunning || restSeconds > 0 ? restSeconds : activeExercise?.rest_seconds ?? 0;

  const headerTitle =
    activeExercise?.muscle_group && activeExercise.muscle_group.trim().length > 0
      ? `${activeExercise.muscle_group} Session`
      : "Workout Session";

  const handlePreviousExercise = useCallback(() => {
    if (activeExerciseIndex <= 0) return;
    setActiveExerciseId(exercises[activeExerciseIndex - 1]?.workout_log_exercise_id ?? null);
  }, [activeExerciseIndex, exercises]);

  const handleNextExercise = useCallback(() => {
    if (activeExerciseIndex < 0 || activeExerciseIndex >= exercises.length - 1) return;
    setActiveExerciseId(exercises[activeExerciseIndex + 1]?.workout_log_exercise_id ?? null);
  }, [activeExerciseIndex, exercises]);

  const handlePlayPauseTimer = useCallback(() => {
    if (!restRunning && restSeconds <= 0 && activeExercise) {
      setRestSeconds(activeExercise.rest_seconds);
    }
    setRestRunning((current) => !current);
  }, [activeExercise, restRunning, restSeconds]);

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

      const parsedExercises: SessionExercise[] = Array.isArray(sessionPayload.exercises)
        ? sessionPayload.exercises
            .map(parseSessionExercise)
            .sort((a, b) => a.exercise_order - b.exercise_order)
        : [];

      if (!sessionPayload.workoutLog) throw new Error("Missing workout log from session response");

      setWorkoutLog(sessionPayload.workoutLog);
      setExercises(parsedExercises);
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
    const allSets: SessionSet[] = Array.isArray(allSetsRaw)
      ? allSetsRaw.map(parseSessionSet).sort((a, b) => a.set_number - b.set_number)
      : [];

    const exercisePatch = asRecord(exerciseRaw);
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

    const workoutPatch = asRecord(workoutRaw);
    if (Object.keys(workoutPatch).length > 0) {
      setWorkoutLog((prev) => prev ? {
        ...prev,
        status: String(workoutPatch.status ?? prev.status),
        completion_percentage: Number(toNumber(workoutPatch.completion_percentage, prev.completion_percentage).toFixed(2)),
        total_exercises: Math.max(0, Math.floor(toNumber(workoutPatch.total_exercises, prev.total_exercises))),
        exercises_completed: Math.max(0, Math.floor(toNumber(workoutPatch.exercises_completed, prev.exercises_completed))),
      } : prev);
    }
  }, [activeExerciseId]);

  const onSetSaved = useCallback((exerciseId: string, payload: SetMutationPayload) => {
    applyServerPatch(exerciseId, payload.allSets, payload.exerciseUpdate, payload.workoutUpdate);
    const exercise = exercises.find(e => e.workout_log_exercise_id === exerciseId);
    if (exercise) {
      setRestSeconds(exercise.rest_seconds);
      setRestRunning(true);
      if (payload.personalRecord) {
        setPrBadge({
          workoutLogExerciseId: exerciseId,
          setNumber: Math.max(1, Math.floor(toNumber(payload.setNumber, 1))),
          exerciseName: exercise.exercise_name,
          weightKg: toNullableNumber(payload.weight),
          reps: toNullableNumber(payload.reps),
        });
      }
    }
  }, [applyServerPatch, exercises]);

  const onSetDeleted = useCallback((exerciseId: string, payload: SetMutationPayload) => {
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
    <div className="space-y-6">
      <PersonalRecordAlert visible={Boolean(prBadge)} exerciseName={prBadge?.exerciseName} weightKg={prBadge?.weightKg} reps={prBadge?.reps} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
              {headerTitle}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{workoutLog?.workout_date ?? todayDateKey()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                <span>{exercises.length} exercises</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4" />
                <span>{sessionPercent}% complete</span>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg p-2 text-day-text-secondary transition hover:bg-day-hover hover:text-day-text-primary dark:text-night-text-secondary dark:hover:bg-night-hover dark:hover:text-night-text-primary"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
        {notice ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-day-accent-primary/15 to-day-accent-secondary/15 dark:from-night-accent/20 dark:to-red-600/20">
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-day-accent-primary dark:bg-night-card/80 dark:text-night-accent">
                    <Dumbbell className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                      Active Exercise
                    </p>
                    <h2 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                      {activeExercise?.exercise_name ?? "Session Overview"}
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {activeExercise?.exercise_name ?? "Workout Session"}
              </h3>
              <span className="rounded-full bg-day-accent-primary px-3 py-1 text-sm font-semibold text-white dark:bg-night-accent">
                {Math.max(activeExerciseIndex + 1, 1)} of {Math.max(exercises.length, 1)}
              </span>
            </div>

            <p className="mt-2 text-day-text-secondary dark:text-night-text-secondary">
              {activeExercise?.recommendation_reason[0] ??
                "Complete the prescribed sets and log your workout as you move through the session."}
            </p>

            {activeExercise ? (
              <div className="mt-4 rounded-lg bg-day-hover p-4 dark:bg-night-hover">
                <h4 className="mb-2 font-semibold text-day-text-primary dark:text-night-text-primary">
                  Exercise Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Muscle Group:{" "}
                    </span>
                    <span className="capitalize text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.muscle_group || "General"}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Progression:{" "}
                    </span>
                    <span className="capitalize text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.progression_action}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Rest Time:{" "}
                    </span>
                    <span className="text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.rest_seconds}s
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Target Load:{" "}
                    </span>
                    <span className="text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.recommended_weight ? `${activeExercise.recommended_weight} kg` : "Bodyweight"}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Target Reps:{" "}
                    </span>
                    <span className="text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.recommended_reps.min}-{activeExercise.recommended_reps.max}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Logged Sets:{" "}
                    </span>
                    <span className="text-day-text-primary dark:text-night-text-primary">
                      {activeExercise.completed_sets}/{activeExercise.recommended_sets}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-center space-x-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={handlePreviousExercise}
                disabled={activeExerciseIndex <= 0}
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={handlePlayPauseTimer}
                className="h-16 w-16 rounded-full"
              >
                {restRunning ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={handleNextExercise}
                disabled={activeExerciseIndex < 0 || activeExerciseIndex >= exercises.length - 1}
              >
                <SkipForward className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex items-center justify-center space-x-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {displayedRestSeconds}s
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Rest Time
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {activeExercise?.recommended_sets ?? 0}
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Sets
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {activeExercise
                    ? `${activeExercise.recommended_reps.min}-${activeExercise.recommended_reps.max}`
                    : "--"}
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Reps
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                Workout Progress
              </h3>
              <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {sessionPercent}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-day-border dark:bg-night-border">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-day-accent-primary to-day-accent-secondary transition-all duration-300 dark:from-night-accent dark:to-red-600"
                style={{ width: `${sessionPercent}%` }}
              />
            </div>
            <div className="mt-4">
              <WorkoutTimerControls
                restRunning={restRunning}
                setRestRunning={setRestRunning}
                setRestSeconds={setRestSeconds}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Workout Stats
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Exercises Completed
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {completedExercises}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Total Sets
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {progress.targetSets}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Timer
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatSeconds(displayedRestSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Readiness
                </span>
                <span className="font-semibold capitalize text-day-text-primary dark:text-night-text-primary">
                  {result?.readiness_band ?? workoutLog?.status ?? "active"}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Exercise List
            </h3>
            <div className="space-y-3">
              {exercises.map((exercise, index) => (
                <button
                  key={exercise.workout_log_exercise_id}
                  type="button"
                  className={`w-full rounded-lg p-3 text-left transition-colors ${
                    exercise.workout_log_exercise_id === activeExerciseId
                      ? "border border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                      : exercise.completed
                        ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "bg-day-hover hover:bg-day-border dark:bg-night-hover dark:hover:bg-night-border"
                  }`}
                  onClick={() => setActiveExerciseId(exercise.workout_log_exercise_id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center space-x-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-day-border dark:bg-night-border">
                        <Dumbbell className="h-5 w-5 text-day-text-secondary dark:text-night-text-secondary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-day-text-primary dark:text-night-text-primary">
                          {exercise.exercise_name}
                        </h4>
                        <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          {exercise.recommended_sets} sets x {exercise.recommended_reps.min}-{exercise.recommended_reps.max}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {exercise.completed ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                          OK
                        </div>
                      ) : exercise.workout_log_exercise_id === activeExerciseId ? (
                        <div className="h-4 w-4 rounded-full bg-day-accent-primary animate-pulse dark:bg-night-accent" />
                      ) : null}
                      <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button variant="ghost" fullWidth onClick={initializeSession}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload Session
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setWarmupCompleted(true)} disabled={warmupCompleted}>
                <Target className="mr-2 h-4 w-4" />
                {warmupCompleted ? "Warmup Complete" : "Complete Warmup"}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setCooldownCompleted(true)}
                disabled={!canFinishCooldown || cooldownCompleted}
              >
                <Timer className="mr-2 h-4 w-4" />
                {cooldownCompleted ? "Cooldown Complete" : "Complete Cooldown"}
              </Button>
              <Link
                href="/dashboard/workouts"
                className="inline-flex w-full items-center justify-center rounded-lg border border-day-border px-4 py-2 text-sm font-medium text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                <Heart className="mr-2 h-4 w-4" />
                Workout History
              </Link>
              <Button
                onClick={finishWorkout}
                loading={finishing}
                disabled={completed || !cooldownCompleted}
                fullWidth
              >
                <Zap className="mr-2 h-4 w-4" />
                {completed ? "Workout Finished" : "Finish Workout"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {!completed ? (
        <Card className="p-6">
          <SessionControls
            finishMood={finishMood}
            setFinishMood={setFinishMood}
            finishCalories={finishCalories}
            setFinishCalories={setFinishCalories}
            finishNotes={finishNotes}
            setFinishNotes={setFinishNotes}
          />
        </Card>
      ) : null}

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
    </div>
  );
}
