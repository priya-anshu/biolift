import type { CalendarStatusRequest, CalendarDayStatus, WorkoutLogRequest } from "@/lib/workout-planner/types";
import type { ServiceContext } from "./types";
import { toDayIndex, clampIntValue, parseNumeric } from "./utils";

function convertCalendarToWorkoutStatus(
  status: CalendarDayStatus,
): WorkoutLogRequest["status"] {
  if (status === "completed") return "completed";
  if (status === "missed") return "missed";
  if (status === "rest_day") return "rest_day";
  return "planned";
}

export async function upsertWorkoutLog(
  context: ServiceContext,
  input: WorkoutLogRequest,
) {
  const nowIso = new Date().toISOString();
  const shouldSetStartedAt =
    input.status === "in_progress" || input.status === "completed";
  const shouldSetCompletedAt =
    input.status === "completed" ||
    input.status === "missed" ||
    input.status === "rest_day";

  const payload = {
    user_id: context.profileId,
    workout_date: input.date,
    plan_id: input.planId ?? null,
    status: input.status,
    completion_percentage: input.completionPercentage ?? 0,
    total_exercises: input.totalExercises ?? 0,
    exercises_completed: input.exercisesCompleted ?? 0,
    total_duration_minutes: input.totalDurationMinutes ?? 0,
    calories_burned: input.caloriesBurned ?? 0,
    notes: input.notes ?? null,
    source: input.source ?? "planner",
    updated_at: nowIso,
  };

  const existing = await context.client
    .from("workout_logs")
    .select("id,started_at,completed_at")
    .eq("user_id", context.profileId)
    .eq("workout_date", input.date)
    .eq("source", payload.source)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    const existingStartedAt =
      typeof existing.data.started_at === "string" ? existing.data.started_at : null;
    const existingCompletedAt =
      typeof existing.data.completed_at === "string" ? existing.data.completed_at : null;

    const updateRes = await context.client
      .from("workout_logs")
      .update({
        ...payload,
        started_at: shouldSetStartedAt
          ? existingStartedAt ?? nowIso
          : existingStartedAt,
        completed_at: shouldSetCompletedAt
          ? existingCompletedAt ?? nowIso
          : existingCompletedAt,
      })
      .eq("id", existing.data.id)
      .eq("user_id", context.profileId)
      .select("id,workout_date,status,completion_percentage,plan_id,started_at,completed_at")
      .single();
    if (updateRes.error) {
      throw new Error(updateRes.error.message);
    }
    return updateRes.data;
  }

  const insertRes = await context.client
    .from("workout_logs")
    .insert({
      ...payload,
      started_at: shouldSetStartedAt ? nowIso : null,
      completed_at: shouldSetCompletedAt ? nowIso : null,
    })
    .select("id,workout_date,status,completion_percentage,plan_id,started_at,completed_at")
    .single();
  if (insertRes.error) {
    throw new Error(insertRes.error.message);
  }
  return insertRes.data;
}

