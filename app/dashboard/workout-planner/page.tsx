"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Dumbbell, Plus, Sparkles, XCircle } from "lucide-react";

type PlannerTab = "smart" | "manual" | "calendar";
type CalendarStatus = "completed" | "missed" | "rest_day" | "planned";

type PlanRow = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  planning_mode: "smart" | "manual";
  is_active: boolean;
};

type CalendarRow = {
  id: string;
  status_date: string;
  status: CalendarStatus;
  streak_count: number;
};

type ManualExercise = {
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  tempo: string;
  rpe: number;
  notes: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  equipmentRequired: string;
  cloudinaryImageId: string;
  cloudinaryGifId: string;
};

type ManualDayPlan = {
  id: string;
  dayIndex: number;
  dayName: string;
  focusAreas: string[];
  exercises: ManualExercise[];
};

const CARD_CLASS =
  "rounded-2xl border border-day-border bg-day-card shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark";

const TAB_BUTTON_CLASS =
  "inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition";

const defaultManualExercise = (): ManualExercise => ({
  exerciseName: "",
  muscleGroup: "",
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  restSeconds: 60,
  tempo: "2-0-2",
  rpe: 7,
  notes: "",
  difficultyLevel: "intermediate",
  equipmentRequired: "",
  cloudinaryImageId: "",
  cloudinaryGifId: "",
});

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MUSCLE_CATEGORY_OPTIONS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Forearms",
  "Cardio",
];

