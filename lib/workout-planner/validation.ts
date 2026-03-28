import type {
  CalendarStatusRequest,
  ExperienceLevel,
  ManualPlanRequest,
  PlannerGoal,
  PlannerRequest,
  PlanExerciseInput,
  WorkoutLogRequest,
  WorkoutStatus,
} from "@/lib/workout-planner/types";

const GOALS: PlannerGoal[] = [
  "fat_loss",
  "hypertrophy",
  "strength",
  "general_fitness",
];
const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];
const WORKOUT_STATUSES: WorkoutStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "missed",
  "rest_day",
];
const CALENDAR_STATUSES = ["completed", "missed", "rest_day", "planned"] as const;

function normalizePlannerGoal(value: string): PlannerGoal | null {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, PlannerGoal> = {
    fat_loss: "fat_loss",
    "fat-loss": "fat_loss",
    weight_loss: "fat_loss",
    "weight-loss": "fat_loss",
    hypertrophy: "hypertrophy",
    muscle_gain: "hypertrophy",
    "muscle-gain": "hypertrophy",
    strength: "strength",
    general_fitness: "general_fitness",
    "general-fitness": "general_fitness",
    endurance: "general_fitness",
    flexibility: "general_fitness",
  };

  return aliases[normalized] ?? null;
}

function sanitizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeTextArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeText(entry))
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function assertDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
}

function parseExercise(input: unknown, index: number): PlanExerciseInput {
  if (!input || typeof input !== "object") {
    throw new Error(`Exercise at index ${index} is invalid`);
  }
  const source = input as Record<string, unknown>;
  const exerciseName = sanitizeText(source.exerciseName);
  const muscleGroup = sanitizeText(source.muscleGroup);
  if (!exerciseName) {
    throw new Error(`Exercise at index ${index} is missing exerciseName`);
  }
  if (!muscleGroup) {
    throw new Error(`Exercise at index ${index} is missing muscleGroup`);
  }

  const dayIndex = Math.max(1, Math.min(7, Math.floor(toNumber(source.dayIndex, 1))));
  const exerciseOrder = Math.max(
    1,
    Math.min(20, Math.floor(toNumber(source.exerciseOrder, index + 1))),
  );
  const sets = Math.max(1, Math.min(10, Math.floor(toNumber(source.sets, 3))));
  const repsMin = Math.max(1, Math.min(50, Math.floor(toNumber(source.repsMin, 8))));
  const repsMax = Math.max(repsMin, Math.min(60, Math.floor(toNumber(source.repsMax, 12))));
  const restSeconds = Math.max(
    15,
    Math.min(300, Math.floor(toNumber(source.restSeconds, 60))),
  );
  const difficultyRaw = sanitizeText(source.difficultyLevel).toLowerCase();
  const difficultyLevel = EXPERIENCE_LEVELS.includes(difficultyRaw as ExperienceLevel)
    ? (difficultyRaw as ExperienceLevel)
    : "intermediate";
  const rpe = Math.max(1, Math.min(10, toNumber(source.rpe, 7)));
  const tempo = sanitizeText(source.tempo, "2-0-2");
  const supersetGroupRaw = sanitizeText(source.supersetGroup).toUpperCase();
  const supersetGroup =
    supersetGroupRaw.length > 0
      ? supersetGroupRaw.replace(/[^A-Z0-9_-]/g, "").slice(0, 8)
      : null;

  return {
    dayIndex,
    exerciseOrder,
    exerciseId: sanitizeText(source.exerciseId) || null,
    exerciseName,
    muscleGroup,
    sets,
    repsMin,
    repsMax,
    restSeconds,
    tempo,
    rpe,
    notes: sanitizeText(source.notes),
    supersetGroup,
    difficultyLevel,
    equipmentRequired: sanitizeTextArray(source.equipmentRequired),
    cloudinaryImageId: sanitizeText(source.cloudinaryImageId) || null,
    cloudinaryGifId: sanitizeText(source.cloudinaryGifId) || null,
    createdBy: "user",
    visibility: sanitizeText(source.visibility) === "public" ? "public" : "private",
  };
}

