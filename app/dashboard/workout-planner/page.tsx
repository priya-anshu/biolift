"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, RefreshCw, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

type ProgressionAction = "increase" | "maintain" | "reduce" | "deload" | "substitute";

type PlanRow = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  muscle_split: unknown;
  planning_mode: "smart" | "manual";
  is_active: boolean;
};

type WorkoutTodayResponse = {
  workoutDate: string;
  cacheState: string;
  cacheTtl?: {
    exists?: boolean;
    isStale?: boolean;
    updatedAt?: string | null;
  };
  plan: {
    id: string;
    name: string;
    goal: string;
    experience_level: string;
    workout_days_per_week: number;
    muscle_split: unknown;
    is_active: boolean;
  } | null;
  recommendations: {
    recommendations: Array<{
      plan_exercise_id: string;
      exercise_id: string | null;
      recommended_weight: number | null;
      recommended_reps: { min: number; max: number };
      recommended_sets: number;
      rest_seconds: number;
      progression_action: ProgressionAction;
      recommendation_reason: string[];
    }>;
  };
  previewExercises: Array<{
    plan_exercise_id: string;
    exercise_name: string;
    muscle_group: string;
    exercise_order: number;
    recommended_sets: number;
    recommended_reps: { min: number; max: number };
    recommended_weight: number | null;
    rest_seconds: number;
    progression_action: ProgressionAction;
    recommendation_reason: string[];
  }>;
  error?: string;
};

type SplitRow = {
  dayIndex: number;
  muscles: string[];
};

function normalizeGoal(goal: string) {
  return goal.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionBadgeClass(action: ProgressionAction) {
  if (action === "increase") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (action === "maintain") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  }
  if (action === "reduce") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (action === "deload") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  }
  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
}

