import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";

export type ServiceContext = {
  client: SupabaseClient;
  profileId: string;
};

export type NormalizedRecommendationRequest = {
  workoutDate: string;
  planId?: string;
  dayIndex: number;
  lookbackDays: number;
};

export type WorkoutRecommendationRead = {
  recommendations: TrainingIntelligenceResult;
  cacheState: "exact" | "plan_fallback" | "baseline";
  cacheTtl: {
    exists: boolean;
    isStale: boolean;
    updatedAt: string | null;
    planId: string;
    workoutDate: string;
    dayIndex: number;
    lookbackDays: number;
  };
};

export type WorkoutPlanInsert = {
  user_id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  muscle_split: unknown;
  planning_mode: "smart" | "manual";
  created_by: "system" | "user";
  visibility: "public" | "private";
  notes: string | null;
};

export type PlanExerciseRead = {
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
  tempo: string | null;
  rpe: number | null;
  notes: string | null;
  superset_group: string | null;
  difficulty_level: string;
  equipment_required: string[];
  cloudinary_image_id: string | null;
  cloudinary_gif_id: string | null;
  created_by: "system" | "user";
  visibility: "public" | "private";
  created_at: string;
  updated_at: string;
};

export const EXERCISE_CATALOG_LIST_SELECT =
  "id,slug,name,target_muscle,secondary_muscles,difficulty_level,equipment_required,cloudinary_image_id,cloudinary_gif_id,visibility";

export type PlanWithExercisesRead = {
  plan: {
    id: string;
    name: string;
    goal: string;
    experience_level: string;
    workout_days_per_week: number;
    muscle_split: unknown;
    planning_mode: "smart" | "manual";
    created_by: "system" | "user";
    visibility: "public" | "private";
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  exercises: PlanExerciseRead[];
};

export type ExerciseSearchInput = {
  query?: string;
  muscle?: string;
  difficulty?: string;
  limit?: number;
};

export type CreateCustomExerciseInput = {
  name: string;
  targetMuscle: string;
  secondaryMuscles?: string[];
  difficultyLevel?: "beginner" | "intermediate" | "advanced";
  equipmentRequired?: string[];
  instructions?: string[];
  cloudinaryImageId?: string | null;
  cloudinaryGifId?: string | null;
  visibility?: "public" | "private";
};

export type ExerciseSuggestionInput = {
  planId: string;
  dayIndex?: number;
  limit?: number;
  query?: string;
};

export type UpdatePlanInput = {
  isActive?: boolean;
  name?: string;
  goal?: string;
  workoutDaysPerWeek?: number;
};