export function validatePlannerRequest(payload: unknown): PlannerRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  const source = payload as Record<string, unknown>;

  const goalRaw = sanitizeText(source.goal);
  const goal = normalizePlannerGoal(goalRaw);
  if (!goal || !GOALS.includes(goal)) {
    throw new Error("goal is invalid");
  }
  const experienceRaw = sanitizeText(source.experienceLevel).toLowerCase();
  if (!EXPERIENCE_LEVELS.includes(experienceRaw as ExperienceLevel)) {
    throw new Error("experienceLevel is invalid");
  }
  const workoutDaysPerWeek = Math.max(
    1,
    Math.min(7, Math.floor(toNumber(source.workoutDaysPerWeek, 4))),
  );
  const name = sanitizeText(source.name) || "Smart Plan";
  const splitPreference = sanitizeText(source.splitPreference);

  return {
    name,
    goal,
    experienceLevel: experienceRaw as ExperienceLevel,
    workoutDaysPerWeek,
    preferredEquipment: sanitizeTextArray(source.preferredEquipment),
    splitPreference: splitPreference || undefined,
    language:
      sanitizeText(source.language) === "hi" ||
      sanitizeText(source.language) === "bi"
        ? (sanitizeText(source.language) as "hi" | "bi")
        : "en",
    visibility: sanitizeText(source.visibility) === "public" ? "public" : "private",
  };
}

export function validateManualPlanRequest(payload: unknown): ManualPlanRequest {
  const base = validatePlannerRequest(payload);
  const source = payload as Record<string, unknown>;
  const name = sanitizeText(source.name);
  if (!name) {
    throw new Error("Manual plan requires a name");
  }
  const exercisesRaw = source.exercises;
  if (!Array.isArray(exercisesRaw) || exercisesRaw.length === 0) {
    throw new Error("Manual plan requires at least one exercise");
  }
  const exercises = exercisesRaw.map((item, index) => parseExercise(item, index));

  return {
    name,
    goal: base.goal,
    experienceLevel: base.experienceLevel,
    workoutDaysPerWeek: base.workoutDaysPerWeek,
    visibility: base.visibility,
    notes: sanitizeText(source.notes),
    exercises,
  };
}

export function validatePlanExercisesPatch(payload: unknown): PlanExerciseInput[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  const source = payload as Record<string, unknown>;
  if (!Array.isArray(source.exercises)) {
    throw new Error("exercises must be an array");
  }
  if (source.exercises.length === 0) {
    throw new Error("exercises cannot be empty");
  }
  return source.exercises.map((item, index) => parseExercise(item, index));
}

export function validateWorkoutLogRequest(payload: unknown): WorkoutLogRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  const source = payload as Record<string, unknown>;
  const date = sanitizeText(source.date);
  assertDate(date, "date");

  const statusRaw = sanitizeText(source.status).toLowerCase();
  if (!WORKOUT_STATUSES.includes(statusRaw as WorkoutStatus)) {
    throw new Error("status is invalid");
  }
  return {
    date,
    status: statusRaw as WorkoutStatus,
    planId: sanitizeText(source.planId) || null,
    completionPercentage: Math.max(
      0,
      Math.min(100, Number(toNumber(source.completionPercentage, 0).toFixed(2))),
    ),
    totalExercises: Math.max(0, Math.floor(toNumber(source.totalExercises, 0))),
    exercisesCompleted: Math.max(0, Math.floor(toNumber(source.exercisesCompleted, 0))),
    totalDurationMinutes: Math.max(
      0,
      Math.floor(toNumber(source.totalDurationMinutes, 0)),
    ),
    caloriesBurned: Math.max(0, Math.floor(toNumber(source.caloriesBurned, 0))),
    notes: sanitizeText(source.notes),
    source: sanitizeText(source.source) === "manual" ? "manual" : "planner",
  };
}

export function validateCalendarStatusRequest(
  payload: unknown,
): CalendarStatusRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  const source = payload as Record<string, unknown>;
  const date = sanitizeText(source.date);
  assertDate(date, "date");
  const statusRaw = sanitizeText(source.status).toLowerCase();
  if (!CALENDAR_STATUSES.includes(statusRaw as (typeof CALENDAR_STATUSES)[number])) {
    throw new Error("status is invalid");
  }
  return {
    date,
    status: statusRaw as CalendarStatusRequest["status"],
    workoutLogId: sanitizeText(source.workoutLogId) || null,
    notes: sanitizeText(source.notes),
  };
}

export function parseMonthQuery(raw: string | null) {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    throw new Error("month query must be YYYY-MM");
  }
  const [yearText, monthText] = raw.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month query is invalid");
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  return { monthStart, monthEnd };
}
