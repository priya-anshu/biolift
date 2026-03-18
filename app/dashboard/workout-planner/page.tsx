"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Brain,
  CheckCircle,
  Clock,
  Dumbbell,
  Heart,
  List,
  PenTool,
  Play,
  Plus,
  Save,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type PlannerMode = "selection" | "wizard" | "manual" | "defaults";

type Plan = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  muscle_split: unknown;
  planning_mode: "smart" | "manual";
  is_active: boolean;
};

type PlanExercise = {
  id: string;
  plan_id: string;
  day_index: number;
  exercise_order: number;
  exercise_id: string | null;
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  rpe: number | null;
  superset_group: string | null;
  difficulty_level: string;
  equipment_required: string[];
};

type WizardData = {
  goal: string;
  fitnessLevel: string;
  availableDays: string[];
  workoutDuration: string;
  focusAreas: string[];
  experience: string;
  equipment: string[];
  timeOfDay: string;
};

const initialWizardData: WizardData = {
  goal: "",
  fitnessLevel: "",
  availableDays: [],
  workoutDuration: "",
  focusAreas: [],
  experience: "",
  equipment: [],
  timeOfDay: "",
};

const goals = [
  { id: "weight-loss", label: "Weight Loss", icon: Target, description: "Focus on cardio and calorie burning" },
  { id: "muscle-gain", label: "Muscle Gain", icon: Dumbbell, description: "Strength training and hypertrophy" },
  { id: "endurance", label: "Endurance", icon: Heart, description: "Improve cardiovascular fitness" },
  { id: "flexibility", label: "Flexibility", icon: Activity, description: "Yoga and mobility work" },
  { id: "general-fitness", label: "General Fitness", icon: Zap, description: "Balanced overall fitness" },
] as const;

const fitnessLevels = [
  { id: "beginner", label: "Beginner", description: "New to fitness or returning after a long break" },
  { id: "intermediate", label: "Intermediate", description: "Regular exercise routine, some experience" },
  { id: "advanced", label: "Advanced", description: "Consistent training, good form and knowledge" },
] as const;

const availableDays = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
] as const;

const focusAreas = [
  { id: "upper-body", label: "Upper Body", icon: Dumbbell },
  { id: "lower-body", label: "Lower Body", icon: Activity },
  { id: "core", label: "Core", icon: Target },
  { id: "cardio", label: "Cardio", icon: Heart },
  { id: "full-body", label: "Full Body", icon: Zap },
] as const;

const equipmentOptions = [
  { id: "bodyweight", label: "Bodyweight Only", description: "No equipment needed" },
  { id: "dumbbells", label: "Dumbbells", description: "Basic weight training" },
  { id: "resistance-bands", label: "Resistance Bands", description: "Portable and versatile" },
  { id: "full-gym", label: "Full Gym Access", description: "All equipment available" },
] as const;

const timeOfDayOptions = [
  { id: "morning", label: "Morning", description: "Start your day strong" },
  { id: "afternoon", label: "Afternoon", description: "Midday energy boost" },
  { id: "evening", label: "Evening", description: "Unwind after work" },
] as const;

const experienceOptions = [
  { id: "new", label: "New to Exercise", description: "Starting my fitness journey" },
  { id: "some", label: "Some Experience", description: "I've worked out before" },
  { id: "experienced", label: "Experienced", description: "I know what I'm doing" },
] as const;

const durationOptions = [
  { id: "30", label: "30 minutes", description: "Quick and effective" },
  { id: "45", label: "45 minutes", description: "Balanced workout" },
  { id: "60", label: "60 minutes", description: "Comprehensive training" },
] as const;

function nice(text: string) {
  return text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalize(rows: PlanExercise[]) {
  const sorted = [...rows].sort((a, b) => a.day_index - b.day_index || a.exercise_order - b.exercise_order);
  const perDay = new Map<number, number>();

  return sorted.map((row) => {
    const day = Math.max(1, Math.min(7, Math.floor(Number(row.day_index) || 1)));
    const order = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, order);

    return {
      ...row,
      day_index: day,
      exercise_order: order,
      sets: Math.max(1, Math.min(20, Math.floor(Number(row.sets) || 3))),
      reps_min: Math.max(1, Math.min(120, Math.floor(Number(row.reps_min) || 8))),
      reps_max: Math.max(1, Math.min(120, Math.floor(Number(row.reps_max) || 12))),
      rest_seconds: Math.max(15, Math.min(900, Math.floor(Number(row.rest_seconds) || 60))),
    };
  });
}

