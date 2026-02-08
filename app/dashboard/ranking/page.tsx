"use client";

import { motion } from "framer-motion";
import {
  Crown,
  Flame,
  Medal,
  Search,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
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
    email: string | null;
    avatar_url: string | null;
  } | null;
};

const sortOptions = [
  { key: "total_score", label: "Overall", icon: Trophy },
  { key: "strength_score", label: "Strength", icon: Zap },
  { key: "stamina_score", label: "Stamina", icon: Flame },
  { key: "consistency_score", label: "Consistency", icon: Target },
  { key: "improvement_score", label: "Improvement", icon: TrendingUp },
] as const;

const tierStyles: Record<
  string,
  { tone: string; text: string; icon: typeof Trophy }
> = {
  Diamond: { tone: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-600 dark:text-sky-300", icon: Crown },
  Platinum: { tone: "bg-slate-100 dark:bg-slate-800/40", text: "text-slate-600 dark:text-slate-300", icon: Trophy },
  Gold: { tone: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", icon: Medal },
  Silver: { tone: "bg-slate-100 dark:bg-slate-800/30", text: "text-slate-500 dark:text-slate-300", icon: Trophy },
  Bronze: { tone: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-300", icon: Trophy },
};

function getTierMeta(tier?: string | null) {
  return tierStyles[tier ?? "Bronze"] ?? tierStyles.Bronze;
}

function formatScore(value: number | null | undefined) {
  if (!value && value !== 0) return "0";
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
  const [eligibleDays, setEligibleDays] = useState(0);
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: profile }, { data: rows, error: lbError }] =
        await Promise.all([
          user
            ? supabase
                .from("profiles")
                .select("id")
                .eq("auth_user_id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("leaderboard")
            .select(
              "id,user_id,total_score,strength_score,stamina_score,consistency_score,improvement_score,tier,position,updated_at,profiles(name,email,avatar_url)",
            )
            .order("total_score", { ascending: false })
            .limit(100),
        ]);

      if (lbError) {
        setError("Leaderboard is not ready yet. Add scores to see rankings.");
        setLeaderboard([]);
      } else {
        const normalized = ((rows ?? []) as Array<{
          profiles?: { name: string | null; email: string | null; avatar_url: string | null }[] | null;
        }>).map((row) => ({
          ...row,
          profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
        })) as LeaderboardRow[];
        setLeaderboard(normalized);
      }

      setProfileId(profile?.id ?? null);
      setLoading(false);
    };

    load();
  }, [user]);

  useEffect(() => {
    if (!profileId) return;
    const checkEligibility = async () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const { data } = await supabase
        .from("progress_entries")
        .select("recorded_at")
        .eq("user_id", profileId)
        .eq("metric", "body_weight")
        .gte("recorded_at", start.toISOString());

      const daySet = new Set(
        (data ?? []).map((entry) => entry.recorded_at.slice(0, 10)),
      );
      setEligibleDays(daySet.size);
      setIsEligible(daySet.size >= 14);
    };

    checkEligibility();
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const checkEligibility = async () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const { data } = await supabase
        .from("progress_entries")
        .select("recorded_at")
        .eq("user_id", profileId)
        .eq("metric", "body_weight")
        .gte("recorded_at", start.toISOString());

      const daySet = new Set(
        (data ?? []).map((entry) => entry.recorded_at.slice(0, 10)),
      );
      setEligibleDays(daySet.size);
      setIsEligible(daySet.size >= 14);
    };

    checkEligibility();
  }, [profileId]);

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
      const email = entry.profiles?.email ?? "";
      return (
        name.toLowerCase().includes(term) ||
        email.toLowerCase().includes(term)
      );
    });
  }, [leaderboard, search, activeMetric]);

  const myEntry = useMemo(() => {
    if (!profileId) return null;
    return leaderboard.find((entry) => entry.user_id === profileId) ?? null;
  }, [leaderboard, profileId]);

  const topThree = filtered.slice(0, 3);

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
            Live leaderboard powered by your training performance.
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
            <div className="font-semibold">Ranking Eligibility</div>
            <div className="text-day-text-secondary dark:text-night-text-secondary">
              Log daily body weight for 14 days to join the public leaderboard.
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isEligible
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
          >
            {eligibleDays}/14 days
          </span>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
          <div
            className="h-2 rounded-full bg-linear-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600"
            style={{ width: `${Math.min((eligibleDays / 14) * 100, 100)}%` }}
          />
        </div>
      </motion.section>

      {!isEligible ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-day-border bg-day-card p-6 text-sm text-day-text-secondary shadow-card dark:border-night-border dark:bg-night-card dark:text-night-text-secondary dark:shadow-card-dark"
        >
          Keep logging daily weight for 14 days to unlock the leaderboard.
          You can still view your personal stats below.
        </motion.section>
      ) : null}

      {isEligible ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-3"
        >
          {topThree.map((entry, index) => {
            const tierMeta = getTierMeta(entry.tier);
            const TierIcon = tierMeta.icon;
            const displayName =
              entry.profiles?.name ?? entry.profiles?.email ?? "Athlete";
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
                      <img
                        src={entry.profiles.avatar_url}
                        alt={displayName}
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
              No rankings yet. Add workouts and progress entries to populate the leaderboard.
            </div>
          ) : null}
        </motion.section>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
      >
        {isEligible ? (
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
                Loading leaderboard…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
                No athletes found.
              </div>
            ) : (
              filtered.map((entry, index) => {
                const tierMeta = getTierMeta(entry.tier);
                const TierIcon = tierMeta.icon;
                const displayName =
                  entry.profiles?.name ?? entry.profiles?.email ?? "Athlete";
                const isMe = profileId && entry.user_id === profileId;
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
                          <img
                            src={entry.profiles.avatar_url}
                            alt={displayName}
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
                          {entry.profiles?.email ?? "Member"}
                        </div>
                      </div>
                    </div>
                    <div className="hidden text-right text-xs text-day-text-secondary dark:text-night-text-secondary md:block">
                      <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
                        {formatScore(entry[activeMetric])}
                      </div>
                      {sortOptions.find((opt) => opt.key === activeMetric)
                        ?.label ?? "Score"}
                    </div>
                    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${tierMeta.tone} ${tierMeta.text}`}>
                      <TierIcon className="h-3 w-3" />
                      {entry.tier ?? "Bronze"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-day-border bg-day-card p-6 text-sm text-day-text-secondary shadow-card dark:border-night-border dark:bg-night-card dark:text-night-text-secondary dark:shadow-card-dark">
            The leaderboard unlocks after 14 days of body-weight tracking. Keep
            logging daily to join the rankings.
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              My Ranking
            </div>
            {myEntry ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">
                    Overall Score
                  </span>
                  <span className="font-semibold">
                    {formatScore(myEntry.total_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">
                    Strength
                  </span>
                  <span className="font-semibold">
                    {formatScore(myEntry.strength_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">
                    Stamina
                  </span>
                  <span className="font-semibold">
                    {formatScore(myEntry.stamina_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">
                    Consistency
                  </span>
                  <span className="font-semibold">
                    {formatScore(myEntry.consistency_score)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-day-text-secondary dark:text-night-text-secondary">
                    Improvement
                  </span>
                  <span className="font-semibold">
                    {formatScore(myEntry.improvement_score)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                No ranking yet. Start logging workouts to appear here.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              Ranking Insights
            </div>
            <ul className="mt-4 space-y-3 text-sm text-day-text-secondary dark:text-night-text-secondary">
              <li>Scores update every time you log a workout or progress entry.</li>
              <li>Consistency weighs streaks and weekly activity.</li>
              <li>Improvement score rewards big progress jumps.</li>
            </ul>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
