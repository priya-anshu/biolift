"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Clock,
  Flame,
  Play,
  Plus,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AICoachCard from "@/components/ai/AICoachCard";
import { useAuth } from "@/lib/auth/AuthContext";
import type { CoachInsight } from "@/lib/workout-planner/insightEngine";

type DashboardSummaryResponse = {
  coachInsight?: CoachInsight | null;
  requiresPlan?: boolean;
  metrics: {
    workoutsThisPeriod: number;
    caloriesBurned: number;
    activeMinutes: number;
  };
  trainingStats?: {
    workouts_completed_7d?: number | null;
    consistency_score?: number | null;
    streak_days?: number | null;
  } | null;
  recentActivity: Array<{
    id: string;
    name: string;
    type: string | null;
    duration_minutes: number | null;
    calories: number | null;
    performed_at: string;
    status?: string;
  }>;
  recoveryStatus?: {
    readiness_score?: number | null;
  } | null;
  progressSummary?: {
    weeklyWorkouts: number;
    streakDays: number;
    consistencyScore: number;
  } | null;
  leaderboardSummary?: {
    rank: number | null;
    tier: string | null;
  } | null;
  goals?: Array<{
    id: string;
    title: string;
    current_value: number | null;
    target_value: number | null;
    unit: string | null;
  }>;
  error?: string;
};

type StatCard = {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
  icon: typeof Flame;
  color: string;
  tone: string;
};

type GoalCard = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  progress: number;
};

