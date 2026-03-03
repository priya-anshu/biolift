import type {
  ExerciseCatalogRow,
  ExperienceLevel,
  PlannedExercise,
  PlannerGoal,
  PlannerRequest,
} from "@/lib/workout-planner/types";

type IntensityPreset = {
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  rpe: number;
};

const GOAL_PRESETS: Record<PlannerGoal, IntensityPreset> = {
  fat_loss: {
    setsMin: 3,
    setsMax: 4,
    repsMin: 12,
    repsMax: 16,
    restSeconds: 45,
    rpe: 7,
  },
  hypertrophy: {
    setsMin: 3,
    setsMax: 5,
    repsMin: 8,
    repsMax: 12,
    restSeconds: 75,
    rpe: 8,
  },
  strength: {
    setsMin: 4,
    setsMax: 6,
    repsMin: 3,
    repsMax: 6,
    restSeconds: 150,
    rpe: 8.5,
  },
  general_fitness: {
    setsMin: 3,
    setsMax: 4,
    repsMin: 10,
    repsMax: 14,
    restSeconds: 60,
    rpe: 7.5,
  },
};

const BASE_SPLITS: Record<number, string[][]> = {
  1: [["full_body"]],
  2: [["upper"], ["lower"]],
  3: [["push"], ["pull"], ["legs"]],
  4: [["upper"], ["lower"], ["push"], ["pull"]],
  5: [["push"], ["pull"], ["legs"], ["upper"], ["lower"]],
  6: [["push"], ["pull"], ["legs"], ["push"], ["pull"], ["legs"]],
  7: [["push"], ["pull"], ["legs"], ["upper"], ["lower"], ["core"], ["conditioning"]],
};

const SPLIT_TO_MUSCLES: Record<string, string[]> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps", "rear delts"],
  legs: ["quadriceps", "hamstrings", "glutes", "calves"],
  upper: ["chest", "back", "shoulders", "biceps", "triceps"],
  lower: ["quadriceps", "hamstrings", "glutes", "calves", "core"],
  full_body: ["quadriceps", "chest", "back", "shoulders", "core"],
  core: ["core"],
  conditioning: ["core", "calves"],
};

function experienceMultiplier(level: ExperienceLevel) {
  if (level === "beginner") return 0.9;
  if (level === "advanced") return 1.15;
  return 1;
}

function normalizeSplitPreference(splitPreference: string | undefined) {
  const normalized = (splitPreference ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function buildSplitDays(input: PlannerRequest) {
  const fallback = BASE_SPLITS[input.workoutDaysPerWeek] ?? BASE_SPLITS[4];
  const preference = normalizeSplitPreference(input.splitPreference);
  if (!preference) return fallback;

  if (preference === "push_pull_legs") {
    const sequence = ["push", "pull", "legs"];
    return Array.from({ length: input.workoutDaysPerWeek }, (_, index) => [
      sequence[index % sequence.length],
    ]);
  }
  if (preference === "upper_lower") {
    const sequence = ["upper", "lower"];
    return Array.from({ length: input.workoutDaysPerWeek }, (_, index) => [
      sequence[index % sequence.length],
    ]);
  }
  if (preference === "full_body") {
    return Array.from({ length: input.workoutDaysPerWeek }, () => ["full_body"]);
  }
  return fallback;
}

function muscleOverlap(musclesA: string[], musclesB: string[]) {
  const setB = new Set(musclesB);
  return musclesA.filter((muscle) => setB.has(muscle)).length;
}

function rebalanceSplitDays(days: string[][]) {
  const rebalanced = [...days.map((day) => [...day])];
  for (let index = 1; index < rebalanced.length; index += 1) {
    const prevMuscles = rebalanced[index - 1].flatMap(
      (split) => SPLIT_TO_MUSCLES[split] ?? [],
    );
    const currentMuscles = rebalanced[index].flatMap(
      (split) => SPLIT_TO_MUSCLES[split] ?? [],
    );
    if (muscleOverlap(prevMuscles, currentMuscles) <= 2) continue;

    const nextIndex = rebalanced.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index) return false;
      const candidateMuscles = candidate.flatMap(
        (split) => SPLIT_TO_MUSCLES[split] ?? [],
      );
      return muscleOverlap(prevMuscles, candidateMuscles) <= 2;
    });

    if (nextIndex !== -1) {
      const tmp = rebalanced[index];
      rebalanced[index] = rebalanced[nextIndex];
      rebalanced[nextIndex] = tmp;
    } else {
      rebalanced[index] = ["conditioning"];
    }
  }
  return rebalanced;
}

