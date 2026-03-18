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
import { useAuth } from "@/lib/auth/AuthContext";

type DashboardSummaryResponse = {
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
  const leaderboardRank = summary?.leaderboardSummary?.rank;
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
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Recent Achievements
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-medium text-day-text-primary dark:text-night-text-primary">
                  Streak Master
                </h3>
                <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  7 day workout streak
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-medium text-day-text-primary dark:text-night-text-primary">
                  Goal Crusher
                </h3>
                <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Hit 3 monthly goals
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-medium text-day-text-primary dark:text-night-text-primary">
                  Energy Boost
                </h3>
                <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                  Burned 2000+ calories
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
