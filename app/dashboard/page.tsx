"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Flame,
  Heart,
  Medal,
  ArrowRight,
  Play,
  Plus,
  Target,
  Timer,
  TrendingUp,
  Zap,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function Shimmer() {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      initial={{ x: "-100%" }}
      animate={{ x: "100%" }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
    >
      <div className="h-full w-1/2 bg-linear-to-r from-transparent via-white/50 to-transparent" />
    </motion.div>
  );
}

type Workout = {
  id: string;
  name: string;
  type: string | null;
  duration_minutes: number | null;
  calories: number | null;
  performed_at: string;
};

type Goal = {
  id: string;
  title: string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
};

type MotivationResponse = {
  date: string;
  language: "en" | "hi" | "bi";
  message: string;
  todayPlan: {
    id: string;
    name: string;
    exercises: Array<{ id: string; exercise_name: string }>;
  } | null;
  completionPercentage: number;
  currentStreak: number;
  totalCompletedWorkouts: number;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [heartRateAvg, setHeartRateAvg] = useState<number | null>(null);
  const [motivation, setMotivation] = useState<MotivationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile?.id) {
        setLoading(false);
        return;
      }
      setProfileId(profile.id);

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [workoutsRes, goalsRes, heartRes] = await Promise.all([
        supabase
          .from("workouts")
          .select("id,name,type,duration_minutes,calories,performed_at")
          .eq("user_id", profile.id)
          .order("performed_at", { ascending: false })
          .limit(6),
        supabase
          .from("goals")
          .select("id,title,current_value,target_value,unit")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("progress_entries")
          .select("value")
          .eq("user_id", profile.id)
          .eq("metric", "heart_rate")
          .gte("recorded_at", since.toISOString()),
      ]);

      setWorkouts((workoutsRes.data as Workout[]) ?? []);
      setGoals((goalsRes.data as Goal[]) ?? []);

      if (heartRes.data && heartRes.data.length > 0) {
        const avg =
          heartRes.data.reduce((sum, entry) => sum + Number(entry.value), 0) /
          heartRes.data.length;
        setHeartRateAvg(Math.round(avg));
      } else {
        setHeartRateAvg(null);
      }

      try {
        const motivationRes = await fetch("/api/dashboard/motivation", {
          cache: "no-store",
        });
        const motivationPayload = (await motivationRes.json()) as MotivationResponse & {
          error?: string;
        };
        if (motivationRes.ok) {
          setMotivation(motivationPayload);
        }
      } catch {}

      setLoading(false);
    };

    load();
  }, [user]);

  const weeklyWorkouts = useMemo(() => {
    if (!workouts.length) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return workouts.filter(
      (workout) => new Date(workout.performed_at) >= cutoff,
    ).length;
  }, [workouts]);

  const caloriesBurned = useMemo(
    () =>
      workouts.reduce(
        (sum, workout) => sum + (workout.calories ?? 0),
        0,
      ),
    [workouts],
  );

  const activeMinutes = useMemo(
    () =>
      workouts.reduce(
        (sum, workout) => sum + (workout.duration_minutes ?? 0),
        0,
      ),
    [workouts],
  );

  const statCards = [
    {
      label: "Workouts This Week",
      value: weeklyWorkouts.toString(),
      delta: loading ? "—" : "+0",
      icon: Flame,
      tint: "text-orange-500",
    },
    {
      label: "Calories Burned",
      value: caloriesBurned.toLocaleString(),
      delta: loading ? "—" : "+0",
      icon: Zap,
      tint: "text-amber-500",
    },
    {
      label: "Active Minutes",
      value: activeMinutes.toString(),
      delta: loading ? "—" : "+0",
      icon: Timer,
      tint: "text-blue-500",
    },
    {
      label: "Heart Rate Avg",
      value: heartRateAvg ? heartRateAvg.toString() : "—",
      delta: loading ? "—" : "+0",
      danger: true,
      icon: Heart,
      tint: "text-rose-500",
    },
  ];

  return (
    <div className="space-y-8 text-day-text-primary dark:text-night-text-primary">
        {motivation ? (
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.45 }}
            className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-day-text-secondary dark:text-night-text-secondary">
                  Daily Motivation
                </p>
                <h2 className="mt-2 text-xl font-semibold">{motivation.message}</h2>
                <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Today: {motivation.todayPlan?.name ?? "No active plan"} •{" "}
                  {motivation.todayPlan?.exercises.length ?? 0} exercises
                </p>
              </div>
              <Link
                href="/dashboard/workout-planner"
                className="inline-flex items-center gap-2 rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                <CalendarDays className="h-4 w-4" />
                Open Planner
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-day-hover px-3 py-2 dark:bg-night-hover">
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Completion
                </div>
                <div className="text-lg font-semibold">{motivation.completionPercentage}%</div>
              </div>
              <div className="rounded-xl bg-day-hover px-3 py-2 dark:bg-night-hover">
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Current Streak
                </div>
                <div className="text-lg font-semibold">{motivation.currentStreak} days</div>
              </div>
              <div className="rounded-xl bg-day-hover px-3 py-2 dark:bg-night-hover">
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Total Completed
                </div>
                <div className="text-lg font-semibold">
                  {motivation.totalCompletedWorkouts}
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-semibold">
            Welcome back{user?.email ? `, ${user.email}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Ready to crush your fitness goals today?
          </p>
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
                  <card.icon className={`h-4 w-4 ${card.tint}`} />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    card.danger
                      ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-200"
                      : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200"
                  }`}
                >
                  {card.delta}
                </span>
              </div>
              <div className="mt-4 text-2xl font-semibold">{card.value}</div>
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {card.label}
              </div>
              {loading ? (
                <div className="absolute inset-0 opacity-20 dark:opacity-0">
                  <Shimmer />
                </div>
              ) : null}
            </div>
          ))}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-4 lg:grid-cols-3"
        >
          <div className="rounded-2xl bg-linear-to-br from-sky-600 via-teal-600 to-emerald-600 p-6 text-white shadow-lg dark:from-red-700 dark:via-red-800 dark:to-red-900">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-white/20 p-2">
                <Play className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold">
                Quick Start
              </span>
            </div>
            <h2 className="mt-6 text-lg font-semibold">Start Workout</h2>
            <p className="mt-2 text-sm text-white/80">
              Begin your next training session with AI-powered guidance
            </p>
            <Link
              href="/dashboard/workout-planner"
              className="mt-6 inline-flex rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold"
            >
              Start Now
            </Link>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-night-accent/20 dark:text-night-accent">
                <Plus className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-night-accent/20 dark:text-night-accent">
                New
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Create Plan</h2>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Generate a personalized workout plan based on your goals
            </p>
            <Link
              href="/dashboard/workout-planner"
              className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
            >
              Create Plan
            </Link>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-sky-100 p-2 text-sky-600 dark:bg-night-accent/20 dark:text-night-accent">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:bg-night-accent/20 dark:text-night-accent">
                Trending
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold">View Progress</h2>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Track your fitness journey with detailed analytics
            </p>
            <Link
              href="/dashboard/progress"
              className="mt-5 inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
            >
              View Progress
            </Link>
          </div>
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Goals</h3>
              <Link
                href="/dashboard/goals"
                className="flex items-center gap-1 rounded-lg border border-day-border px-3 py-1 text-xs font-semibold text-day-text-secondary transition-colors hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {goals.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  No goals yet. Add your first goal to get started.
                </div>
              ) : (
                goals.map((goal) => {
                  const current = goal.current_value ?? 0;
                  const target = goal.target_value ?? 0;
                  const pct =
                    target > 0 ? Math.min((current / target) * 100, 100) : 0;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{goal.title}</span>
                        <span className="text-day-text-secondary dark:text-night-text-secondary">
                          {current}/{target} {goal.unit ?? ""}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Workouts</h3>
              <Link
                href="/dashboard/workouts"
                className="flex items-center gap-1 rounded-lg border border-day-border px-3 py-1 text-xs font-semibold text-day-text-secondary transition-colors hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {workouts.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  No workouts logged yet.
                </div>
              ) : (
                workouts.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-emerald-500 text-white">
                        <Play className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                          {(item.duration_minutes ?? 0) > 0
                            ? `${item.duration_minutes} min`
                            : "0 min"}{" "}
                          -{" "}
                          {(item.calories ?? 0) > 0
                            ? `${item.calories} cal`
                            : "0 cal"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-day-text-secondary dark:text-night-text-secondary">
                      <span className="rounded-full bg-day-hover px-2 py-0.5 text-[11px] font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                        {item.type ?? "Workout"}
                      </span>
                      <div className="mt-1">
                        {new Date(item.performed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
        >
          <h3 className="text-lg font-semibold">Recent Achievements</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Streak Master",
                desc: "7 day workout streak",
                tone: "bg-amber-50 dark:bg-amber-900/20",
                icon: Activity,
              },
              {
                title: "Goal Crusher",
                desc: "Hit 3 monthly goals",
                tone: "bg-sky-50 dark:bg-sky-900/20",
                icon: Target,
              },
              {
                title: "Energy Boost",
                desc: "Burned 2000+ calories",
                tone: "bg-emerald-50 dark:bg-emerald-900/20",
                icon: Medal,
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`rounded-2xl border border-day-border p-5 ${item.tone} dark:border-night-border`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-night-hover dark:text-night-text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
    </div>
  );
}