function createDayId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `day-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDayName(dayIndex: number) {
  return `${WEEKDAY_LABELS[Math.max(1, Math.min(7, dayIndex)) - 1]} - Focus`;
}

function createManualDay(dayIndex: number): ManualDayPlan {
  return {
    id: createDayId(),
    dayIndex,
    dayName: defaultDayName(dayIndex),
    focusAreas: [],
    exercises: [defaultManualExercise()],
  };
}

const calendarStatusTheme: Record<
  CalendarStatus,
  {
    label: string;
    cell: string;
    badge: string;
    dot: string;
  }
> = {
  completed: {
    label: "Completed",
    cell:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  missed: {
    label: "Missed",
    cell:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
  },
  rest_day: {
    label: "Rest",
    cell:
      "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-100",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  planned: {
    label: "Planned",
    cell:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
};

function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthGrid(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < start.getDay(); i += 1) {
    cells.push({ date: null, day: null });
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const cellDate = new Date(date.getFullYear(), date.getMonth(), day);
    cells.push({ date: cellDate.toISOString().slice(0, 10), day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

function normalizeGoal(goal: string) {
  return goal.replaceAll("_", " ");
}

export default function WorkoutPlannerPage() {
  const [tab, setTab] = useState<PlannerTab>("smart");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([]);
  const [month, setMonth] = useState(new Date());
  const [selectedCalendarStatus, setSelectedCalendarStatus] =
    useState<CalendarStatus>("completed");

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [smartForm, setSmartForm] = useState({
    name: "Smart Performance Plan",
    goal: "hypertrophy",
    experienceLevel: "intermediate",
    workoutDaysPerWeek: 4,
    splitPreference: "push_pull_legs",
    preferredEquipment: "barbell,dumbbells,cable machine",
    visibility: "private",
  });

  const [manualForm, setManualForm] = useState({
    name: "My Custom Plan",
    goal: "general_fitness",
    experienceLevel: "intermediate",
    workoutDaysPerWeek: 3,
    visibility: "private",
    notes: "",
  });

  const [manualDays, setManualDays] = useState<ManualDayPlan[]>([
    createManualDay(1),
    createManualDay(2),
    createManualDay(3),
  ]);

  const calendarMap = useMemo(
    () => new Map(calendarRows.map((row) => [row.status_date, row])),
    [calendarRows],
  );

  const monthGrid = useMemo(() => buildMonthGrid(month), [month]);

  const monthLabel = useMemo(
    () =>
      month.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [month],
  );

  const loadPlans = async () => {
    const response = await fetch("/api/workout-planner/plans", {
      cache: "no-store",
    });
    const payload = (await response.json()) as { plans?: PlanRow[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load plans");
    }
    setPlans(payload.plans ?? []);
  };

  const loadCalendar = async (date: Date) => {
    const response = await fetch(
      `/api/workout-planner/calendar?month=${monthParam(date)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as {
      items?: CalendarRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load calendar");
    }

    setCalendarRows(payload.items ?? []);
  };

  const refreshAll = async () => {
    setError(null);
    try {
      await Promise.all([loadPlans(), loadCalendar(month)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh data");
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const submitSmart = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/workout-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...smartForm,
          preferredEquipment: smartForm.preferredEquipment
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to generate smart plan");
        return;
      }

      setNotice("Smart workout plan generated.");
      await loadPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate smart plan");
    } finally {
      setIsBusy(false);
    }
  };

  const nextAvailableDayIndex = (days: ManualDayPlan[]) => {
    for (let index = 1; index <= 7; index += 1) {
      if (!days.some((day) => day.dayIndex === index)) return index;
    }
    return Math.min(7, days.length + 1);
  };

  const addManualDay = () => {
    setManualDays((prev) => [...prev, createManualDay(nextAvailableDayIndex(prev))]);
  };

  const syncDayCardsToWeekCount = () => {
    const target = Math.max(1, Math.min(7, manualForm.workoutDaysPerWeek));
    setManualDays((prev) => {
      let next = [...prev];
      if (next.length > target) {
        next = next.slice(0, target);
      }
      while (next.length < target) {
        next = [...next, createManualDay(nextAvailableDayIndex(next))];
      }
      return next;
    });
  };

  const removeManualDay = (dayId: string) => {
    setManualDays((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((day) => day.id !== dayId);
    });
  };

  const updateDay = (dayId: string, updater: (day: ManualDayPlan) => ManualDayPlan) => {
    setManualDays((prev) => prev.map((day) => (day.id === dayId ? updater(day) : day)));
  };

  const addExerciseToDay = (dayId: string) => {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: [...day.exercises, defaultManualExercise()],
    }));
  };

  const removeExerciseFromDay = (dayId: string, exerciseIndex: number) => {
    updateDay(dayId, (day) => {
      if (day.exercises.length <= 1) return day;
      return {
        ...day,
        exercises: day.exercises.filter((_, index) => index !== exerciseIndex),
      };
    });
  };

  const updateExercise = (
    dayId: string,
    exerciseIndex: number,
    updater: (exercise: ManualExercise) => ManualExercise,
  ) => {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: day.exercises.map((exercise, index) =>
        index === exerciseIndex ? updater(exercise) : exercise,
      ),
    }));
  };

  const toggleFocusArea = (dayId: string, area: string) => {
    updateDay(dayId, (day) => {
      const hasArea = day.focusAreas.includes(area);
      return {
        ...day,
        focusAreas: hasArea
          ? day.focusAreas.filter((value) => value !== area)
          : [...day.focusAreas, area],
      };
    });
  };

  const submitManual = async () => {
    const flatExercises = manualDays.flatMap((day) =>
      day.exercises.map((exercise, index) => ({
        ...exercise,
        dayIndex: day.dayIndex,
        exerciseOrder: index + 1,
        muscleGroup:
          exercise.muscleGroup.trim() || day.focusAreas[0]?.toLowerCase() || "general",
        notes: [day.dayName ? `Day: ${day.dayName}` : "", exercise.notes]
          .filter(Boolean)
          .join(" | "),
      })),
    );

    if (flatExercises.length === 0) {
      setError("Add at least one exercise before saving.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/workout-planner/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          notes: [
            manualForm.notes,
            manualDays
              .map((day) =>
                `D${day.dayIndex}:${day.dayName}${
                  day.focusAreas.length > 0 ? ` [${day.focusAreas.join(", ")}]` : ""
                }`,
              )
              .join("; "),
          ]
            .filter(Boolean)
            .join(" | "),
          exercises: flatExercises.map((exercise) => ({
            ...exercise,
            equipmentRequired: exercise.equipmentRequired
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            cloudinaryImageId: exercise.cloudinaryImageId || null,
            cloudinaryGifId: exercise.cloudinaryGifId || null,
          })),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create manual plan");
        return;
      }

      setNotice("Manual workout plan created.");
      await loadPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create manual plan");
    } finally {
      setIsBusy(false);
    }
  };

  const togglePlan = async (planId: string, isActive: boolean) => {
    setError(null);

    try {
      const response = await fetch(`/api/workout-planner/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update plan status");
        return;
      }

      setPlans((prev) =>
        prev.map((plan) => (plan.id === planId ? { ...plan, is_active: isActive } : plan)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update plan status");
    }
  };

  const setCalendarDay = async (date: string, status: CalendarStatus) => {
    setError(null);

    try {
      const response = await fetch("/api/workout-planner/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, status }),
      });

      const payload = (await response.json()) as { item?: CalendarRow; error?: string };
      if (!response.ok || !payload.item) {
        setError(payload.error ?? "Failed to update calendar day");
        return;
      }

      setCalendarRows((prev) => [
        ...prev.filter((row) => row.status_date !== payload.item?.status_date),
        payload.item as CalendarRow,
      ]);
      setNotice(`Updated ${date} as ${calendarStatusTheme[status].label}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update calendar day");
    }
  };

  const moveMonth = async (direction: -1 | 1) => {
    const nextMonth = new Date(month);
    nextMonth.setMonth(nextMonth.getMonth() + direction);
    setMonth(nextMonth);

    try {
      await loadCalendar(nextMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load selected month");
    }
  };

  const activePlans = plans.filter((plan) => plan.is_active).length;

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${CARD_CLASS} overflow-hidden p-0`}
      >
        <div className="bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600 p-6 text-white dark:from-red-700 dark:via-red-900 dark:to-black">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                Workout Planner
              </p>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">Train With Structure</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">
                Keep the classic BioLift workout style while generating smart plans,
                building manual blocks, and tracking completion day by day.
              </p>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs text-white/80">Active Plans</div>
              <div className="text-2xl font-semibold">{activePlans}</div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTab("smart")}
                className={`${TAB_BUTTON_CLASS} ${
                  tab === "smart"
                    ? "bg-day-accent-primary text-white shadow-glow-blue dark:bg-night-accent dark:shadow-glow"
                    : "btn-ghost"
                }`}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Smart
              </button>
              <button
                onClick={() => setTab("manual")}
                className={`${TAB_BUTTON_CLASS} ${
                  tab === "manual"
                    ? "bg-day-accent-primary text-white shadow-glow-blue dark:bg-night-accent dark:shadow-glow"
                    : "btn-ghost"
                }`}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Manual
              </button>
              <button
                onClick={() => setTab("calendar")}
                className={`${TAB_BUTTON_CLASS} ${
                  tab === "calendar"
                    ? "bg-day-accent-primary text-white shadow-glow-blue dark:bg-night-accent dark:shadow-glow"
                    : "btn-ghost"
                }`}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendar
              </button>
            </div>

            <button className="btn-ghost" onClick={refreshAll}>
              Refresh Data
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">
              {notice}
            </div>
          ) : null}
        </div>
      </motion.section>

      {tab === "smart" ? (
        <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <div className={`${CARD_CLASS} p-6`}>
            <h2 className="text-xl font-semibold">Generate Smart Plan</h2>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Goal-driven split logic with fatigue-safe distribution.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                className="input-field"
                value={smartForm.name}
                onChange={(event) =>
                  setSmartForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Plan Name"
              />

              <select
                className="input-field"
                value={smartForm.goal}
                onChange={(event) =>
                  setSmartForm((prev) => ({ ...prev, goal: event.target.value }))
                }
              >
                <option value="fat_loss">Fat Loss</option>
                <option value="hypertrophy">Hypertrophy</option>
                <option value="strength">Strength</option>
                <option value="general_fitness">General Fitness</option>
              </select>

              <select
                className="input-field"
                value={smartForm.experienceLevel}
                onChange={(event) =>
                  setSmartForm((prev) => ({ ...prev, experienceLevel: event.target.value }))
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
                value={smartForm.workoutDaysPerWeek}
                onChange={(event) =>
                  setSmartForm((prev) => ({
                    ...prev,
                    workoutDaysPerWeek: Number(event.target.value),
                  }))
                }
                placeholder="Days / Week"
              />

              <select
                className="input-field"
                value={smartForm.splitPreference}
                onChange={(event) =>
                  setSmartForm((prev) => ({ ...prev, splitPreference: event.target.value }))
                }
              >
                <option value="push_pull_legs">Push Pull Legs</option>
                <option value="upper_lower">Upper Lower</option>
                <option value="full_body">Full Body</option>
              </select>

              <select
                className="input-field"
                value={smartForm.visibility}
                onChange={(event) =>
                  setSmartForm((prev) => ({ ...prev, visibility: event.target.value }))
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>

              <input
                className="input-field md:col-span-2"
                value={smartForm.preferredEquipment}
                onChange={(event) =>
                  setSmartForm((prev) => ({
                    ...prev,
                    preferredEquipment: event.target.value,
                  }))
                }
                placeholder="Equipment (comma separated)"
              />
            </div>

            <button className="btn-primary mt-5" disabled={isBusy} onClick={submitSmart}>
              {isBusy ? "Generating..." : "Generate Smart Plan"}
            </button>
          </div>

          <div className={`${CARD_CLASS} p-6`}>
            <h3 className="text-xl font-semibold">Plan Library</h3>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Activate one plan at a time.
            </p>

            <div className="mt-4 space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-day-border bg-day-hover/60 p-3 dark:border-night-border dark:bg-night-hover/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {normalizeGoal(plan.goal)} - {plan.experience_level} -{" "}
                        {plan.planning_mode}
                      </p>
                      <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {plan.workout_days_per_week} days per week
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        plan.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-day-border text-day-text-secondary dark:bg-night-border dark:text-night-text-secondary"
                      }`}
                    >
                      {plan.is_active ? "active" : "inactive"}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => togglePlan(plan.id, true)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => togglePlan(plan.id, false)}
                      className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}

              {plans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-day-border px-3 py-4 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                  No plans available yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "manual" ? (
        <section className={`${CARD_CLASS} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Manual Plan Builder</h2>
              <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                Build day-wise cards like Monday Push / Tuesday Pull with category tags.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={syncDayCardsToWeekCount}>
                Sync Days
              </button>
              <button className="btn-ghost" onClick={addManualDay}>
                <Plus className="mr-1 inline h-4 w-4" />
                Add Day Card
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              className="input-field"
              value={manualForm.name}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Plan Name"
            />

            <select
              className="input-field"
              value={manualForm.goal}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, goal: event.target.value }))
              }
            >
              <option value="fat_loss">Fat Loss</option>
              <option value="hypertrophy">Hypertrophy</option>
              <option value="strength">Strength</option>
              <option value="general_fitness">General Fitness</option>
            </select>

            <select
              className="input-field"
              value={manualForm.experienceLevel}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, experienceLevel: event.target.value }))
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
              value={manualForm.workoutDaysPerWeek}
              onChange={(event) =>
                setManualForm((prev) => ({
                  ...prev,
                  workoutDaysPerWeek: Number(event.target.value),
                }))
              }
              placeholder="Days / Week"
            />

            <select
              className="input-field"
              value={manualForm.visibility}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, visibility: event.target.value }))
              }
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>

            <input
              className="input-field"
              value={manualForm.notes}
              onChange={(event) =>
                setManualForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Plan notes"
            />
          </div>

          <div className="mt-6 space-y-4">
            {[...manualDays]
              .sort((first, second) => first.dayIndex - second.dayIndex)
              .map((day) => (
                <div
                  key={day.id}
                  className="rounded-xl border border-day-border p-4 dark:border-night-border"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Day {day.dayIndex}</h3>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:hover:bg-red-900/20"
                      onClick={() => removeManualDay(day.id)}
                      disabled={manualDays.length <= 1}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Remove Day
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <select
                      className="input-field"
                      value={day.dayIndex}
                      onChange={(event) =>
                        updateDay(day.id, (previousDay) => ({
                          ...previousDay,
                          dayIndex: Number(event.target.value),
                        }))
                      }
                    >
                      {WEEKDAY_LABELS.map((weekday, index) => (
                        <option key={weekday} value={index + 1}>
                          {index + 1} - {weekday}
                        </option>
                      ))}
                    </select>

                    <input
                      className="input-field"
                      value={day.dayName}
                      onChange={(event) =>
                        updateDay(day.id, (previousDay) => ({
                          ...previousDay,
                          dayName: event.target.value,
                        }))
                      }
                      placeholder="MONDAY - PUSH (Strength + Core)"
                    />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                      Focus Categories
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {MUSCLE_CATEGORY_OPTIONS.map((category) => {
                        const isActive = day.focusAreas.includes(category);
                        return (
                          <button
                            key={`${day.id}-${category}`}
                            onClick={() => toggleFocusArea(day.id, category)}
                            className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                              isActive
                                ? "border-day-accent-primary bg-day-accent-primary/10 text-day-accent-primary dark:border-night-accent dark:bg-night-accent/20 dark:text-night-accent"
                                : "border-day-border bg-day-hover/60 text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:bg-night-hover/40 dark:text-night-text-secondary dark:hover:bg-night-hover"
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {day.exercises.map((exercise, exerciseIndex) => (
                      <div
                        key={`${day.id}-exercise-${exerciseIndex}`}
                        className="rounded-lg border border-day-border p-3 dark:border-night-border"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                            Exercise {exerciseIndex + 1}
                          </h4>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:hover:bg-red-900/20"
                            onClick={() => removeExerciseFromDay(day.id, exerciseIndex)}
                            disabled={day.exercises.length <= 1}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <input
                            className="input-field"
                            placeholder="Exercise Name"
                            value={exercise.exerciseName}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                exerciseName: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            placeholder="Muscle Group"
                            value={exercise.muscleGroup}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                muscleGroup: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            max={12}
                            placeholder="Sets"
                            value={exercise.sets}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                sets: Number(event.target.value),
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            max={60}
                            placeholder="Reps Min"
                            value={exercise.repsMin}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                repsMin: Number(event.target.value),
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            max={60}
                            placeholder="Reps Max"
                            value={exercise.repsMax}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                repsMax: Number(event.target.value),
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={15}
                            max={600}
                            placeholder="Rest Seconds"
                            value={exercise.restSeconds}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                restSeconds: Number(event.target.value),
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            placeholder="Tempo (e.g. 2-0-2)"
                            value={exercise.tempo}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                tempo: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            max={10}
                            placeholder="RPE"
                            value={exercise.rpe}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                rpe: Number(event.target.value),
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            placeholder="Equipment (comma separated)"
                            value={exercise.equipmentRequired}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                equipmentRequired: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            placeholder="Cloudinary Image ID"
                            value={exercise.cloudinaryImageId}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                cloudinaryImageId: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field"
                            placeholder="Cloudinary GIF ID"
                            value={exercise.cloudinaryGifId}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                cloudinaryGifId: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="input-field md:col-span-2 xl:col-span-4"
                            placeholder="Exercise Notes"
                            value={exercise.notes}
                            onChange={(event) =>
                              updateExercise(day.id, exerciseIndex, (current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn-ghost mt-3" onClick={() => addExerciseToDay(day.id)}>
                    <Plus className="mr-1 inline h-4 w-4" />
                    Add Exercise To Day
                  </button>
                </div>
              ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={isBusy} onClick={submitManual}>
              {isBusy ? "Saving..." : "Save Manual Plan"}
            </button>
          </div>
        </section>
      ) : null}
      {tab === "calendar" ? (
        <section className={`${CARD_CLASS} p-5 sm:p-6`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Monthly Calendar</h2>
              <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Pick status once, then tap any day.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => moveMonth(-1)}>
                Prev
              </button>
              <span className="rounded-lg border border-day-border px-3 py-2 text-sm font-semibold dark:border-night-border">
                {monthLabel}
              </span>
              <button className="btn-ghost" onClick={() => moveMonth(1)}>
                Next
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(calendarStatusTheme) as CalendarStatus[]).map((status) => {
              const statusUi = calendarStatusTheme[status];
              return (
                <button
                  key={status}
                  onClick={() => setSelectedCalendarStatus(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selectedCalendarStatus === status
                      ? statusUi.badge
                      : "bg-day-hover text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary"
                  }`}
                >
                  {statusUi.label}
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {(Object.keys(calendarStatusTheme) as CalendarStatus[]).map((status) => (
              <div
                key={`legend-${status}`}
                className="inline-flex items-center gap-2 rounded-full border border-day-border bg-day-card px-2.5 py-1 dark:border-night-border dark:bg-night-card"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${calendarStatusTheme[status].dot}`} />
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  {calendarStatusTheme[status].label}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-day-text-secondary dark:text-night-text-secondary sm:gap-2 sm:text-xs">
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((weekDay) => (
              <div key={weekDay}>{weekDay}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {monthGrid.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return <div key={`empty-${index}`} className="h-14 sm:h-20" />;
              }

              const dayStatus = calendarMap.get(cell.date);
              const isToday = cell.date === new Date().toISOString().slice(0, 10);

              return (
                <button
                  key={cell.date}
                  onClick={() => setCalendarDay(cell.date!, selectedCalendarStatus)}
                  className={`relative h-14 rounded-lg border px-1.5 py-1 text-left transition sm:h-20 sm:px-2 sm:py-2 ${
                    dayStatus
                      ? calendarStatusTheme[dayStatus.status].cell
                      : "border-day-border bg-day-card text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
                  } ${isToday ? "ring-2 ring-day-accent-primary dark:ring-night-accent" : ""}`}
                >
                  <span className="text-xs font-semibold sm:text-sm">{cell.day}</span>
                  {dayStatus ? (
                    <span
                      className={`absolute bottom-1.5 left-1.5 h-2.5 w-2.5 rounded-full sm:bottom-2 sm:left-2 ${calendarStatusTheme[dayStatus.status].dot}`}
                    />
                  ) : null}
                  {dayStatus?.streak_count ? (
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/10 sm:bottom-2 sm:right-2">
                      {dayStatus.streak_count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Selected status: {calendarStatusTheme[selectedCalendarStatus].label}. Tap a day
            to apply.
          </p>
        </section>
      ) : null}

      <section className={`${CARD_CLASS} p-5 sm:p-6`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Quick Summary</h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Total Plans
            </p>
            <p className="mt-1 text-xl font-semibold">{plans.length}</p>
          </div>
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Active Plans
            </p>
            <p className="mt-1 text-xl font-semibold">{activePlans}</p>
          </div>
          <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/50">
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              Marked Days This Month
            </p>
            <p className="mt-1 text-xl font-semibold">{calendarRows.length}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