function buildBlankRow(planId: string, dayIndex: number, difficultyLevel: string): PlanExercise {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    plan_id: planId,
    day_index: dayIndex,
    exercise_order: 1,
    exercise_id: null,
    exercise_name: "",
    muscle_group: "general",
    sets: 3,
    reps_min: 10,
    reps_max: 10,
    rest_seconds: 60,
    rpe: 7,
    superset_group: null,
    difficulty_level: difficultyLevel || "intermediate",
    equipment_required: [],
  };
}

function buildWeeklySchedule(data: WizardData) {
  const schedule: Array<{ day: string; workout: string }> = [];

  data.availableDays.forEach((day) => {
    if (data.focusAreas.includes("full-body")) {
      schedule.push({ day, workout: "Full Body Workout" });
      return;
    }

    if (data.focusAreas.includes("upper-body") && data.focusAreas.includes("lower-body")) {
      const index = schedule.length;
      schedule.push({ day, workout: index % 2 === 0 ? "Upper Body" : "Lower Body" });
      return;
    }

    if (data.focusAreas.includes("cardio")) {
      schedule.push({ day, workout: "Cardio + Core" });
      return;
    }

    schedule.push({ day, workout: "Strength Training" });
  });

  return schedule;
}

function mapGoalToApi(goal: string) {
  const goalMap: Record<string, string> = {
    "weight-loss": "weight_loss",
    "muscle-gain": "muscle_gain",
    endurance: "endurance",
    flexibility: "flexibility",
    "general-fitness": "general_fitness",
  };

  return goalMap[goal] ?? "general_fitness";
}

function mapEquipmentToApi(equipment: string[]) {
  const equipmentMap: Record<string, string[]> = {
    bodyweight: ["bodyweight"],
    dumbbells: ["dumbbells"],
    "resistance-bands": ["resistance_bands"],
    "full-gym": ["barbell", "dumbbells", "machines", "cables"],
  };

  const preferred = equipment.flatMap((item) => equipmentMap[item] ?? []);
  return preferred.length > 0 ? Array.from(new Set(preferred)) : ["bodyweight"];
}