type AchievementCard = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlight: string;
  footer: string;
  icon: typeof Award;
  panelClass: string;
  iconClass: string;
};

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return new Date(value).toLocaleDateString();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/summary?days=7&recentLimit=5", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardSummaryResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load dashboard");
      }
      setSummary(payload);
    } catch (loadError) {
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const displayName = useMemo(() => {
    const metadata = user?.user_metadata as
      | { full_name?: string; name?: string; user_name?: string }
      | undefined;

    return (
      metadata?.full_name ||
      metadata?.name ||
      metadata?.user_name ||
      user?.email?.split("@")[0] ||
      "Athlete"
    );
  }, [user]);

  const requiresPlan = Boolean(summary?.requiresPlan);
  const weeklyWorkouts =
    summary?.progressSummary?.weeklyWorkouts ??
    Number(summary?.trainingStats?.workouts_completed_7d ?? summary?.metrics.workoutsThisPeriod ?? 0);
  const streakDays =
    summary?.progressSummary?.streakDays ??
    Number(summary?.trainingStats?.streak_days ?? 0);
  const consistencyScore =
    summary?.progressSummary?.consistencyScore ??
    Number(summary?.trainingStats?.consistency_score ?? 0);
  const leaderboardRank = summary?.leaderboardSummary?.rank ?? null;
  const leaderboardTier = summary?.leaderboardSummary?.tier ?? "Unranked";

  const stats = useMemo<StatCard[]>(
    () => [
      {
        title: "Workouts This Week",
        value: String(summary?.metrics.workoutsThisPeriod ?? 0),
        change: `${weeklyWorkouts}/7`,
        changeType: "positive",
        icon: Flame,
        color: "text-orange-500",
        tone: "bg-orange-500/10",
      },
      {
        title: "Calories Burned",
        value: Math.round(summary?.metrics.caloriesBurned ?? 0).toLocaleString(),
        change: "Last 7 days",
        changeType: "positive",
        icon: Zap,
        color: "text-yellow-500",
        tone: "bg-yellow-500/10",
      },
      {
        title: "Active Minutes",
        value: String(Math.round(summary?.metrics.activeMinutes ?? 0)),
        change: `Streak ${streakDays}`,
        changeType: streakDays > 0 ? "positive" : "negative",
        icon: Clock,
        color: "text-blue-500",
        tone: "bg-blue-500/10",
      },
      {
        title: "Leaderboard",
        value: leaderboardRank ? `#${leaderboardRank}` : "-",
        change: leaderboardTier,
        changeType: leaderboardRank ? "positive" : "negative",
        icon: TrendingUp,
        color: "text-purple-500",
        tone: "bg-purple-500/10",
      },
    ],
    [leaderboardRank, leaderboardTier, streakDays, summary?.metrics.activeMinutes, summary?.metrics.caloriesBurned, summary?.metrics.workoutsThisPeriod, weeklyWorkouts],
  );

  const goals = useMemo<GoalCard[]>(
    () => [
      {
        id: "weekly-workouts",
        title: "Weekly Workouts",
        current: weeklyWorkouts,
        target: 7,
        unit: "workouts",
        progress: Math.min(Math.round((weeklyWorkouts / 7) * 100), 100),
      },
      {
        id: "current-streak",
        title: "Current Streak",
        current: streakDays,
        target: 14,
        unit: "days",
        progress: Math.min(Math.round((streakDays / 14) * 100), 100),
      },
      {
        id: "consistency-score",
        title: "Consistency Score",
        current: Math.round(consistencyScore),
        target: 100,
        unit: "score",
        progress: Math.min(Math.round(consistencyScore), 100),
      },
    ],
    [consistencyScore, streakDays, weeklyWorkouts],
  );

  const recentWorkouts = summary?.recentActivity ?? [];
  const achievements = useMemo<AchievementCard[]>(() => {
    const completedGoalRows = (summary?.goals ?? []).filter((goal) => {
      const current = Number(goal.current_value);
      const target = Number(goal.target_value);
      return Number.isFinite(current) && Number.isFinite(target) && target > 0 && current >= target;
    });
    const completedGoals = completedGoalRows.length;
    const completedGoalTitles = completedGoalRows
      .map((goal) => String(goal.title ?? "").trim())
      .filter(Boolean);
    const caloriesBurned = Math.round(summary?.metrics.caloriesBurned ?? 0);
    const unlocked: AchievementCard[] = [];

    if (streakDays >= 7) {
      unlocked.push({
        id: "streak-master",
        eyebrow: "Momentum",
        title: "Streak Master",
        description: `You're riding a ${streakDays}-day training streak with real consistency.`,
        highlight: `${streakDays} days`,
        footer: "Built from your last 7 days of activity",
        icon: Flame,
        panelClass:
          "border-yellow-200/70 bg-yellow-50/80 dark:border-yellow-900/50 dark:bg-yellow-950/20",
        iconClass: "bg-gradient-to-br from-yellow-500 to-amber-500",
      });
    }

    if (completedGoals > 0) {
      unlocked.push({
        id: "goal-crusher",
        eyebrow: "Goals",
        title: "Goal Crusher",
        description:
          completedGoalTitles.length === 1
            ? `You fully closed out "${completedGoalTitles[0]}".`
            : `You closed out ${completedGoals} active goals and kept your plan moving.`,
        highlight: `${completedGoals} complete`,
        footer:
          completedGoalTitles.length > 0
            ? `Latest win: ${completedGoalTitles[0]}`
            : "Tracked from your active goals",
        icon: Target,
        panelClass:
          "border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20",
        iconClass: "bg-gradient-to-br from-blue-500 to-sky-500",
      });
    }

    if (caloriesBurned >= 2000) {
      unlocked.push({
        id: "energy-boost",
        eyebrow: "Output",
        title: "Energy Boost",
        description: `Your logged sessions burned ${caloriesBurned.toLocaleString()} calories over the last 7 days.`,
        highlight: `${caloriesBurned.toLocaleString()} cal`,
        footer: "Calculated from completed workout sessions",
        icon: Zap,
        panelClass:
          "border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20",
        iconClass: "bg-gradient-to-br from-emerald-500 to-green-500",
      });
    }

    if (weeklyWorkouts >= 4) {
      unlocked.push({
        id: "session-builder",
        eyebrow: "Volume",
        title: "Session Builder",
        description: `You logged ${weeklyWorkouts} workouts this week and kept your routine alive.`,
        highlight: `${weeklyWorkouts} sessions`,
        footer: "Based on the last 7 days of workouts",
        icon: Play,
        panelClass:
          "border-rose-200/70 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20",
        iconClass: "bg-gradient-to-br from-rose-500 to-red-500",
      });
    }

    if (consistencyScore >= 70) {
      unlocked.push({
        id: "consistency-lock",
        eyebrow: "Rhythm",
        title: "Consistency Lock",
        description: `Your training rhythm is holding at ${Math.round(consistencyScore)}/100 right now.`,
        highlight: `${Math.round(consistencyScore)}/100`,
        footer: "Measured from your recent workout cadence",
        icon: TrendingUp,
        panelClass:
          "border-indigo-200/70 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-950/20",
        iconClass: "bg-gradient-to-br from-indigo-500 to-violet-500",
      });
    }

    if (leaderboardRank !== null && leaderboardRank <= 10) {
      unlocked.push({
        id: "top-ranked",
        eyebrow: "Competition",
        title: "Top Ranked",
        description: `You're sitting at #${leaderboardRank} and holding strong on the leaderboard.`,
        highlight: `#${leaderboardRank}`,
        footer: `Current tier: ${leaderboardTier}`,
        icon: Award,
        panelClass:
          "border-purple-200/70 bg-purple-50/80 dark:border-purple-900/50 dark:bg-purple-950/20",
        iconClass: "bg-gradient-to-br from-purple-500 to-fuchsia-500",
      });
    }

    return unlocked.slice(0, 3);
  }, [consistencyScore, leaderboardRank, leaderboardTier, streakDays, summary?.goals, summary?.metrics.caloriesBurned, weeklyWorkouts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="card p-6">
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="skeleton h-8 w-16 mb-2" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary mb-2">
          Welcome back, {displayName}! 👋
        </h1>
        <p className="text-day-text-secondary dark:text-night-text-secondary">
          Ready to crush your fitness goals today?
        </p>
      </motion.div>

      {error ? (
        <Card className="p-5">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
          >
            Retry
          </button>
        </Card>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.tone}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <Badge
                  variant={stat.changeType === "positive" ? "success" : "danger"}
                  size="sm"
                >
                  {stat.change}
                </Badge>
              </div>
              <h3 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary mb-1">
                {stat.value}
              </h3>
              <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {stat.title}
              </p>
            </Card>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
      >
        <AICoachCard
          insight={summary?.coachInsight ?? null}
          requiresPlan={requiresPlan}
          trainingStats={summary?.trainingStats ?? null}
          className="p-5 sm:p-6"
        />
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                Insights
              </p>
              <h2 className="mt-1 text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Today&apos;s Signals
              </h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-day-text-secondary dark:text-night-text-secondary">
            Open insights to review today&apos;s workout guidance, recovery signals, and ranking snapshot.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-day-border px-4 py-3 dark:border-night-border">
              <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
                Background updates
              </div>
              <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                Recommendations, recovery refresh, and leaderboard updates happen automatically after you train.
              </p>
            </div>
            <Link
              href="/dashboard/insights"
              className="inline-flex items-center justify-center rounded-lg bg-day-accent-secondary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Open Insights
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <Card className="p-6 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:to-night-border dark:from-red-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-white/20">
              <Play className="w-5 h-5" />
            </div>
            <Badge
              variant="outline"
              size="sm"
              className="border-white dark:border-white text-white dark:text-night-text-primary"
            >
              Quick Start
            </Badge>
          </div>
          <h3 className="text-xl font-bold mb-2">Start Workout</h3>
          <p className="text-white/80 mb-4">
            Begin your next training session with AI-powered guidance
          </p>
          <Link
            href={requiresPlan ? "/dashboard/workout-planner" : "/dashboard/workout-session"}
            className="inline-flex items-center justify-center rounded-lg border border-white px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-day-accent-primary"
          >
            Start Now
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-day-accent-secondary/10">
              <Plus className="w-5 h-5 text-day-accent-secondary" />
            </div>
            <Badge variant="secondary" size="sm">
              New
            </Badge>
          </div>
          <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary mb-2">
            Create Plan
          </h3>
          <p className="text-day-text-secondary dark:text-night-text-secondary mb-4">
            Generate a personalized workout plan based on your goals
          </p>
          <Link
            href="/dashboard/workout-planner"
            className="inline-flex items-center justify-center rounded-lg bg-day-accent-secondary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create Plan
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-day-accent-primary/10">
              <TrendingUp className="w-5 h-5 text-day-accent-primary" />
            </div>
            <Badge variant="primary" size="sm">
              Trending
            </Badge>
          </div>
          <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary mb-2">
            View Progress
          </h3>
          <p className="text-day-text-secondary dark:text-night-text-secondary mb-4">
            Track your fitness journey with detailed analytics
          </p>
          <Link
            href="/dashboard/progress"
            className="inline-flex items-center justify-center rounded-lg bg-day-accent-primary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:bg-night-accent"
          >
            View Progress
          </Link>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Your Goals
              </h2>
              <Link
                href="/dashboard/progress"
                className="inline-flex items-center text-sm font-semibold text-day-text-primary dark:text-night-text-primary hover:text-day-accent-primary dark:hover:text-night-accent"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
                      {goal.title}
                    </span>
                    <span className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>
                  </div>
                  <div className="w-full bg-day-border dark:bg-night-border rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Recent Workouts
              </h2>
              <Link
                href="/dashboard/workouts"
                className="inline-flex items-center text-sm font-semibold text-day-text-primary dark:text-night-text-primary hover:text-day-accent-primary dark:hover:text-night-accent"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentWorkouts.length === 0 ? (
                <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  No workouts yet. Start your first session to populate your dashboard.
                </div>
              ) : (
                recentWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 rounded-lg flex items-center justify-center">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-day-text-primary dark:text-night-text-primary">
                          {workout.name}
                        </h3>
                        <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                          {Math.round(workout.duration_minutes ?? 0)} min • {Math.round(workout.calories ?? 0)} cal
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="ghost" size="sm">
                        {workout.type ?? workout.status ?? "Workout"}
                      </Badge>
                      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary mt-1">
                        {formatRelativeTime(workout.performed_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card padding="p-0">
          <div className="p-6 pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <div>
                  <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                    Recent Achievements
                  </h2>
                  <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Live milestones from your real training data.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-day-border bg-day-hover/30 px-5 py-10 text-center sm:col-span-2 lg:col-span-3 dark:border-night-border dark:bg-night-hover/30">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-day-accent-primary/10 dark:bg-night-accent/10">
                    <Award className="h-6 w-6 text-day-accent-primary dark:text-night-accent" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-day-text-primary dark:text-night-text-primary">
                    Your first milestones are loading
                  </div>
                  <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
                    Keep logging workouts, building streaks, and closing goals. BioLift will surface your next unlock here.
                  </p>
                </div>
              ) : (
                achievements.map((achievement) => {
                  const Icon = achievement.icon;
                  return (
                    <div
                      key={achievement.id}
                      className={`flex min-h-[208px] flex-col rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5 ${achievement.panelClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${achievement.iconClass}`}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-day-text-secondary dark:bg-white/10 dark:text-night-text-secondary">
                          Unlocked
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-day-text-secondary dark:text-night-text-secondary">
                          {achievement.eyebrow}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                          {achievement.title}
                        </h3>
                        <p className="mt-2 text-sm leading-5 text-day-text-secondary dark:text-night-text-primary/80">
                          {achievement.description}
                        </p>
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <div>
                          <div className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                            {achievement.highlight}
                          </div>
                          <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                            {achievement.footer}
                          </div>
                        </div>
                        <div className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-day-text-primary dark:bg-white/10 dark:text-night-text-primary">
                          Live
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