function actionLabel(action: ProgressionAction) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseMuscleSplit(raw: unknown): SplitRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as { dayIndex?: unknown; muscles?: unknown };
      const dayIndex = Number(row.dayIndex ?? 0);
      if (!Number.isFinite(dayIndex) || dayIndex < 1 || dayIndex > 7) return null;
      const muscles = Array.isArray(row.muscles)
        ? row.muscles.map((value) => String(value)).filter(Boolean)
        : [];
      return { dayIndex, muscles };
    })
    .filter((row): row is SplitRow => row !== null)
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export default function WorkoutPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [today, setToday] = useState<WorkoutTodayResponse | null>(null);
  const [showWorkout, setShowWorkout] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planEditForm, setPlanEditForm] = useState({
    name: "",
    goal: "general_fitness",
    workoutDaysPerWeek: 4,
  });
  const [generateForm, setGenerateForm] = useState({
    name: "AI Smart Program",
    goal: "hypertrophy",
    experienceLevel: "intermediate",
    workoutDaysPerWeek: 4,
    splitPreference: "push_pull_legs",
  });

  const activePlan = useMemo(() => plans.find((plan) => plan.is_active) ?? null, [plans]);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? activePlan,
    [plans, selectedPlanId, activePlan],
  );
  const splitRows = useMemo(
    () => parseMuscleSplit(selectedPlan?.muscle_split),
    [selectedPlan?.muscle_split],
  );

  const loadPlans = useCallback(async () => {
    const response = await fetch("/api/workout-planner/plans", { cache: "no-store" });
    const payload = (await response.json()) as { plans?: PlanRow[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Failed to load plans");
    const nextPlans = payload.plans ?? [];
    setPlans(nextPlans);
    if (nextPlans.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    setSelectedPlanId((current) => {
      if (current && nextPlans.some((plan) => plan.id === current)) return current;
      return nextPlans.find((plan) => plan.is_active)?.id ?? nextPlans[0].id;
    });
  }, []);

  const loadToday = useCallback(async (planId: string | null) => {
    const params = new URLSearchParams({ lookbackDays: "42" });
    if (planId) params.set("planId", planId);
    const response = await fetch(`/api/workout/today?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as WorkoutTodayResponse;
    if (!response.ok) throw new Error(payload.error ?? "Failed to load workout");
    setToday(payload);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPlans();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load planner");
      setPlans([]);
      setToday(null);
    } finally {
      setLoading(false);
    }
  }, [loadPlans]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedPlanId) {
      setToday(null);
      return;
    }
    void loadToday(selectedPlanId).catch((loadError) => {
      setToday(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load workout");
    });
  }, [loadToday, selectedPlanId]);

  const setPlanActive = async (planId: string) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/workout-planner/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to activate plan");
      setNotice("Active program updated.");
      await loadPlans();
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Failed to activate plan");
    } finally {
      setIsBusy(false);
    }
  };

  const generatePlan = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/workout-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...generateForm,
          preferredEquipment: ["barbell", "dumbbells", "cable machine"],
          visibility: "private",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to generate plan");
      setNotice("New smart program generated.");
      await loadPlans();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate plan");
    } finally {
      setIsBusy(false);
    }
  };

  const beginEditPlan = (plan: PlanRow) => {
    setEditingPlanId(plan.id);
    setPlanEditForm({
      name: plan.name,
      goal: plan.goal,
      workoutDaysPerWeek: plan.workout_days_per_week,
    });
  };

  const savePlanEdit = async () => {
    if (!editingPlanId) return;
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/workout-planner/plans/${editingPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planEditForm.name,
          goal: planEditForm.goal,
          workoutDaysPerWeek: planEditForm.workoutDaysPerWeek,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to save plan");
      setNotice("Program updated.");
      setEditingPlanId(null);
      await loadPlans();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save plan");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workout Program</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Manage your current program. Execution happens in Workout Session.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdvancedMode((current) => !current)}
          className="rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
        >
          {advancedMode ? "Hide Advanced Settings" : "Advanced Settings"}
        </button>
      </section>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </Card>
      ) : null}
      {notice ? (
        <Card className="p-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-300">{notice}</p>
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
              Current Program
            </p>
            <h2 className="mt-1 text-xl font-semibold">{selectedPlan?.name ?? "No plan yet"}</h2>
            {selectedPlan ? (
              <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                Goal: {normalizeGoal(selectedPlan.goal)} | Level: {normalizeGoal(selectedPlan.experience_level)} | {selectedPlan.workout_days_per_week} days/week
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void generatePlan()}
              className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-night-accent"
            >
              {isBusy ? "Working..." : "Generate Plan"}
            </button>
            {advancedMode && selectedPlan ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => beginEditPlan(selectedPlan)}
                className="inline-flex items-center gap-1 rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover disabled:opacity-60 dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                <Pencil className="h-4 w-4" />
                Edit Plan
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowWorkout((current) => !current)}
              className="inline-flex items-center gap-1 rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
            >
              <CalendarDays className="h-4 w-4" />
              {showWorkout ? "Hide Full Workout" : "View Full Workout"}
            </button>
          </div>
        </div>

        {loading ? <div className="skeleton mt-4 h-24 rounded-lg" /> : null}

        {editingPlanId ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-day-border bg-day-hover/70 p-4 dark:border-night-border dark:bg-night-hover/60 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">Program Name</span>
              <input
                value={planEditForm.name}
                onChange={(event) =>
                  setPlanEditForm((current) => ({ ...current, name: event.target.value }))
                }
                className="input-field"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">Goal</span>
              <select
                value={planEditForm.goal}
                onChange={(event) =>
                  setPlanEditForm((current) => ({ ...current, goal: event.target.value }))
                }
                className="input-field"
              >
                <option value="fat_loss">Fat Loss</option>
                <option value="hypertrophy">Hypertrophy</option>
                <option value="strength">Strength</option>
                <option value="general_fitness">General Fitness</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-day-text-secondary dark:text-night-text-secondary">Days / Week</span>
              <input
                type="number"
                min={1}
                max={7}
                value={planEditForm.workoutDaysPerWeek}
                onChange={(event) =>
                  setPlanEditForm((current) => ({
                    ...current,
                    workoutDaysPerWeek: Math.max(1, Math.min(7, Number(event.target.value))),
                  }))
                }
                className="input-field"
              />
            </label>
            <div className="md:col-span-3 flex gap-2">
              <button
                type="button"
                onClick={() => void savePlanEdit()}
                className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingPlanId(null)}
                className="rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {selectedPlan ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-day-border bg-day-hover/70 p-4 dark:border-night-border dark:bg-night-hover/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="h-4 w-4 text-sky-500" />
                Workout Split
              </div>
              <div className="mt-3 space-y-2">
                {splitRows.length === 0 ? (
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">Split not defined yet.</p>
                ) : (
                  splitRows.map((row) => (
                    <div key={`split-${row.dayIndex}`} className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm dark:border-night-border dark:bg-night-card">
                      Day {row.dayIndex}: {row.muscles.join(", ") || "General"}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-day-border bg-day-hover/70 p-4 dark:border-night-border dark:bg-night-hover/60">
              <div className="text-sm font-semibold">Exercises Per Day</div>
              <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                AI recommendations are automatically applied to the active program.
              </p>
              <div className="mt-3 space-y-2">
                {(today?.previewExercises ?? []).length === 0 ? (
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Using baseline plan - recommendations adapt after logged sessions.
                  </p>
                ) : (
                  (today?.previewExercises ?? []).slice(0, 5).map((row) => (
                    <div key={row.plan_exercise_id} className="rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm dark:border-night-border dark:bg-night-card">
                      {row.exercise_name} - {row.recommended_sets} x {row.recommended_reps.min}-{row.recommended_reps.max}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {advancedMode ? (
        <Card className="p-5 sm:p-6">
        <div className="text-sm font-semibold">Available Programs</div>
        <div className="mt-3 space-y-2">
          {plans.length === 0 ? (
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              No programs yet. Generate your first smart program.
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-lg border px-3 py-3 ${
                  selectedPlan?.id === plan.id
                    ? "border-day-accent-primary bg-sky-50 dark:border-night-accent dark:bg-night-hover"
                    : "border-day-border bg-day-card dark:border-night-border dark:bg-night-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {normalizeGoal(plan.goal)} | {plan.workout_days_per_week} days/week | {plan.planning_mode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!plan.is_active ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void setPlanActive(plan.id)}
                        className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                      >
                        Set Active
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      ) : null}

      {showWorkout ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Full Workout (AI Adjusted)
          </div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Source: cached recommendations (`ai_recommendations`).
          </p>

          <div className="mt-4 space-y-3">
            {(today?.previewExercises ?? []).length === 0 ? (
              <div className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary">
                Using baseline plan - recommendations will adapt after your workouts.
              </div>
            ) : (
              (today?.previewExercises ?? []).map((row) => (
                <div
                  key={`full-${row.plan_exercise_id}`}
                  className="rounded-xl border border-day-border bg-day-card p-4 dark:border-night-border dark:bg-night-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{row.exercise_name}</p>
                      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {row.recommended_sets} sets x {row.recommended_reps.min}-{row.recommended_reps.max} reps | {row.recommended_weight === null ? "Auto load" : `${row.recommended_weight} kg`} | Rest {row.rest_seconds}s
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${actionBadgeClass(row.progression_action)}`}>
                      {actionLabel(row.progression_action)}
                    </span>
                  </div>
                  {row.recommendation_reason.length > 0 ? (
                    <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
                      AI: {row.recommendation_reason.join(" | ")}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {advancedMode ? (
            <div className="mt-4 rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 text-xs text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary">
              Cache: {today?.cacheState ?? "unknown"}
              {today?.cacheTtl?.updatedAt ? ` | Updated: ${new Date(today.cacheTtl.updatedAt).toLocaleString()}` : ""}
              {today?.cacheTtl?.isStale ? " | Refresh queued" : ""}
            </div>
          ) : null}
        </Card>
      ) : null}

      {advancedMode ? (
        <Card className="p-5 sm:p-6">
        <div className="text-sm font-semibold">Quick Generate Options</div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input
            className="input-field md:col-span-2"
            value={generateForm.name}
            onChange={(event) =>
              setGenerateForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Program name"
          />
          <select
            className="input-field"
            value={generateForm.goal}
            onChange={(event) =>
              setGenerateForm((current) => ({ ...current, goal: event.target.value }))
            }
          >
            <option value="fat_loss">Fat Loss</option>
            <option value="hypertrophy">Hypertrophy</option>
            <option value="strength">Strength</option>
            <option value="general_fitness">General Fitness</option>
          </select>
          <select
            className="input-field"
            value={generateForm.experienceLevel}
            onChange={(event) =>
              setGenerateForm((current) => ({ ...current, experienceLevel: event.target.value }))
            }
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <input
            className="input-field"
            type="number"
            min={1}
            max={7}
            value={generateForm.workoutDaysPerWeek}
            onChange={(event) =>
              setGenerateForm((current) => ({
                ...current,
                workoutDaysPerWeek: Math.max(1, Math.min(7, Number(event.target.value))),
              }))
            }
          />
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void generatePlan()}
          className="mt-3 rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-night-accent"
        >
          {isBusy ? "Generating..." : "Generate Plan"}
        </button>
      </Card>
      ) : null}
    </div>
  );
}
