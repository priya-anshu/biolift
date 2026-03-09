"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Dumbbell, Plus, Sparkles, XCircle } from "lucide-react";
import type {
  ExerciseRecommendation,
  TrainingIntelligenceResult,
} from "@/lib/workout-planner/intelligenceEngine";

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

type TodayPlanExercise = {
  id: string;
  exercise_name: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
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
  imageInput: string;
  gifInput: string;
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
  imageInput: "",
  gifInput: "",
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

function toIsoDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatProgressionAction(action: ExerciseRecommendation["progression_action"]) {
  return action.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getProgressionBadgeClass(action: ExerciseRecommendation["progression_action"]) {
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
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  }
  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
}

function extractCloudinaryAssetId(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/\.(png|jpe?g|webp|gif|avif)$/i, "");
  }

  try {
    const url = new URL(value);
    if (!url.hostname.includes("cloudinary.com")) return "";

    const segments = url.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.findIndex((segment) => segment === "upload");
    if (uploadIndex === -1) return "";

    let assetSegments = segments.slice(uploadIndex + 1);
    while (
      assetSegments.length > 0 &&
      /^(?:[a-z]+_.*|q_.*|f_.*|w_.*|h_.*|c_.*|g_.*|dpr_.*|ar_.*)$/i.test(
        assetSegments[0],
      )
    ) {
      assetSegments = assetSegments.slice(1);
    }
    if (assetSegments[0]?.match(/^v\d+$/)) {
      assetSegments = assetSegments.slice(1);
    }
    if (assetSegments.length === 0) return "";

    const publicId = decodeURIComponent(assetSegments.join("/"));
    return publicId.replace(/\.[^/.]+$/, "");
  } catch {
    return "";
  }
}