async function computeStreak(context: ServiceContext, date: string) {
  const current = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(current.getTime())) return 0;

  const fromDate = new Date(current);
  fromDate.setUTCDate(fromDate.getUTCDate() - 365);

  const rowsRes = await context.client
    .from("calendar_status")
    .select("status_date")
    .eq("user_id", context.profileId)
    .eq("status", "completed")
    .gte("status_date", fromDate.toISOString().slice(0, 10))
    .lte("status_date", date)
    .order("status_date", { ascending: false })
    .limit(366);

  if (rowsRes.error) {
    throw new Error(rowsRes.error.message);
  }

  const completedDates = new Set(
    (rowsRes.data ?? []).map((row) => String(row.status_date)),
  );
  let streak = 0;
  const cursor = new Date(current);
  while (streak < 366) {
    const key = cursor.toISOString().slice(0, 10);
    if (!completedDates.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function upsertCalendarStatus(
  context: ServiceContext,
  input: CalendarStatusRequest,
) {
  let workoutLogId = input.workoutLogId ?? null;
  if (!workoutLogId) {
    const logRes = await upsertWorkoutLog(context, {
      date: input.date,
      status: convertCalendarToWorkoutStatus(input.status),
      completionPercentage: input.status === "completed" ? 100 : 0,
      source: "planner",
      notes: input.notes,
    });
    workoutLogId = logRes.id as string;
  }

  const provisionalStreak = input.status === "completed" ? 1 : 0;
  const upsertRes = await context.client
    .from("calendar_status")
    .upsert(
      {
        user_id: context.profileId,
        status_date: input.date,
        workout_log_id: workoutLogId,
        status: input.status,
        streak_count: provisionalStreak,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,status_date" },
    )
    .select("id,status_date,status,streak_count,workout_log_id")
    .single();
  if (upsertRes.error) {
    throw new Error(upsertRes.error.message);
  }

  if (input.status === "completed") {
    const streak = await computeStreak(context, input.date);
    const streakRes = await context.client
      .from("calendar_status")
      .update({ streak_count: streak })
      .eq("id", upsertRes.data.id)
      .eq("user_id", context.profileId)
      .select("id,status_date,status,streak_count,workout_log_id")
      .single();
    if (streakRes.error) {
      throw new Error(streakRes.error.message);
    }
    return streakRes.data;
  }

  return upsertRes.data;
}

export async function getCalendarMonth(
  context: ServiceContext,
  monthStart: Date,
  monthEnd: Date,
) {
  const fromDate = monthStart.toISOString().slice(0, 10);
  const toDate = new Date(monthEnd.getTime() - 86400000).toISOString().slice(0, 10);
  const result = await context.client
    .from("calendar_status")
    .select("id,status_date,status,streak_count,workout_log_id")
    .eq("user_id", context.profileId)
    .gte("status_date", fromDate)
    .lte("status_date", toDate)
    .order("status_date", { ascending: true });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data ?? [];
}

export async function getMotivationSnapshot(
  context: ServiceContext,
  language: "en" | "hi" | "bi",
) {
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const todayDayIndex = toDayIndex(todayDate);

  const activePlanRes = await context.client
    .from("workout_plans")
    .select("id,name,goal")
    .eq("user_id", context.profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activePlanRes.error) {
    throw new Error(activePlanRes.error.message);
  }

  const activePlan = activePlanRes.data;
  const goalFocus = (activePlan?.goal ?? "general_fitness") as
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "general_fitness";
  const languages =
    language === "bi" ? ["bi", "en", "hi"] : [language, "bi", "en"];

  const [todayExercisesRes, todayLogRes, totalCompletedRes, streak, messageRes] =
    await Promise.all([
      activePlan
        ? context.client
            .from("workout_plan_exercises")
            .select("id,exercise_name,sets,reps_min,reps_max,rest_seconds")
            .eq("plan_id", activePlan.id)
            .eq("day_index", todayDayIndex)
            .order("exercise_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      context.client
        .from("workout_logs")
        .select(
          "id,status,completion_percentage,total_exercises,exercises_completed,total_duration_minutes,calories_burned",
        )
        .eq("user_id", context.profileId)
        .eq("workout_date", todayDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.client
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.profileId)
        .eq("status", "completed"),
      computeStreak(context, todayDate),
      context.client
        .from("motivational_messages")
        .select("id,language,message,priority")
        .eq("is_active", true)
        .in("language", languages)
        .in("goal_focus", [goalFocus, "general_fitness"])
        .order("priority", { ascending: false })
        .limit(20),
    ]);

  if (todayExercisesRes.error) throw new Error(todayExercisesRes.error.message);
  if (todayLogRes.error) throw new Error(todayLogRes.error.message);
  if (totalCompletedRes.error) throw new Error(totalCompletedRes.error.message);
  if (messageRes.error) throw new Error(messageRes.error.message);

  const messages = (messageRes.data ?? []) as Array<{
    id: string;
    language: "en" | "hi" | "bi";
    message: string;
    priority: number;
  }>;
  messages.sort((a, b) => {
    const indexA = languages.indexOf(a.language);
    const indexB = languages.indexOf(b.language);
    if (indexA !== indexB) return indexA - indexB;
    return b.priority - a.priority;
  });
  const message = messages[0]?.message ?? "Stay consistent. Your next rep matters.";

  const completion =
    todayLogRes.data?.completion_percentage ??
    (todayExercisesRes.data?.length
      ? Math.round(
          ((todayLogRes.data?.exercises_completed ?? 0) /
            Math.max(1, todayLogRes.data?.total_exercises ?? todayExercisesRes.data.length)) *
            100,
        )
      : 0);

  return {
    date: todayDate,
    language,
    message,
    todayPlan: activePlan
      ? {
          id: activePlan.id,
          name: activePlan.name,
          exercises: todayExercisesRes.data ?? [],
        }
      : null,
    completionPercentage: Math.max(0, Math.min(100, Math.round(completion))),
    currentStreak: streak,
    totalCompletedWorkouts: totalCompletedRes.count ?? 0,
    todayLog: todayLogRes.data ?? null,
  };
}

export async function logManualWorkoutExecution(
  context: ServiceContext,
  input: {
    name: string;
    type?: string;
    durationMinutes?: number | null;
    caloriesBurned?: number | null;
    exerciseName?: string | null;
    sets?: number | null;
    reps?: number | null;
    weightPerSetKg?: number | null;
    performedAt?: string | null;
    notes?: string | null;
  },
) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Workout name is required");
  }

  const now = input.performedAt ? new Date(input.performedAt) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("performedAt must be a valid datetime");
  }
  const nowIso = now.toISOString();
  const workoutDate = nowIso.slice(0, 10);
  const durationMinutes = Math.max(
    0,
    Math.floor(parseNumeric(input.durationMinutes, 0)),
  );
  const caloriesBurned = Math.max(
    0,
    Math.floor(parseNumeric(input.caloriesBurned, 0)),
  );
  const setCount = clampIntValue(parseNumeric(input.sets, 1), 1, 30);
  const reps = clampIntValue(parseNumeric(input.reps, 10), 1, 120);
  const weightPerSet = Math.max(0, parseNumeric(input.weightPerSetKg, 0));
  const totalReps = setCount * reps;
  const totalVolume = Number((setCount * reps * weightPerSet).toFixed(2));

  const logRes = await context.client
    .from("workout_logs")
    .insert({
      user_id: context.profileId,
      workout_date: workoutDate,
      status: "completed",
      started_at: nowIso,
      completed_at: nowIso,
      completion_percentage: 100,
      total_exercises: 1,
      exercises_completed: 1,
      total_duration_minutes: durationMinutes,
      calories_burned: caloriesBurned,
      notes: input.notes ?? null,
      source: "manual",
      updated_at: nowIso,
    })
    .select(
      "id,plan_id,workout_date,status,completion_percentage,total_exercises,exercises_completed,total_duration_minutes,calories_burned,source",
    )
    .single();
  if (logRes.error || !logRes.data) {
    throw new Error(logRes.error?.message ?? "Failed to insert workout log");
  }

  const exerciseName = (input.exerciseName ?? "").trim() || name;
  const exerciseRes = await context.client
    .from("workout_log_exercises")
    .insert({
      workout_log_id: logRes.data.id,
      user_id: context.profileId,
      exercise_name: exerciseName,
      muscle_group: input.type ? String(input.type).toLowerCase() : "general",
      exercise_order: 1,
      planned_sets: setCount,
      planned_reps_min: reps,
      planned_reps_max: reps,
      planned_rest_seconds: 60,
      completed_sets: setCount,
      total_reps: totalReps,
      total_volume_kg: totalVolume,
      best_set_weight_kg: weightPerSet,
      best_set_reps: reps,
      status: "completed",
      completed: true,
      notes: input.notes ?? null,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (exerciseRes.error || !exerciseRes.data) {
    throw new Error(
      exerciseRes.error?.message ?? "Failed to insert workout exercise row",
    );
  }

  const setRows = Array.from({ length: setCount }).map((_, index) => ({
    workout_log_exercise_id: exerciseRes.data.id,
    workout_log_id: logRes.data.id,
    user_id: context.profileId,
    set_number: index + 1,
    target_reps_min: reps,
    target_reps_max: reps,
    actual_reps: reps,
    actual_weight_kg: weightPerSet,
    actual_rpe: null,
    set_status: "completed",
    performed_at: nowIso,
    updated_at: nowIso,
  }));
  const setInsertRes = await context.client.from("workout_log_sets").insert(setRows);
  if (setInsertRes.error) {
    throw new Error(setInsertRes.error.message);
  }

  return logRes.data;
}