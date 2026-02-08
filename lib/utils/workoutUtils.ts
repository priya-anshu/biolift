type WorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  type: string;
  muscleGroup: string;
};

export type WorkoutTemplate = {
  name: string;
  difficulty: string;
  duration: string;
  calories: string;
  focus?: string;
  equipment?: string[];
  exercises: WorkoutExercise[];
};

export const workoutTemplates: Record<string, Record<string, WorkoutTemplate>> = {
  beginner: {
    "Full Body Beginner": {
      name: "Full Body Beginner",
      difficulty: "beginner",
      duration: "30 min",
      calories: "200",
      focus: "full-body",
      equipment: ["bodyweight"],
      exercises: [
        {
          name: "Push-ups",
          sets: 2,
          reps: "5-8",
          rest: "60s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Squats",
          sets: 2,
          reps: "10-12",
          rest: "60s",
          type: "strength",
          muscleGroup: "legs",
        },
        {
          name: "Planks",
          sets: 2,
          reps: "20s",
          rest: "45s",
          type: "core",
          muscleGroup: "core",
        },
        {
          name: "Jumping Jacks",
          sets: 2,
          reps: "15-20",
          rest: "45s",
          type: "cardio",
          muscleGroup: "full-body",
        },
      ],
    },
    "Upper Body Focus": {
      name: "Upper Body Focus",
      difficulty: "beginner",
      duration: "25 min",
      calories: "180",
      focus: "upper-body",
      equipment: ["bodyweight"],
      exercises: [
        {
          name: "Push-ups",
          sets: 3,
          reps: "5-8",
          rest: "60s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Planks",
          sets: 3,
          reps: "20s",
          rest: "45s",
          type: "core",
          muscleGroup: "core",
        },
        {
          name: "Arm Circles",
          sets: 2,
          reps: "10 each direction",
          rest: "30s",
          type: "mobility",
          muscleGroup: "shoulders",
        },
      ],
    },
  },
  intermediate: {
    "Strength Training": {
      name: "Strength Training",
      difficulty: "intermediate",
      duration: "45 min",
      calories: "350",
      focus: "strength",
      equipment: ["dumbbells", "resistance-bands"],
      exercises: [
        {
          name: "Dumbbell Bench Press",
          sets: 3,
          reps: "8-10",
          rest: "90s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Dumbbell Rows",
          sets: 3,
          reps: "10-12 each",
          rest: "90s",
          type: "strength",
          muscleGroup: "back",
        },
        {
          name: "Dumbbell Shoulder Press",
          sets: 3,
          reps: "8-10",
          rest: "90s",
          type: "strength",
          muscleGroup: "shoulders",
        },
        {
          name: "Dumbbell Bicep Curl",
          sets: 3,
          reps: "10-12",
          rest: "60s",
          type: "strength",
          muscleGroup: "biceps",
        },
      ],
    },
    "HIIT Cardio": {
      name: "HIIT Cardio",
      difficulty: "intermediate",
      duration: "30 min",
      calories: "400",
      focus: "cardio",
      equipment: ["bodyweight"],
      exercises: [
        {
          name: "Burpees",
          sets: 4,
          reps: "30s work, 30s rest",
          rest: "60s",
          type: "cardio",
          muscleGroup: "full-body",
        },
        {
          name: "Mountain Climbers",
          sets: 4,
          reps: "30s work, 30s rest",
          rest: "60s",
          type: "cardio",
          muscleGroup: "core",
        },
        {
          name: "Jump Squats",
          sets: 4,
          reps: "30s work, 30s rest",
          rest: "60s",
          type: "cardio",
          muscleGroup: "legs",
        },
      ],
    },
  },
  advanced: {
    Powerlifting: {
      name: "Powerlifting",
      difficulty: "advanced",
      duration: "60 min",
      calories: "500",
      focus: "strength",
      equipment: ["full-gym"],
      exercises: [
        {
          name: "Barbell Squat",
          sets: 5,
          reps: "3-5",
          rest: "180s",
          type: "strength",
          muscleGroup: "legs",
        },
        {
          name: "Barbell Deadlift",
          sets: 3,
          reps: "3-5",
          rest: "180s",
          type: "strength",
          muscleGroup: "back",
        },
        {
          name: "Barbell Bench Press",
          sets: 5,
          reps: "3-5",
          rest: "180s",
          type: "strength",
          muscleGroup: "chest",
        },
      ],
    },
    "Advanced Bodybuilding": {
      name: "Advanced Bodybuilding",
      difficulty: "advanced",
      duration: "75 min",
      calories: "450",
      focus: "hypertrophy",
      equipment: ["full-gym"],
      exercises: [
        {
          name: "Barbell Bench Press",
          sets: 4,
          reps: "8-12",
          rest: "120s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Incline Dumbbell Press",
          sets: 3,
          reps: "10-12",
          rest: "90s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Cable Flyes",
          sets: 3,
          reps: "12-15",
          rest: "60s",
          type: "strength",
          muscleGroup: "chest",
        },
        {
          name: "Dips",
          sets: 3,
          reps: "8-12",
          rest: "90s",
          type: "strength",
          muscleGroup: "triceps",
        },
      ],
    },
  },
};