function filterCatalogByExperience(
  catalog: ExerciseCatalogRow[],
  level: ExperienceLevel,
) {
  const allowed =
    level === "advanced"
      ? new Set(["beginner", "intermediate", "advanced"])
      : level === "intermediate"
        ? new Set(["beginner", "intermediate"])
        : new Set(["beginner"]);
  return catalog.filter((row) => allowed.has(row.difficulty_level));
}

function pickExercisesForMuscle(
  catalog: ExerciseCatalogRow[],
  muscleGroup: string,
  count: number,
  preferredEquipment: string[],
) {
  const preferredSet = new Set(preferredEquipment.map((item) => item.toLowerCase()));
  const exact = catalog.filter((item) => item.target_muscle === muscleGroup);
  const withSecondary = catalog.filter((item) =>
    item.secondary_muscles.includes(muscleGroup),
  );
  const combined = [...exact, ...withSecondary];
  const deduped = combined.filter(
    (item, index) => combined.findIndex((entry) => entry.id === item.id) === index,
  );

  deduped.sort((a, b) => {
    const scoreA = a.equipment_required.some((eq) =>
      preferredSet.has(eq.toLowerCase()),
    )
      ? 1
      : 0;
    const scoreB = b.equipment_required.some((eq) =>
      preferredSet.has(eq.toLowerCase()),
    )
      ? 1
      : 0;
    return scoreB - scoreA;
  });

  return deduped.slice(0, count);
}

export function buildSmartExercises(
  input: PlannerRequest,
  catalog: ExerciseCatalogRow[],
): PlannedExercise[] {
  const preset = GOAL_PRESETS[input.goal];
  const multiplier = experienceMultiplier(input.experienceLevel);
  const eligibleCatalog = filterCatalogByExperience(catalog, input.experienceLevel);
  const splitDays = rebalanceSplitDays(buildSplitDays(input));
  const preferredEquipment = input.preferredEquipment ?? [];

  const rows: PlannedExercise[] = [];

  splitDays.forEach((daySplits, dayIndex) => {
    const targetMuscles = daySplits.flatMap((split) => SPLIT_TO_MUSCLES[split] ?? []);
    const uniqueMuscles = targetMuscles.filter(
      (muscle, index) => targetMuscles.indexOf(muscle) === index,
    );
    const perDayExerciseCount = Math.max(4, Math.min(7, uniqueMuscles.length + 1));
    const chosen: ExerciseCatalogRow[] = [];

    uniqueMuscles.forEach((muscle) => {
      if (chosen.length >= perDayExerciseCount) return;
      const picks = pickExercisesForMuscle(
        eligibleCatalog,
        muscle,
        1,
        preferredEquipment,
      );
      picks.forEach((item) => {
        if (!chosen.some((existing) => existing.id === item.id)) {
          chosen.push(item);
        }
      });
    });

    if (chosen.length < perDayExerciseCount) {
      eligibleCatalog.forEach((candidate) => {
        if (chosen.length >= perDayExerciseCount) return;
        if (chosen.some((existing) => existing.id === candidate.id)) return;
        chosen.push(candidate);
      });
    }

    chosen.forEach((exercise, exerciseOrder) => {
      const sets = Math.max(
        1,
        Math.min(8, Math.round(((preset.setsMin + preset.setsMax) / 2) * multiplier)),
      );
      const repsMin = Math.max(1, Math.round(preset.repsMin * multiplier));
      const repsMax = Math.max(repsMin + 1, Math.round(preset.repsMax * multiplier));
      const restSeconds = Math.max(20, Math.round(preset.restSeconds / multiplier));
      const rpe = Math.max(6, Math.min(10, Number((preset.rpe * multiplier).toFixed(1))));

      rows.push({
        dayIndex: dayIndex + 1,
        exerciseOrder: exerciseOrder + 1,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.target_muscle,
        sets,
        repsMin,
        repsMax,
        restSeconds,
        tempo: "2-0-2",
        rpe,
        notes: `Focus on ${input.goal.replace("_", " ")} progression.`,
        difficultyLevel: exercise.difficulty_level,
        equipmentRequired: exercise.equipment_required,
        cloudinaryImageId: exercise.cloudinary_image_id,
        cloudinaryGifId: exercise.cloudinary_gif_id,
      });
    });
  });

  return rows;
}
