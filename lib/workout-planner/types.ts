export type PlannerGoal =
  | "fat_loss"
  | "hypertrophy"
  | "strength"
  | "general_fitness";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type PlannerMode = "smart" | "manual";

export type PlanVisibility = "public" | "private";

export type CreatedBy = "system" | "user";

export type WorkoutStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "missed"
  | "rest_day";

export type CalendarDayStatus = "completed" | "missed" | "rest_day" | "planned";

export type ExerciseVisibility = "public" | "private";

export type PlannerRequest = {
  name?: string;
  goal: PlannerGoal;
  experienceLevel: ExperienceLevel;
  workoutDaysPerWeek: number;
  preferredEquipment?: string[];
  splitPreference?: string;
  language?: "en" | "hi" | "bi";
  visibility?: PlanVisibility;
};

export type PlanExerciseInput = {
  dayIndex: number;
  exerciseOrder: number;
  exerciseId?: string | null;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  tempo?: string;
  rpe?: number;
  notes?: string;
  difficultyLevel: ExperienceLevel;
  equipmentRequired?: string[];
  cloudinaryImageId?: string | null;
  cloudinaryGifId?: string | null;
  createdBy?: CreatedBy;
  visibility?: ExerciseVisibility;
};

export type ManualPlanRequest = {
  name: string;
  goal: PlannerGoal;
  experienceLevel: ExperienceLevel;
  workoutDaysPerWeek: number;
  visibility?: PlanVisibility;
  notes?: string;
  exercises: PlanExerciseInput[];
};

export type CalendarStatusRequest = {
  date: string;
  status: CalendarDayStatus;
  workoutLogId?: string | null;
  notes?: string;
};

export type WorkoutLogRequest = {
  date: string;
  planId?: string | null;
  status: WorkoutStatus;
  completionPercentage?: number;
  totalExercises?: number;
  exercisesCompleted?: number;
  totalDurationMinutes?: number;
  caloriesBurned?: number;
  notes?: string;
  source?: "planner" | "manual";
};

export type ExerciseCatalogRow = {
  id: string;
  name: string;
  target_muscle: string;
  secondary_muscles: string[];
  difficulty_level: ExperienceLevel;
  equipment_required: string[];
  instructions: string[];
  cloudinary_image_id: string | null;
  cloudinary_gif_id: string | null;
  visibility: ExerciseVisibility;
};

export type PlannedExercise = {
  dayIndex: number;
  exerciseOrder: number;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  tempo: string;
  rpe: number;
  notes: string;
  difficultyLevel: ExperienceLevel;
  equipmentRequired: string[];
  cloudinaryImageId: string | null;
  cloudinaryGifId: string | null;
};
