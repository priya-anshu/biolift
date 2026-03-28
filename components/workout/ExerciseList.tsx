"use client";

import { memo } from "react";
import { ExerciseRow } from "./ExerciseRow";
import type { SessionExercise, SessionWorkoutLog } from "./types";

type ExerciseMutationPayload = Record<string, unknown>;

export const ExerciseList = memo(function ExerciseList({
  exercises,
  workoutLog,
  completed,
  canStartExercises,
  activeExerciseId,
  setActiveExerciseId,
  onSetSaved,
  onSetDeleted,
}: {
  exercises: SessionExercise[];
  workoutLog: SessionWorkoutLog | null;
  completed: boolean;
  canStartExercises: boolean;
  activeExerciseId: string | null;
  setActiveExerciseId: (id: string) => void;
  onSetSaved: (exerciseId: string, payload: ExerciseMutationPayload) => void;
  onSetDeleted: (exerciseId: string, payload: ExerciseMutationPayload) => void;
}) {
  return (
    <>
      {exercises.map((exercise) => (
        <ExerciseRow
          key={exercise.workout_log_exercise_id}
          exercise={exercise}
          workoutLog={workoutLog}
          completed={completed}
          canStartExercises={canStartExercises}
          isActive={activeExerciseId === exercise.workout_log_exercise_id}
          onSetActive={() => setActiveExerciseId(exercise.workout_log_exercise_id)}
          onSetSaved={(payload) => onSetSaved(exercise.workout_log_exercise_id, payload)}
          onSetDeleted={(payload) => onSetDeleted(exercise.workout_log_exercise_id, payload)}
        />
      ))}
    </>
  );
});
