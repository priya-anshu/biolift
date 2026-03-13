"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  Crown,
  Flame,
  Medal,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

type LeaderboardRow = {
  id: string;
  user_id: string;
  total_score: number | null;
  strength_score: number | null;
  stamina_score: number | null;
  consistency_score: number | null;
  improvement_score: number | null;
  tier: string | null;
  position: number | null;
  updated_at: string | null;
  profiles?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

type RawLeaderboardRow = Omit<LeaderboardRow, "profiles"> & {
  profiles?:
    | {
        name: string | null;
        avatar_url: string | null;
      }[]
    | {
        name: string | null;
        avatar_url: string | null;
      }
    | null;
};

const sortOptions = [
  { key: "total_score", label: "Overall", icon: Trophy },
  { key: "strength_score", label: "Strength", icon: Zap },
  { key: "stamina_score", label: "Stamina", icon: Flame },
  { key: "consistency_score", label: "Consistency", icon: Target },
  { key: "improvement_score", label: "Improvement", icon: TrendingUp },
] as const;

const tierStyles: Record<string, { tone: string; text: string; icon: typeof Trophy }> = {
  Diamond: {
    tone: "bg-sky-100 dark:bg-sky-900/30",
    text: "text-sky-600 dark:text-sky-300",
    icon: Crown,
  },
  Platinum: {
    tone: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-300",
    icon: Trophy,
  },
  Gold: {
    tone: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Medal,
  },
  Silver: {
    tone: "bg-slate-100 dark:bg-slate-800/30",
    text: "text-slate-500 dark:text-slate-300",
    icon: Trophy,
  },
  Bronze: {
    tone: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-600 dark:text-orange-300",
    icon: Trophy,
  },
};

function getTierMeta(tier?: string | null) {
  return tierStyles[tier ?? "Bronze"] ?? tierStyles.Bronze;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return Number(value).toFixed(0);
}


export default function RankingPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeMetric, setActiveMetric] =
    useState<(typeof sortOptions)[number]["key"]>("total_score");
  const [error, setError] = useState<string | null>(null);
  const [activityDays, setActivityDays] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      if (!user) {
        setProfileId(null);
        setLeaderboard([]);
        setActivityDays(0);
        setStreakDays(0);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/ranking/overview", { cache: "no-store" });
        const payload = (await response.json()) as {
          leaderboard?: RawLeaderboardRow[];
          myEntry?: LeaderboardRow | null;
          profileId?: string;
          activityDays?: number;
          streakDays?: number;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load ranking data");
        }

        const normalized: LeaderboardRow[] = (payload.leaderboard ?? []).map((row) => ({
          ...row,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        }));
        setLeaderboard(normalized);
        setProfileId(
          typeof payload.profileId === "string"
            ? payload.profileId
            : payload.myEntry?.user_id ?? null,
        );
        setActivityDays(Number(payload.activityDays ?? 0));
        setStreakDays(Number(payload.streakDays ?? 0));
      } catch (loadError) {
        setLeaderboard([]);
        setProfileId(null);
        setActivityDays(0);
        setStreakDays(0);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load ranking overview",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...leaderboard].sort((a, b) => {
      const aValue = Number(a[activeMetric] ?? 0);
      const bValue = Number(b[activeMetric] ?? 0);
      return bValue - aValue;
    });

    if (!term) return sorted;

    return sorted.filter((entry) => {
      const name = entry.profiles?.name ?? "";
      return name.toLowerCase().includes(term);
    });
  }, [leaderboard, search, activeMetric]);

  const myEntry = useMemo(() => {
    if (!profileId) return null;
    return leaderboard.find((entry) => entry.user_id === profileId) ?? null;
  }, [leaderboard, profileId]);

  const topThree = filtered.slice(0, 3);
  const fairPlayReady = activityDays >= 14;

  return (
    <div className="space-y-8 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold">Smart Ranking</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Daily ranking updates driven by completed training data.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search athletes"
            className="w-full rounded-xl border border-day-border bg-day-card py-2 pl-10 pr-4 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
          />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap gap-2"
      >
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const isActive = activeMetric === option.key;
          return (
            <button
              key={option.key}
              onClick={() => setActiveMetric(option.key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-transparent bg-day-accent-primary text-white shadow-sm dark:bg-night-accent"
                  : "border-day-border bg-day-card text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:bg-night-card dark:text-night-text-secondary dark:hover:bg-night-hover"
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </motion.section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-2xl border border-day-border bg-day-card p-4 text-sm shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Fair-Play Window
            </div>
            <div className="text-day-text-secondary dark:text-night-text-secondary">
              Rankings refresh daily from workout execution, PRs, and progress tracking.
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              fairPlayReady
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            {activityDays}/14 active days
          </span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
          <div
            className="h-2 rounded-full bg-linear-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600"
            style={{ width: `${Math.min((activityDays / 14) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-3 text-xs text-day-text-secondary dark:text-night-text-secondary">
          Current streak: <span className="font-semibold">{streakDays} days</span>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-3"
      >
        {topThree.map((entry, index) => {
          const tierMeta = getTierMeta(entry.tier);
          const TierIcon = tierMeta.icon;
          const displayName = entry.profiles?.name ?? "Athlete";
          const highlight =
            index === 0
              ? "from-amber-400/20 to-amber-500/10"
              : index === 1
                ? "from-slate-200/40 to-slate-100/10"
                : "from-orange-400/20 to-orange-500/10";
          return (
            <div
              key={entry.id}
              className={`rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark ${
                index === 0
                  ? "ring-1 ring-amber-400/60"
                  : index === 1
                    ? "ring-1 ring-slate-300/60"
                    : "ring-1 ring-orange-400/40"
              }`}
            >
              <div
                className={`mb-4 flex items-center justify-between rounded-xl bg-linear-to-r ${highlight} px-3 py-2`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Crown className="h-4 w-4 text-amber-500" />
                  #{index + 1} Spot
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tierMeta.tone} ${tierMeta.text}`}
                >
                  <TierIcon className="h-3 w-3" />
                  {entry.tier ?? "Bronze"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-day-hover text-sm font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                  {entry.profiles?.avatar_url ? (
                    <Image
                      src={entry.profiles.avatar_url}
                      alt={displayName}
                      width={48}
                      height={48}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    displayName[0]
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    Total score {formatScore(entry.total_score)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {topThree.length === 0 && !loading ? (
          <div className="col-span-full rounded-2xl border border-day-border bg-day-card p-6 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-card dark:text-night-text-secondary">
            No rankings yet. Complete workout sessions and log progress entries to populate the leaderboard.
          </div>
        ) : null}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
      >
        <div className="rounded-2xl border border-day-border bg-day-card shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center justify-between border-b border-day-border px-5 py-4 dark:border-night-border">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Leaderboard
            </div>
            <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              {filtered.length} athletes
            </div>
          </div>
          <div className="divide-y divide-day-border dark:divide-night-border">
            {loading ? (
              <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
                Loading leaderboard...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
                No athletes found.
              </div>
            ) : (
              filtered.map((entry, index) => {
                const tierMeta = getTierMeta(entry.tier);
                const TierIcon = tierMeta.icon;
                const displayName = entry.profiles?.name ?? "Athlete";
                const isMe = !!profileId && entry.user_id === profileId;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 px-5 py-4 transition ${
                      isMe
                        ? "bg-day-hover dark:bg-night-hover"
                        : "hover:bg-day-hover dark:hover:bg-night-hover"
                    }`}
                  >
                    <div className="w-10 text-sm font-semibold text-day-text-secondary dark:text-night-text-secondary">
                      #{index + 1}
                    </div>
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-day-hover text-sm font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                        {entry.profiles?.avatar_url ? (
                          <Image
                            src={entry.profiles.avatar_url}
                            alt={displayName}
                            width={40}
                            height={40}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          displayName[0]
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {displayName}
                          {isMe ? (
                            <span className="ml-2 rounded-full bg-day-accent-primary px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-night-accent">
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                          Ranked athlete
                        </div>
                      </div>
                    </div>
                    <div className="hidden text-right text-xs text-day-text-secondary dark:text-night-text-secondary md:block">
                      <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
                        {formatScore(entry[activeMetric])}
                      </div>
                      {sortOptions.find((opt) => opt.key === activeMetric)?.label ?? "Score"}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${tierMeta.tone} ${tierMeta.text}`}
                    >
                      <TierIcon className="h-3 w-3" />
                      {entry.tier ?? "Bronze"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              My Ranking
            </div>
            {myEntry ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Overall Score</span>
                  <span className="font-semibold">{formatScore(myEntry.total_score)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Strength</span>
                  <span className="font-semibold">{formatScore(myEntry.strength_score)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Stamina</span>
                  <span className="font-semibold">{formatScore(myEntry.stamina_score)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Consistency</span>
                  <span className="font-semibold">{formatScore(myEntry.consistency_score)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Improvement</span>
                  <span className="font-semibold">{formatScore(myEntry.improvement_score)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Active Days (14d)</span>
                  <span className="font-semibold">{activityDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">Current Streak</span>
                  <span className="font-semibold">{streakDays} days</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                No ranking yet. Complete workouts to appear here.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              Ranking Insights
            </div>
            <ul className="mt-4 space-y-3 text-sm text-day-text-secondary dark:text-night-text-secondary">
              <li>Global rank updates daily using the latest logged data.</li>
              <li>Consistency score uses activity days + streak quality.</li>
              <li>Leaderboard recalculates after completed workouts and manual logs.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="text-sm font-semibold">Score Source</div>
            <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
              Scores are derived from completed workout sessions, set-level volume,
              personal records, and tracked progress entries.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