export default function WorkoutPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [rows, setRows] = useState<PlanExercise[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<PlannerMode>("selection");
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>(initialWizardData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVisible, setGeneratedVisible] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans.find((plan) => plan.is_active) ?? null,
    [plans, selectedPlanId],
  );

  const exerciseRows = useMemo(() => normalize(rows), [rows]);

  const generatedExercises = useMemo(
    () => exerciseRows.map((row) => row.exercise_name.trim()).filter((value) => value.length > 0).slice(0, 8),
    [exerciseRows],
  );

  const weeklySchedule = useMemo(() => buildWeeklySchedule(wizardData), [wizardData]);

  const loadPlans = useCallback(async (forceActive = false) => {
    const response = await fetch("/api/workout-planner/plans", { cache: "no-store" });
    const body = (await response.json()) as { plans?: Plan[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Failed to load plans");

    const items = body.plans ?? [];
    const nextSelectedId =
      !forceActive && selectedPlanId && items.some((plan) => plan.id === selectedPlanId)
        ? selectedPlanId
        : (items.find((plan) => plan.is_active)?.id ?? items[0]?.id ?? null);

    setPlans(items);
    setSelectedPlanId(nextSelectedId);
    return nextSelectedId;
  }, [selectedPlanId]);

  const loadPlanDetail = useCallback(async (planId: string) => {
    const response = await fetch(`/api/workout-planner/plans/${planId}`, { cache: "no-store" });
    const body = (await response.json()) as { exercises?: PlanExercise[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Failed to load plan detail");
    setRows(normalize(body.exercises ?? []));
    setDirty(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadPlans()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load plans");
      })
      .finally(() => setLoading(false));
  }, [loadPlans]);

  useEffect(() => {
    if (!selectedPlanId) {
      setRows([]);
      return;
    }

    void loadPlanDetail(selectedPlanId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load plan detail");
    });
  }, [loadPlanDetail, selectedPlanId]);

  const handleWizardToggle = (
    field: "availableDays" | "focusAreas" | "equipment",
    value: string,
  ) => {
    setWizardData((current) => {
      const values = current[field];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  };

  const handleWizardValue = (
    field: Exclude<keyof WizardData, "availableDays" | "focusAreas" | "equipment">,
    value: string,
  ) => {
    setWizardData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return Boolean(wizardData.goal && wizardData.fitnessLevel);
      case 2:
        return wizardData.availableDays.length > 0 && Boolean(wizardData.workoutDuration);
      case 3:
        return wizardData.focusAreas.length > 0 && Boolean(wizardData.experience);
      case 4:
        return wizardData.equipment.length > 0 && Boolean(wizardData.timeOfDay);
      default:
        return false;
    }
  }, [currentStep, wizardData]);

  const nextStep = () => {
    if (!canProceed) return;
    setCurrentStep((current) => Math.min(current + 1, 4));
  };

  const prevStep = () => {
    setCurrentStep((current) => Math.max(current - 1, 1));
  };

  const generatePlan = async () => {
    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/workout-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${nice(wizardData.goal || "custom")} ${nice(wizardData.fitnessLevel || "plan")} Plan`,
          goal: mapGoalToApi(wizardData.goal),
          experienceLevel: wizardData.fitnessLevel || "intermediate",
          workoutDaysPerWeek: wizardData.availableDays.length || 4,
          preferredEquipment: mapEquipmentToApi(wizardData.equipment),
          visibility: "private",
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Failed to generate");

      const nextPlanId = await loadPlans(true);
      if (nextPlanId) {
        await loadPlanDetail(nextPlanId);
        setSelectedPlanId(nextPlanId);
      }

      setGeneratedVisible(true);
      setNotice("Plan generated.");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateExerciseRow = (id: string, updater: (row: PlanExercise) => PlanExercise) => {
    setRows((current) => normalize(current.map((row) => (row.id === id ? updater(row) : row))));
    setDirty(true);
  };

  const addManualExercise = () => {
    if (!selectedPlanId) return;

    const nextDay = exerciseRows[exerciseRows.length - 1]?.day_index ?? 1;
    const level = selectedPlan?.experience_level ?? "intermediate";
    setRows((current) => normalize([...current, buildBlankRow(selectedPlanId, nextDay, level)]));
    setDirty(true);
  };

  const removeManualExercise = (id: string) => {
    setRows((current) => normalize(current.filter((row) => row.id !== id)));
    setDirty(true);
  };

  const saveBuilder = async () => {
    if (!selectedPlanId) return;

    const validRows = normalize(rows).filter((row) => row.exercise_name.trim().length > 0);
    if (validRows.length === 0) {
      setError("Add at least one exercise before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const exercises = validRows.map((row) => ({
        dayIndex: row.day_index,
        exerciseOrder: row.exercise_order,
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        muscleGroup: row.muscle_group,
        sets: row.sets,
        repsMin: row.reps_min,
        repsMax: row.reps_max,
        restSeconds: row.rest_seconds,
        tempo: "2-0-2",
        rpe: row.rpe ?? 7,
        notes: "",
        supersetGroup: row.superset_group,
        difficultyLevel:
          row.difficulty_level === "beginner" || row.difficulty_level === "advanced"
            ? row.difficulty_level
            : "intermediate",
        equipmentRequired: row.equipment_required,
        cloudinaryImageId: null,
        cloudinaryGifId: null,
        createdBy: "user",
        visibility: "private",
      }));

      const response = await fetch(`/api/workout-planner/plans/${selectedPlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises }),
      });

      const body = (await response.json()) as { exercises?: PlanExercise[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Failed to save");

      setRows(normalize(body.exercises ?? []));
      setDirty(false);
      setNotice("Workout builder saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const renderSelectionScreen = () => (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
          How do you want to start?
        </h1>
        <p className="text-day-text-secondary dark:text-night-text-secondary">
          Choose the best way to create your workout routine
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card
          className="group cursor-pointer p-8 transition-all hover:border-day-accent-primary dark:hover:border-night-accent"
          onClick={() => {
            setMode("wizard");
            setGeneratedVisible(false);
          }}
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-blue-100 p-4 text-blue-600 transition-transform group-hover:scale-110 dark:bg-blue-900 dark:text-blue-300">
              <Brain className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold">AI Assistant</h3>
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Answer a few questions and let our AI build a perfect personalized schedule for you.
            </p>
          </div>
        </Card>

        <Card
          className="group cursor-pointer p-8 transition-all hover:border-day-accent-primary dark:hover:border-night-accent"
          onClick={() => setMode("manual")}
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-purple-100 p-4 text-purple-600 transition-transform group-hover:scale-110 dark:bg-purple-900 dark:text-purple-300">
              <PenTool className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold">Manual Builder</h3>
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Build your own plan from scratch. Choose specific exercises, sets, reps, and duration.
            </p>
          </div>
        </Card>

        <Card
          className="group cursor-pointer p-8 transition-all hover:border-day-accent-primary dark:hover:border-night-accent"
          onClick={() => setMode("defaults")}
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-green-100 p-4 text-green-600 transition-transform group-hover:scale-110 dark:bg-green-900 dark:text-green-300">
              <List className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold">Pre-made Plans</h3>
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Browse your available workout templates and start immediately.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderManualBuilder = () => (
    <div className="space-y-6">
      <div className="mb-6 flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => setMode("selection")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            Custom Plan Builder
          </h1>
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Define your exercises, reps, and sets.
          </p>
        </div>
      </div>

      <Card className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Plan Name</label>
            <input
              type="text"
              className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
              value={selectedPlan?.name ?? ""}
              placeholder="Select or create a plan first"
              readOnly
            />
          </div>
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Duration</label>
              <input
                type="number"
                className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                value={selectedPlan?.workout_days_per_week ?? 0}
                readOnly
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Unit</label>
              <select
                className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                value="days/week"
                disabled
              >
                <option value="days/week" className="bg-day-bg dark:bg-night-bg">
                  Days/Week
                </option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-day-border pt-4 dark:border-night-border">
          <h3 className="mb-4 flex items-center font-semibold">
            <Dumbbell className="mr-2 h-4 w-4" />
            Exercises
          </h3>

          <div className="space-y-4">
            {exerciseRows.map((exercise) => (
              <div
                key={exercise.id}
                className="flex flex-col items-end gap-3 rounded-lg bg-day-bg p-4 dark:bg-night-bg md:flex-row"
              >
                <div className="flex-grow">
                  <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Exercise Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bench Press"
                    className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                    value={exercise.exercise_name}
                    onChange={(event) =>
                      updateExerciseRow(exercise.id, (current) => ({
                        ...current,
                        exercise_name: event.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Day {exercise.day_index}
                  </p>
                </div>

                <div className="w-20">
                  <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Sets
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                    value={exercise.sets}
                    onChange={(event) =>
                      updateExerciseRow(exercise.id, (current) => ({
                        ...current,
                        sets: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>

                <div className="w-20">
                  <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Reps
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                    value={exercise.reps_max}
                    onChange={(event) => {
                      const reps = Math.max(1, Number(event.target.value) || 1);
                      updateExerciseRow(exercise.id, (current) => ({
                        ...current,
                        reps_min: reps,
                        reps_max: reps,
                      }));
                    }}
                  />
                </div>

                <div className="w-24">
                  <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Rest (sec)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border border-day-border bg-transparent p-2 dark:border-night-border"
                    value={exercise.rest_seconds}
                    onChange={(event) =>
                      updateExerciseRow(exercise.id, (current) => ({
                        ...current,
                        rest_seconds: Math.max(15, Number(event.target.value) || 60),
                      }))
                    }
                  />
                </div>

                <Button
                  variant="ghost"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removeManualExercise(exercise.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            className="mt-4 w-full border-2 border-dashed border-day-border dark:border-night-border"
            onClick={addManualExercise}
            disabled={!selectedPlanId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Exercise
          </Button>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="primary" onClick={() => void saveBuilder()} disabled={!selectedPlanId || saving || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Custom Plan"}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderDefaultPlans = () => (
    <div className="space-y-6">
      <div className="mb-6 flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => setMode("selection")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
            Select a Template
          </h1>
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Expertly crafted plans ready to go.
          </p>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            No plans available yet. Use the AI Assistant to generate your first program.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer p-6 transition-all hover:border-day-accent-primary dark:hover:border-night-accent"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    {nice(plan.goal)}
                  </p>
                </div>
                <Badge variant="primary">{nice(plan.experience_level)}</Badge>
              </div>
              <div className="mb-4 flex items-center text-sm text-day-text-secondary dark:text-night-text-secondary">
                <Clock className="mr-2 h-4 w-4" />
                {plan.workout_days_per_week} days/week
              </div>
              <Button
                variant="ghost"
                className="w-full border border-day-border dark:border-night-border"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setMode("manual");
                  setGeneratedVisible(false);
                }}
              >
                Select This Plan
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderWizard = () => (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center space-x-4"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (currentStep === 1 ? setMode("selection") : prevStep())}
          className="p-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
            Create Your Plan
          </h1>
          <p className="text-day-text-secondary dark:text-night-text-secondary">
            Let&apos;s build a personalized workout plan just for you
          </p>
        </div>
      </motion.div>

      <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-day-accent-primary to-day-accent-secondary transition-all duration-300 dark:from-night-accent dark:to-red-600"
          style={{ width: `${(currentStep / 4) * 100}%` }}
        />
      </div>

      <div className="flex justify-center space-x-4">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step <= currentStep
                ? "bg-day-accent-primary text-white dark:bg-night-accent"
                : "bg-day-hover text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary"
            }`}
          >
            {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {currentStep === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What&apos;s your main fitness goal?
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {goals.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        wizardData.goal === goal.id
                          ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                          : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                      }`}
                      onClick={() => handleWizardValue("goal", goal.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-6 w-6 text-day-accent-primary dark:text-night-accent" />
                        <div>
                          <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                            {goal.label}
                          </h3>
                          <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                            {goal.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What&apos;s your current fitness level?
              </h2>
              <div className="space-y-3">
                {fitnessLevels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                      wizardData.fitnessLevel === level.id
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardValue("fitnessLevel", level.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                          {level.label}
                        </h3>
                        <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          {level.description}
                        </p>
                      </div>
                      {wizardData.fitnessLevel === level.id ? (
                        <CheckCircle className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 2 ? (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                How many days per week can you work out?
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {availableDays.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    className={`rounded-lg border-2 p-3 text-center transition-all ${
                      wizardData.availableDays.includes(day.id)
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardToggle("availableDays", day.id)}
                  >
                    <span className="font-medium text-day-text-primary dark:text-night-text-primary">
                      {day.label}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                How long do you want each workout to be?
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {durationOptions.map((duration) => (
                  <button
                    key={duration.id}
                    type="button"
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      wizardData.workoutDuration === duration.id
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardValue("workoutDuration", duration.id)}
                  >
                    <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                      {duration.label}
                    </h3>
                    <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {duration.description}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 3 ? (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What areas would you like to focus on?
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {focusAreas.map((area) => {
                  const Icon = area.icon;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        wizardData.focusAreas.includes(area.id)
                          ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                          : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                      }`}
                      onClick={() => handleWizardToggle("focusAreas", area.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
                        <span className="font-medium text-day-text-primary dark:text-night-text-primary">
                          {area.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What&apos;s your experience with exercise?
              </h2>
              <div className="space-y-3">
                {experienceOptions.map((experience) => (
                  <button
                    key={experience.id}
                    type="button"
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                      wizardData.experience === experience.id
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardValue("experience", experience.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                          {experience.label}
                        </h3>
                        <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          {experience.description}
                        </p>
                      </div>
                      {wizardData.experience === experience.id ? (
                        <CheckCircle className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {currentStep === 4 ? (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What equipment do you have access to?
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {equipmentOptions.map((equipment) => (
                  <button
                    key={equipment.id}
                    type="button"
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      wizardData.equipment.includes(equipment.id)
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardToggle("equipment", equipment.id)}
                  >
                    <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                      {equipment.label}
                    </h3>
                    <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {equipment.description}
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                What time of day do you prefer to work out?
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {timeOfDayOptions.map((time) => (
                  <button
                    key={time.id}
                    type="button"
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      wizardData.timeOfDay === time.id
                        ? "border-day-accent-primary bg-day-accent-primary/10 dark:border-night-accent dark:bg-night-accent/10"
                        : "border-day-border hover:border-day-accent-primary/50 dark:border-night-border dark:hover:border-night-accent/50"
                    }`}
                    onClick={() => handleWizardValue("timeOfDay", time.id)}
                  >
                    <h3 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                      {time.label}
                    </h3>
                    <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {time.description}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={prevStep} disabled={currentStep === 1}>
          Previous
        </Button>

        {currentStep < 4 ? (
          <Button variant="primary" onClick={nextStep} disabled={!canProceed}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void generatePlan()} disabled={!canProceed || isGenerating}>
            {isGenerating ? "Generating..." : "Generate Plan"}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {generatedVisible && selectedPlan ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  Your Personalized Plan
                </h2>
                <Badge variant="primary" size="sm">
                  {selectedPlan.workout_days_per_week} days/week
                </Badge>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                    Plan Overview
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-day-text-secondary dark:text-night-text-secondary">Goal:</span>
                      <span className="font-medium capitalize">{nice(selectedPlan.goal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-day-text-secondary dark:text-night-text-secondary">Level:</span>
                      <span className="font-medium capitalize">{nice(selectedPlan.experience_level)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-day-text-secondary dark:text-night-text-secondary">Workouts/Week:</span>
                      <span className="font-medium">{selectedPlan.workout_days_per_week}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-day-text-secondary dark:text-night-text-secondary">Mode:</span>
                      <span className="font-medium capitalize">{nice(selectedPlan.planning_mode)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                    Weekly Schedule
                  </h3>
                  <div className="space-y-2">
                    {weeklySchedule.length > 0 ? (
                      weeklySchedule.map((item) => (
                        <div key={item.day} className="flex justify-between text-sm">
                          <span className="capitalize text-day-text-secondary dark:text-night-text-secondary">
                            {item.day}:
                          </span>
                          <span className="font-medium text-day-text-primary dark:text-night-text-primary">
                            {item.workout}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                        Weekly schedule will appear here after selecting your days.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                  Sample Exercises
                </h3>
                <div className="flex flex-wrap gap-2">
                  {generatedExercises.length > 0 ? (
                    generatedExercises.map((exercise) => (
                      <Badge key={exercise} variant="ghost" size="sm">
                        {exercise}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      Save or edit your plan to populate sample exercises.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <Link
                  href="/dashboard/workout-session"
                  className="inline-flex items-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-night-accent"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Plan
                </Link>
                <Button variant="secondary" onClick={() => setNotice("Plan saved to your programs.")}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Plan
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      {error ? <Card className="p-4 text-sm text-red-600 dark:text-red-300">{error}</Card> : null}
      {notice ? <Card className="p-4 text-sm text-emerald-600 dark:text-emerald-300">{notice}</Card> : null}

      {loading && mode !== "selection" ? <div className="skeleton h-24 rounded-2xl" /> : null}

      {mode === "selection" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {renderSelectionScreen()}
        </motion.div>
      ) : null}

      {mode === "manual" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {renderManualBuilder()}
        </motion.div>
      ) : null}

      {mode === "defaults" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {renderDefaultPlans()}
        </motion.div>
      ) : null}

      {mode === "wizard" ? renderWizard() : null}
    </div>
  );
}
