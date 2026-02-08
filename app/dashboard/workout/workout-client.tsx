"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Timer,
  Target,
  Dumbbell,
  Heart,
  Zap,
  Clock,
  Settings,
  RotateCcw,
  Check,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ExerciseImage from "@/components/ExerciseImage";
import { getExerciseData } from "@/lib/utils/exerciseUtils";
import {
  getWorkoutTemplate,
  WorkoutSession,
  type WorkoutTemplate,
} from "@/lib/utils/workoutUtils";

export default function WorkoutClient() {
  const searchParams = useSearchParams();
  const [currentExercise, setCurrentExercise] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(45);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [repMultiplier, setRepMultiplier] = useState(1);
  const [setAdjustment, setSetAdjustment] = useState(0);
  const [restSeconds, setRestSeconds] = useState(60);
  const [showHeartRate, setShowHeartRate] = useState(false);
  const [isHeartTracking, setIsHeartTracking] = useState(false);
  const [heartRate, setHeartRate] = useState(78);
  const [avgHeartRate, setAvgHeartRate] = useState(0);
  const [peakHeartRate, setPeakHeartRate] = useState(0);
  const [samplesCount, setSamplesCount] = useState(0);
  const [currentExerciseData, setCurrentExerciseData] = useState<any>(null);
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutTemplate>({
    name: "Upper Body Strength",
    duration: "45 min",
    difficulty: "Intermediate",
    calories: "320",
    exercises: [
      {
        name: "Push-ups",
        sets: 3,
        reps: "12-15",
        rest: "60s",
        type: "strength",
        muscleGroup: "chest",
      },
      {
        name: "Dumbbell Rows",
        sets: 3,
        reps: "10-12 each",
        rest: "60s",
        type: "strength",
        muscleGroup: "back",
      },
      {
        name: "Shoulder Press",
        sets: 3,
        reps: "8-10",
        rest: "90s",
        type: "strength",
        muscleGroup: "shoulders",
      },
      {
        name: "Bicep Curls",
        sets: 3,
        reps: "12-15",
        rest: "60s",
        type: "strength",
        muscleGroup: "biceps",
      },
    ],
  });

  const handlePlayPause = () => setIsPlaying((prev) => !prev);
  const handleNext = () => {
    if (currentExercise < workoutPlan.exercises.length - 1) {
      setCurrentExercise((prev) => prev + 1);
    }
  };
  const handlePrevious = () => {
    if (currentExercise > 0) {
      setCurrentExercise((prev) => prev - 1);
    }
  };

  useEffect(() => {
    const template = searchParams.get("template");
    if (!template) return;
    const decoded = decodeURIComponent(template);
    const found = getWorkoutTemplate(decoded);
    if (found) {
      const session = new WorkoutSession(found);
      setWorkoutSession(session);
      setWorkoutPlan(found);
      setDifficulty(found.difficulty ?? "Intermediate");
      setCurrentExercise(0);
    }
  }, [searchParams]);

  const handleReset = () => {
    setCurrentExercise(0);
    setIsPlaying(false);
    setTimeRemaining(45);
  };

  const computeSets = (baseSets: number) => {
    const adjusted = baseSets + setAdjustment;
    return Math.max(1, adjusted);
  };

  const computeReps = (repsString: string) => {
    if (!repsString) return "";
    const rangeMatch = repsString.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = repsString.match(/^(\d+)$/);
    if (rangeMatch) {
      const min = Math.max(
        1,
        Math.round(parseInt(rangeMatch[1], 10) * repMultiplier),
      );
      const max = Math.max(
        min,
        Math.round(parseInt(rangeMatch[2], 10) * repMultiplier),
      );
      return `${min}-${max}`;
    }
    if (singleMatch) {
      const val = Math.max(
        1,
        Math.round(parseInt(singleMatch[1], 10) * repMultiplier),
      );
      return `${val}`;
    }
    return repsString;
  };

  const applyPresetDifficulty = (level: string) => {
    setDifficulty(level);
    if (level === "Beginner") {
      setRepMultiplier(0.8);
      setSetAdjustment(-1);
      setRestSeconds(75);
    } else if (level === "Intermediate") {
      setRepMultiplier(1);
      setSetAdjustment(0);
      setRestSeconds(60);
    } else {
      setRepMultiplier(1.2);
      setSetAdjustment(1);
      setRestSeconds(45);
    }
  };

  useEffect(() => {
    const currentExerciseName = workoutPlan.exercises[currentExercise].name;
    const loadExerciseData = async () => {
      const data = await getExerciseData(currentExerciseName);
      setCurrentExerciseData(data);
    };
    loadExerciseData();
  }, [currentExercise, workoutPlan]);

  useEffect(() => {
    if (!isHeartTracking) return;
    const interval = setInterval(() => {
      const base = 75 + currentExercise * 8;
      const target = Math.min(185, base + (isPlaying ? 30 : 0));
      const noise = Math.random() * 6 - 3;
      const next = Math.max(
        55,
        Math.min(195, Math.round(heartRate + (target - heartRate) * 0.15 + noise)),
      );
      setHeartRate(next);
      setSamplesCount((c) => c + 1);
      setAvgHeartRate((prevAvg) => {
        const total = prevAvg * samplesCount + next;
        return total / (samplesCount + 1);
      });
      setPeakHeartRate((p) => Math.max(p, next));
    }, 1500);
    return () => clearInterval(interval);
  }, [isHeartTracking, currentExercise, isPlaying, heartRate, samplesCount]);

  return (
    <div className="space-y-6 px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="mb-2 text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
            {workoutPlan.name}
          </h1>
          <div className="flex items-center space-x-4 text-day-text-secondary dark:text-night-text-secondary">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{workoutPlan.duration}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Target className="h-4 w-4" />
              <span>{workoutPlan.difficulty}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4" />
              <span>{workoutPlan.calories} cal</span>
            </div>
          </div>
        </div>
        <div />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <div className="mb-4 aspect-video overflow-hidden rounded-lg">
              <ExerciseImage
                exerciseName={workoutPlan.exercises[currentExercise].name}
                className="h-full w-full rounded-lg"
                showFallback={true}
                animate={true}
                animationSpeed={2000}
              />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                {workoutPlan.exercises[currentExercise].name}
              </h3>
              <Badge variant="primary">
                {currentExercise + 1} of {workoutPlan.exercises.length}
              </Badge>
            </div>

            <p className="mt-2 text-day-text-secondary dark:text-night-text-secondary">
              {currentExerciseData?.instructions?.[0] ||
                "Follow the movement cues to complete each set safely."}
            </p>

            {currentExerciseData ? (
              <div className="mt-4 rounded-lg bg-day-hover p-4 dark:bg-night-hover">
                <h4 className="mb-2 font-semibold text-day-text-primary dark:text-night-text-primary">
                  Exercise Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Level:{" "}
                    </span>
                    <span className="capitalize text-day-text-primary dark:text-night-text-primary">
                      {currentExerciseData.level}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Equipment:{" "}
                    </span>
                    <span className="capitalize text-day-text-primary dark:text-night-text-primary">
                      {currentExerciseData.equipment}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Category:{" "}
                    </span>
                    <span className="capitalize text-day-text-primary dark:text-night-text-primary">
                      {currentExerciseData.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-day-text-secondary dark:text-night-text-secondary">
                      Primary Muscles:{" "}
                    </span>
                    <span className="text-day-text-primary dark:text-night-text-primary">
                      {currentExerciseData.primaryMuscles?.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-center space-x-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={handlePrevious}
                disabled={currentExercise === 0}
              >
                <SkipBack className="h-6 w-6" />
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={handlePlayPause}
                className="h-16 w-16 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={handleNext}
                disabled={currentExercise === workoutPlan.exercises.length - 1}
              >
                <SkipForward className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex items-center justify-center space-x-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {restSeconds}s
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Rest Time
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {computeSets(workoutPlan.exercises[currentExercise].sets)}
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Sets
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {computeReps(workoutPlan.exercises[currentExercise].reps)}
                </div>
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Reps
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                Workout Progress
              </h3>
              <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {Math.round(
                  ((currentExercise + 1) / workoutPlan.exercises.length) * 100,
                )}
                %
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-day-border dark:bg-night-border">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 transition-all duration-300"
                style={{
                  width: `${
                    ((currentExercise + 1) / workoutPlan.exercises.length) * 100
                  }%`,
                }}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Workout Stats
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Exercises Completed
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {currentExercise}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Total Sets
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {workoutPlan.exercises
                    .slice(0, currentExercise + 1)
                    .reduce((acc, ex) => acc + ex.sets, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Time Elapsed
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  12:34
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Calories Burned
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  156
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Exercise List
            </h3>
            <div className="space-y-3">
              {workoutPlan.exercises.map((exercise, index) => (
                <div
                  key={exercise.name}
                  className={`cursor-pointer rounded-lg p-3 transition-colors ${
                    index === currentExercise
                      ? "bg-day-accent-primary/10 dark:bg-night-accent/10 border border-day-accent-primary dark:border-night-accent"
                      : index < currentExercise
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        : "bg-day-hover dark:bg-night-hover hover:bg-day-border dark:hover:bg-night-border"
                  }`}
                  onClick={() => setCurrentExercise(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center space-x-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-day-border dark:bg-night-border">
                        <ExerciseImage
                          exerciseName={exercise.name}
                          className="h-full w-full"
                          showFallback={true}
                          isStatic={true}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-day-text-primary dark:text-night-text-primary">
                          {exercise.name}
                        </h4>
                        <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          {computeSets(exercise.sets)} sets x {computeReps(exercise.reps)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {index < currentExercise ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : null}
                      {index === currentExercise ? (
                        <div className="h-4 w-4 animate-pulse rounded-full bg-day-accent-primary dark:bg-night-accent" />
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button variant="ghost" fullWidth onClick={() => setShowDifficulty(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Adjust Difficulty
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setShowHeartRate(true)}>
                <Heart className="mr-2 h-4 w-4" />
                Track Heart Rate
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onClick={() => window.location.assign("/dashboard/workouts")}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Workout History
              </Button>

              <Button variant="ghost" fullWidth onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restart Workout
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {showDifficulty ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDifficulty(false)}
          />
          <Card className="relative z-10 w-full max-w-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Adjust Difficulty
              </h3>
              <button
                className="text-day-text-secondary dark:text-night-text-secondary"
                onClick={() => setShowDifficulty(false)}
              >
                Close
              </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => applyPresetDifficulty(lvl)}
                  className={`rounded-lg border p-3 transition-colors ${
                    difficulty === lvl
                      ? "border-day-accent-primary dark:border-night-accent text-day-text-primary dark:text-night-text-primary bg-day-accent-primary/10 dark:bg-night-accent/10"
                      : "border-day-border dark:border-night-border text-day-text-secondary dark:text-night-text-secondary hover:bg-day-hover dark:hover:bg-night-hover"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                    <Target className="mr-2 h-4 w-4" /> Rep Intensity (
                    {repMultiplier.toFixed(1)}x)
                  </label>
                  <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Adjust reps
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={repMultiplier}
                  onChange={(e) => setRepMultiplier(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                    Set Adjustment (
                    {setAdjustment >= 0 ? `+${setAdjustment}` : setAdjustment})
                  </label>
                  <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    -2 to +2
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="1"
                  value={setAdjustment}
                  onChange={(e) => setSetAdjustment(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                    <Timer className="mr-2 h-4 w-4" /> Rest Time ({restSeconds}s)
                  </label>
                  <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    30s to 120s
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={restSeconds}
                  onChange={(e) => setRestSeconds(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <Button variant="ghost" onClick={() => setShowDifficulty(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setShowDifficulty(false)}>
                Apply
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {showHeartRate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowHeartRate(false)}
          />
          <Card className="relative z-10 w-full max-w-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Heart Rate
              </h3>
              <button
                className="text-day-text-secondary dark:text-night-text-secondary"
                onClick={() => setShowHeartRate(false)}
              >
                Close
              </button>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-day-border p-4 text-center dark:border-night-border">
                <div className="mb-1 flex items-center justify-center text-day-text-secondary dark:text-night-text-secondary">
                  <Heart className="mr-1 h-4 w-4" /> Current
                </div>
                <div className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {heartRate}
                  <span className="ml-1 text-base font-medium">bpm</span>
                </div>
              </div>
              <div className="rounded-lg border border-day-border p-4 text-center dark:border-night-border">
                <div className="mb-1 text-day-text-secondary dark:text-night-text-secondary">
                  Average
                </div>
                <div className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {Math.round(avgHeartRate) || 0}
                  <span className="ml-1 text-base font-medium">bpm</span>
                </div>
              </div>
              <div className="rounded-lg border border-day-border p-4 text-center dark:border-night-border">
                <div className="mb-1 text-day-text-secondary dark:text-night-text-secondary">
                  Peak
                </div>
                <div className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {peakHeartRate || heartRate}
                  <span className="ml-1 text-base font-medium">bpm</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    heartRate < 100
                      ? "bg-green-500"
                      : heartRate < 150
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (heartRate - 50) / 1.5))}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-day-text-secondary dark:text-night-text-secondary">
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Samples: {samplesCount}
              </div>
              <div className="space-x-2">
                <Button
                  variant={isHeartTracking ? "outline" : "primary"}
                  onClick={() => setIsHeartTracking((v) => !v)}
                >
                  {isHeartTracking ? "Pause" : "Start"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAvgHeartRate(0);
                    setPeakHeartRate(0);
                    setSamplesCount(0);
                  }}
                >
                  Reset Stats
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
