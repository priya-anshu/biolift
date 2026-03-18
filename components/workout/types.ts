import type { ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";

export type SetStatus = "completed" | "failed" | "skipped" | "warmup";

export type SessionSet = {
  id: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  set_status: SetStatus;
  performed_at: string | null;
};

export type SessionExercise = {
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

export type SessionWorkoutLog = {
  id: string;
  workout_date: string;
  status: string;
  completion_percentage: number;
  total_exercises: number;
  exercises_completed: number;
};