export default function WorkoutPlannerPage() {
  const [tab, setTab] = useState<PlannerTab>("smart");
  const [advancedMode, setAdvancedMode] = useState(false);
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

  const [recommendationDate, setRecommendationDate] = useState<string>(
    toIsoDateKey(new Date()),
  );
  const [lookbackDays, setLookbackDays] = useState<number>(42);
  const [recommendationDayIndex, setRecommendationDayIndex] = useState<number | null>(
    null,
  );
  const [recommendations, setRecommendations] =
    useState<TrainingIntelligenceResult | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState<boolean>(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [baselinePlanExercises, setBaselinePlanExercises] = useState<TodayPlanExercise[]>(
    [],
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planEditForm, setPlanEditForm] = useState({
    name: "",
    goal: "general_fitness",
    workoutDaysPerWeek: 3,
  });

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

  const activePlan = useMemo(
    () => plans.find((plan) => plan.is_active) ?? null,
    [plans],
  );
  const activePlanId = activePlan?.id ?? null;
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? activePlan ?? null,
    [activePlan, plans, selectedPlanId],
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

  const loadRecommendations = async () => {
    setRecommendationsLoading(true);
    setRecommendationsError(null);

    try {
      const params = new URLSearchParams({
        workoutDate: recommendationDate,
        lookbackDays: String(lookbackDays),
      });
      if (recommendationDayIndex !== null) {
        params.set("dayIndex", String(recommendationDayIndex));
      }
      if (activePlanId) {
        params.set("planId", activePlanId);
      }

      const [recRes, baselineRes] = await Promise.all([
        fetch(`/api/workout-planner/recommendations?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch("/api/dashboard/motivation", { cache: "no-store" }),
      ]);

      const recPayload = (await recRes.json()) as {
        recommendations?: TrainingIntelligenceResult;
        error?: string;
      };
      if (!recRes.ok || !recPayload.recommendations) {
        throw new Error(recPayload.error ?? "Failed to load recommendations");
      }
      setRecommendations(recPayload.recommendations);

      const baselinePayload = (await baselineRes.json()) as {
        todayPlan?: {
          id: string;
          name: string;
          exercises?: TodayPlanExercise[];
        } | null;
      };
      setBaselinePlanExercises(baselinePayload.todayPlan?.exercises ?? []);
    } catch (e) {
      setRecommendations(null);
      setBaselinePlanExercises([]);
      setRecommendationsError(
        e instanceof Error ? e.message : "Failed to load recommendations",
      );
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const refreshAll = async () => {
    setError(null);
    try {
      await Promise.all([loadPlans(), loadCalendar(month), loadRecommendations()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh data");
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [activePlanId, recommendationDate, recommendationDayIndex, lookbackDays]);

  useEffect(() => {
    if (!advancedMode && (tab === "manual" || tab === "calendar")) {
      setTab("smart");
    }
  }, [advancedMode, tab]);

  useEffect(() => {
    if (plans.length === 0) {
      setSelectedPlanId(null);
      setEditingPlanId(null);
      return;
    }
    if (selectedPlanId && plans.some((plan) => plan.id === selectedPlanId)) return;
    setSelectedPlanId(activePlanId ?? plans[0]?.id ?? null);
  }, [activePlanId, plans, selectedPlanId]);

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
      await loadRecommendations();
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
            cloudinaryImageId:
              exercise.cloudinaryImageId ||
              extractCloudinaryAssetId(exercise.imageInput) ||
              null,
            cloudinaryGifId:
              exercise.cloudinaryGifId ||
              extractCloudinaryAssetId(exercise.gifInput) ||
              null,
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
      await loadRecommendations();
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

      const payload = (await response.json()) as {
        plan?: Partial<PlanRow> & { id?: string };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update plan status");
        return;
      }

      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                ...payload.plan,
                id: plan.id,
                is_active: isActive,
              }
            : plan,
        ),
      );
      await loadRecommendations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update plan status");
    }
  };

  const beginEditPlan = (plan: PlanRow) => {
    setSelectedPlanId(plan.id);
    setEditingPlanId(plan.id);
    setPlanEditForm({
      name: plan.name,
      goal: plan.goal,
      workoutDaysPerWeek: plan.workout_days_per_week,
    });
  };

  const savePlanEdits = async (planId: string) => {
    if (!planEditForm.name.trim()) {
      setError("Plan name is required.");
      return;
    }
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/workout-planner/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planEditForm.name.trim(),
          goal: planEditForm.goal,
          workoutDaysPerWeek: Math.max(1, Math.min(7, planEditForm.workoutDaysPerWeek)),
        }),
      });
      const payload = (await response.json()) as {
        plan?: Partial<PlanRow> & { id?: string };
        error?: string;
      };
      if (!response.ok || !payload.plan) {
        setError(payload.error ?? "Failed to save plan updates");
        return;
      }
      const updatedPlan = payload.plan;
      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                ...updatedPlan,
                id: plan.id,
                workout_days_per_week:
                  (updatedPlan.workout_days_per_week as number | undefined) ??
                  planEditForm.workoutDaysPerWeek,
                goal: (updatedPlan.goal as string | undefined) ?? planEditForm.goal,
                name: (updatedPlan.name as string | undefined) ?? planEditForm.name.trim(),
              }
            : plan,
        ),
      );
      setNotice("Plan updated.");
      setEditingPlanId(null);
      await loadRecommendations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save plan updates");
    } finally {
      setIsBusy(false);
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
  const baselineByPlanExerciseId = useMemo(
    () => new Map(baselinePlanExercises.map((item) => [item.id, item])),
    [baselinePlanExercises],
  );

  const recommendationRows = useMemo(
    () =>
      (recommendations?.recommendations ?? []).map((recommendation) => ({
        recommendation,
        baseline: baselineByPlanExerciseId.get(recommendation.plan_exercise_id) ?? null,
      })),
    [baselineByPlanExerciseId, recommendations],
  );

  const retryRecommendations = async () => {
    await loadRecommendations();
  };

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
                Build and manage your active training plan. Workout execution happens in
                Today&apos;s Workout.
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
                Plan
              </button>
              {advancedMode ? (
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
              ) : null}
              {advancedMode ? (
                <button
                  onClick={() => setTab("manual")}
                  className={`${TAB_BUTTON_CLASS} ${
                    tab === "manual"
                      ? "bg-day-accent-primary text-white shadow-glow-blue dark:bg-night-accent dark:shadow-glow"
                      : "btn-ghost"
                  }`}
                >
                  <Dumbbell className="mr-2 h-4 w-4" />
                  Advanced Builder
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  advancedMode
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "btn-ghost"
                }`}
                onClick={() => setAdvancedMode((prev) => !prev)}
              >
                Advanced Mode: {advancedMode ? "On" : "Off"}
              </button>
              <button className="btn-ghost" onClick={refreshAll}>
                Refresh Data
              </button>
            </div>
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
          {!advancedMode ? (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">
              AI progression is automatically applied to your next workout. Open
              Advanced Mode to inspect recommendation details.
            </div>
          ) : null}
        </div>
      </motion.section>

      {tab === "smart" ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
            <div className={`${CARD_CLASS} p-6`}>
            <h2 className="text-xl font-semibold">Generate Plan</h2>
            <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Create your next training cycle using goal-driven split logic.
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
              {isBusy ? "Generating..." : "Generate Plan"}
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

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => togglePlan(plan.id, true)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => setSelectedPlanId(plan.id)}
                      className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                    >
                      View Plan
                    </button>
                    <button
                      onClick={() => beginEditPlan(plan)}
                      className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                    >
                      Edit Plan
                    </button>
                    {advancedMode ? (
                      <button
                        onClick={() => togglePlan(plan.id, false)}
                        className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                      >
                        Archive
                      </button>
                    ) : null}
                  </div>

                  {editingPlanId === plan.id ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-day-border bg-day-card p-3 dark:border-night-border dark:bg-night-card md:grid-cols-2">
                      <input
                        className="input-field md:col-span-2"
                        value={planEditForm.name}
                        onChange={(event) =>
                          setPlanEditForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Plan name"
                      />
                      <select
                        className="input-field"
                        value={planEditForm.goal}
                        onChange={(event) =>
                          setPlanEditForm((prev) => ({ ...prev, goal: event.target.value }))
                        }
                      >
                        <option value="fat_loss">Fat Loss</option>
                        <option value="hypertrophy">Hypertrophy</option>
                        <option value="strength">Strength</option>
                        <option value="general_fitness">General Fitness</option>
                      </select>
                      <input
                        className="input-field"
                        type="number"
                        min={1}
                        max={7}
                        value={planEditForm.workoutDaysPerWeek}
                        onChange={(event) =>
                          setPlanEditForm((prev) => ({
                            ...prev,
                            workoutDaysPerWeek: Number(event.target.value),
                          }))
                        }
                        placeholder="Days / Week"
                      />
                      <div className="flex gap-2 md:col-span-2">
                        <button
                          className="rounded-lg bg-day-accent-primary px-3 py-1.5 text-xs font-semibold text-white dark:bg-night-accent"
                          disabled={isBusy}
                          onClick={() => {
                            void savePlanEdits(plan.id);
                          }}
                        >
                          {isBusy ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                          onClick={() => setEditingPlanId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
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

          <section className={`${CARD_CLASS} p-6`}>
            <h3 className="text-xl font-semibold">Active Plan</h3>
            {selectedPlan ? (
              <div className="mt-4 rounded-xl border border-day-border bg-day-hover/60 p-4 dark:border-night-border dark:bg-night-hover/40">
                <p className="font-semibold">{selectedPlan.name}</p>
                <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Goal: {normalizeGoal(selectedPlan.goal)}
                </p>
                <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Experience: {selectedPlan.experience_level} - Days/week:{" "}
                  {selectedPlan.workout_days_per_week}
                </p>
                <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Planning mode: {selectedPlan.planning_mode} -{" "}
                  {selectedPlan.is_active ? "Active" : "Inactive"}
                </p>
                <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  AI adjustments:{" "}
                  {recommendationRows.length > 0
                    ? `${recommendationRows.length} exercise updates ready`
                    : "Using baseline progression until more session data is available"}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-day-border px-4 py-3 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                No active plan yet. Generate a plan to begin.
              </div>
            )}
            {!advancedMode ? (
              <p className="mt-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                AI recommendations are being applied automatically in workout sessions.
              </p>
            ) : null}
          </section>

          {advancedMode ? (
            <section className={`${CARD_CLASS} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">AI Workout Recommendations</h3>
                <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Intelligent progression powered by performance, recovery, and injury signals.
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => {
                  void retryRecommendations();
                }}
                disabled={recommendationsLoading}
              >
                {recommendationsLoading ? "Refreshing..." : "Refresh AI"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Workout Date
                </span>
                <input
                  className="input-field"
                  type="date"
                  value={recommendationDate}
                  onChange={(event) => setRecommendationDate(event.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Day Index
                </span>
                <select
                  className="input-field"
                  value={recommendationDayIndex === null ? "" : String(recommendationDayIndex)}
                  onChange={(event) =>
                    setRecommendationDayIndex(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">Auto (from date)</option>
                  <option value="1">1 - Monday</option>
                  <option value="2">2 - Tuesday</option>
                  <option value="3">3 - Wednesday</option>
                  <option value="4">4 - Thursday</option>
                  <option value="5">5 - Friday</option>
                  <option value="6">6 - Saturday</option>
                  <option value="7">7 - Sunday</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Lookback Days
                </span>
                <select
                  className="input-field"
                  value={lookbackDays}
                  onChange={(event) => setLookbackDays(Number(event.target.value))}
                >
                  <option value={28}>28 days</option>
                  <option value={42}>42 days</option>
                  <option value={56}>56 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
            </div>

            {recommendationsLoading ? (
              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`recommendation-skeleton-${index}`}
                    className="animate-pulse rounded-xl border border-day-border p-4 dark:border-night-border"
                  >
                    <div className="h-4 w-40 rounded bg-day-border dark:bg-night-border" />
                    <div className="mt-3 h-3 w-64 rounded bg-day-border dark:bg-night-border" />
                    <div className="mt-2 h-3 w-56 rounded bg-day-border dark:bg-night-border" />
                    <div className="mt-2 h-3 w-48 rounded bg-day-border dark:bg-night-border" />
                  </div>
                ))}
              </div>
            ) : null}

            {!recommendationsLoading && recommendationsError ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {recommendationsError}
                </p>
                <button
                  className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/40"
                  onClick={() => {
                    void retryRecommendations();
                  }}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!recommendationsLoading &&
            !recommendationsError &&
            recommendationRows.length > 0 ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-day-border bg-day-hover/60 px-3 py-2 text-xs text-day-text-secondary dark:border-night-border dark:bg-night-hover/40 dark:text-night-text-secondary">
                  Readiness:{" "}
                  <span className="font-semibold">{recommendations?.readiness_band ?? "-"}</span>
                  {" · "}
                  Fatigue:{" "}
                  <span className="font-semibold">
                    {recommendations?.fatigue_score ?? "-"}
                  </span>
                  {" · "}
                  Adherence:{" "}
                  <span className="font-semibold">
                    {recommendations?.adherence_score ?? "-"}
                  </span>
                </div>

                {recommendationRows.map(({ recommendation, baseline }) => {
                  const hasWeight = recommendation.recommended_weight !== null;
                  const isAdjustedFromBaseline = baseline
                    ? baseline.sets !== recommendation.recommended_sets ||
                      baseline.reps_min !== recommendation.recommended_reps.min ||
                      baseline.reps_max !== recommendation.recommended_reps.max ||
                      baseline.rest_seconds !== recommendation.rest_seconds
                    : false;
                  const exerciseName =
                    baseline?.exercise_name ??
                    recommendation.original_exercise_id ??
                    "Exercise";

                  return (
                    <div
                      key={recommendation.plan_exercise_id}
                      className="rounded-xl border border-day-border bg-day-hover/60 p-4 dark:border-night-border dark:bg-night-hover/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{exerciseName}</p>
                          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                            Recommended: {recommendation.recommended_sets} sets x{" "}
                            {recommendation.recommended_reps.min}-
                            {recommendation.recommended_reps.max} reps
                          </p>
                          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                            Weight:{" "}
                            {hasWeight
                              ? `${recommendation.recommended_weight} kg`
                              : "Auto-load after first completed sets"}
                            {" · "}Rest: {recommendation.rest_seconds}s
                          </p>
                          {baseline ? (
                            <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                              Baseline: {baseline.sets} sets x {baseline.reps_min}-
                              {baseline.reps_max} reps · Rest {baseline.rest_seconds}s
                            </p>
                          ) : null}
                          {isAdjustedFromBaseline ? (
                            <p className="mt-1 text-xs font-semibold text-day-accent-primary dark:text-night-accent">
                              AI adjusted this exercise from your baseline plan.
                            </p>
                          ) : null}
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getProgressionBadgeClass(
                            recommendation.progression_action,
                          )}`}
                        >
                          {formatProgressionAction(recommendation.progression_action)}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
                        Reason:{" "}
                        {recommendation.recommendation_reason.length > 0
                          ? recommendation.recommendation_reason.join(" | ")
                          : "No explicit reason provided."}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!recommendationsLoading &&
            !recommendationsError &&
            recommendationRows.length === 0 ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-dashed border-day-border px-4 py-3 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                  Using baseline plan - recommendations will adapt after your workouts.
                </div>

                {baselinePlanExercises.length > 0 ? (
                  baselinePlanExercises.map((exercise) => (
                    <div
                      key={`baseline-${exercise.id}`}
                      className="rounded-xl border border-day-border bg-day-hover/60 p-4 dark:border-night-border dark:bg-night-hover/40"
                    >
                      <p className="font-semibold">{exercise.exercise_name}</p>
                      <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                        Recommended: {exercise.sets} sets x {exercise.reps_min}-
                        {exercise.reps_max} reps
                      </p>
                      <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                        Weight: Auto-load after first completed sets · Rest:{" "}
                        {exercise.rest_seconds}s
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-day-border px-4 py-3 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                    No baseline workout exercises found for the selected date.
                  </div>
                )}
              </div>
            ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {advancedMode && tab === "manual" ? (
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
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Exercise Name
                            </span>
                            <input
                              className="input-field"
                              value={exercise.exerciseName}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  exerciseName: event.target.value,
                                }))
                              }
                              placeholder="Incline DB Press"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Muscle Group
                            </span>
                            <input
                              className="input-field"
                              value={exercise.muscleGroup}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  muscleGroup: event.target.value,
                                }))
                              }
                              placeholder="Chest"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Sets
                            </span>
                            <input
                              className="input-field"
                              type="number"
                              min={1}
                              max={12}
                              value={exercise.sets}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  sets: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Reps (Min)
                            </span>
                            <input
                              className="input-field"
                              type="number"
                              min={1}
                              max={60}
                              value={exercise.repsMin}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  repsMin: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Reps (Max)
                            </span>
                            <input
                              className="input-field"
                              type="number"
                              min={1}
                              max={60}
                              value={exercise.repsMax}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  repsMax: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Rest (seconds)
                            </span>
                            <input
                              className="input-field"
                              type="number"
                              min={15}
                              max={600}
                              value={exercise.restSeconds}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  restSeconds: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Tempo
                            </span>
                            <input
                              className="input-field"
                              value={exercise.tempo}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  tempo: event.target.value,
                                }))
                              }
                              placeholder="2-0-2"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              RPE (1-10)
                            </span>
                            <input
                              className="input-field"
                              type="number"
                              min={1}
                              max={10}
                              value={exercise.rpe}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  rpe: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Difficulty
                            </span>
                            <select
                              className="input-field"
                              value={exercise.difficultyLevel}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  difficultyLevel: event.target.value as
                                    | "beginner"
                                    | "intermediate"
                                    | "advanced",
                                }))
                              }
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </label>

                          <label className="space-y-1 md:col-span-2 xl:col-span-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Equipment (comma separated)
                            </span>
                            <input
                              className="input-field"
                              value={exercise.equipmentRequired}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  equipmentRequired: event.target.value,
                                }))
                              }
                              placeholder="Dumbbells, bench"
                            />
                          </label>

                          <label className="space-y-1 md:col-span-2 xl:col-span-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Exercise Image (Cloudinary URL or ID)
                            </span>
                            <input
                              className="input-field"
                              value={exercise.imageInput}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => {
                                  const nextInput = event.target.value;
                                  const extracted = extractCloudinaryAssetId(nextInput);
                                  return {
                                    ...current,
                                    imageInput: nextInput,
                                    cloudinaryImageId: nextInput.trim()
                                      ? extracted || current.cloudinaryImageId
                                      : "",
                                  };
                                })
                              }
                              placeholder="Paste Cloudinary image URL or public ID"
                            />
                          </label>

                          <label className="space-y-1 md:col-span-2 xl:col-span-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Exercise GIF (Cloudinary URL or ID)
                            </span>
                            <input
                              className="input-field"
                              value={exercise.gifInput}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => {
                                  const nextInput = event.target.value;
                                  const extracted = extractCloudinaryAssetId(nextInput);
                                  return {
                                    ...current,
                                    gifInput: nextInput,
                                    cloudinaryGifId: nextInput.trim()
                                      ? extracted || current.cloudinaryGifId
                                      : "",
                                  };
                                })
                              }
                              placeholder="Paste Cloudinary GIF URL or public ID"
                            />
                          </label>

                          {(exercise.cloudinaryImageId || exercise.cloudinaryGifId) ? (
                            <div className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-2 text-[11px] text-day-text-secondary dark:border-night-border dark:bg-night-hover/50 dark:text-night-text-secondary md:col-span-2 xl:col-span-4">
                              {exercise.cloudinaryImageId ? (
                                <div>Image ID: {exercise.cloudinaryImageId}</div>
                              ) : null}
                              {exercise.cloudinaryGifId ? (
                                <div>GIF ID: {exercise.cloudinaryGifId}</div>
                              ) : null}
                            </div>
                          ) : null}

                          <label className="space-y-1 md:col-span-2 xl:col-span-4">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                              Exercise Notes
                            </span>
                            <input
                              className="input-field"
                              value={exercise.notes}
                              onChange={(event) =>
                                updateExercise(day.id, exerciseIndex, (current) => ({
                                  ...current,
                                  notes: event.target.value,
                                }))
                              }
                              placeholder="Optional form cues, tempo notes, or constraints"
                            />
                          </label>
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
      {advancedMode && tab === "calendar" ? (
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

          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-day-text-secondary dark:text-night-text-secondary sm:gap-2 sm:text-xs">
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

              <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                {monthGrid.map((cell, index) => {
                  const statusDate = cell.date;
                  if (!statusDate || !cell.day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const dayStatus = calendarMap.get(statusDate);
                  const isToday = statusDate === new Date().toISOString().slice(0, 10);

                  return (
                    <button
                      key={statusDate}
                      onClick={() => setCalendarDay(statusDate, selectedCalendarStatus)}
                      className={`relative aspect-square rounded-lg border p-1 text-left transition sm:p-2 ${
                        dayStatus
                          ? calendarStatusTheme[dayStatus.status].cell
                          : "border-day-border bg-day-card text-day-text-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary"
                      } ${isToday ? "ring-2 ring-day-accent-primary dark:ring-night-accent" : ""}`}
                    >
                      <span className="text-xs font-semibold sm:text-sm">{cell.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-day-text-secondary dark:text-night-text-secondary">
            Selected status: {calendarStatusTheme[selectedCalendarStatus].label}. Tap a day
            to apply.
          </p>
        </section>
      ) : null}

      {advancedMode ? (
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
      ) : null}
    </div>
  );
}