export const getWorkoutTemplates = (difficulty = "all") => {
  if (difficulty === "all") {
    return {
      ...workoutTemplates.beginner,
      ...workoutTemplates.intermediate,
      ...workoutTemplates.advanced,
    };
  }
  return workoutTemplates[difficulty] || {};
};

export const getWorkoutTemplate = (templateName: string) => {
  for (const difficulty in workoutTemplates) {
    if (workoutTemplates[difficulty][templateName]) {
      return workoutTemplates[difficulty][templateName];
    }
  }
  return null;
};

export const calculateWorkoutCalories = (
  workout: WorkoutTemplate,
  userWeight = 70,
) => {
  let baseCalories = 0;
  workout.exercises.forEach((exercise) => {
    let exerciseCalories = 0;
    const sets = exercise.sets;
    const reps = parseInt(exercise.reps.split("-")[0]) || 10;
    switch (exercise.type) {
      case "strength":
        exerciseCalories = sets * reps * 0.5;
        break;
      case "cardio":
        exerciseCalories = sets * reps * 1.2;
        break;
      case "core":
        exerciseCalories = sets * reps * 0.3;
        break;
      default:
        exerciseCalories = sets * reps * 0.5;
    }
    baseCalories += exerciseCalories;
  });
  const weightMultiplier = userWeight / 70;
  return Math.round(baseCalories * weightMultiplier);
};

export class WorkoutSession {
  template: WorkoutTemplate;
  currentExercise: number;
  currentSet: number;
  isActive: boolean;
  startTime: Date | null;
  endTime: Date | null;
  totalTime: number;
  caloriesBurned: number;

  constructor(workoutTemplate: WorkoutTemplate) {
    this.template = workoutTemplate;
    this.currentExercise = 0;
    this.currentSet = 0;
    this.isActive = false;
    this.startTime = null;
    this.endTime = null;
    this.totalTime = 0;
    this.caloriesBurned = 0;
  }

  start() {
    this.isActive = true;
    this.startTime = new Date();
    this.currentExercise = 0;
    this.currentSet = 0;
  }

  pause() {
    this.isActive = false;
  }

  resume() {
    this.isActive = true;
  }

  nextSet() {
    if (
      this.currentSet <
      this.template.exercises[this.currentExercise].sets - 1
    ) {
      this.currentSet++;
    } else {
      this.nextExercise();
    }
  }

  nextExercise() {
    if (this.currentExercise < this.template.exercises.length - 1) {
      this.currentExercise++;
      this.currentSet = 0;
    } else {
      this.complete();
    }
  }

  complete() {
    this.isActive = false;
    this.endTime = new Date();
    if (this.startTime) {
      this.totalTime = (this.endTime.getTime() - this.startTime.getTime()) / 60000;
    }
    this.caloriesBurned = calculateWorkoutCalories(this.template);
  }
}

