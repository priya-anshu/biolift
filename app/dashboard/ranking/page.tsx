"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Settings, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
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

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return Number(value).toFixed(0);
}

export default function RankingPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "my-rank" | "admin">(
    "leaderboard",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      if (!user) {
        setLeaderboard([]);
        setMyEntry(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/ranking/overview", { cache: "no-store" });
        const payload = (await response.json()) as {
          leaderboard?: RawLeaderboardRow[];
          myEntry?: LeaderboardRow | null;
          profileId?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load ranking data");
        }

        const normalized: LeaderboardRow[] = (payload.leaderboard ?? [])
          .map((row) => ({
            ...row,
            profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
          }))
          .sort((a, b) => Number(b.total_score ?? 0) - Number(a.total_score ?? 0));
        const normalizedMyEntry = payload.myEntry
          ? {
              ...payload.myEntry,
              profiles: Array.isArray(payload.myEntry.profiles)
                ? payload.myEntry.profiles[0] ?? null
                : payload.myEntry.profiles ?? null,
            }
          : null;

        setLeaderboard(normalized);
        setMyEntry(normalizedMyEntry);
      } catch (loadError) {
        setLeaderboard([]);
        setMyEntry(null);
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

  const isAdmin =
    (user?.app_metadata?.role as string | undefined) === "admin" ||
    (user?.user_metadata?.role as string | undefined) === "admin";

  const tabs = [
    { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
    { id: "my-rank" as const, label: "My Ranking", icon: Star },
    ...(isAdmin ? [{ id: "admin" as const, label: "Admin", icon: Settings }] : []),
  ];

  const renderTabContent = () => {
    if (loading) {
      return (
        <Card className="p-6">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Loading ranking data...
          </div>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="p-6">
          <div className="text-sm text-red-600 dark:text-red-300">{error}</div>
        </Card>
      );
    }

    if (activeTab === "leaderboard") {
      return (
        <Card className="p-0">
          <div className="divide-y divide-day-border dark:divide-night-border">
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-day-text-secondary dark:text-night-text-secondary">
                No ranking data available yet
              </div>
            ) : (
              leaderboard.map((entry, index) => {
                const displayName = entry.profiles?.name ?? "Athlete";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 text-sm font-semibold text-day-text-secondary dark:text-night-text-secondary">
                        #{index + 1}
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-day-border dark:bg-night-border text-sm font-semibold text-day-text-secondary dark:text-night-text-secondary">
                        {entry.profiles?.avatar_url ? (
                          <Image
                            src={entry.profiles.avatar_url}
                            alt={displayName}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          displayName[0]
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-day-text-primary dark:text-night-text-primary">
                          {displayName}
                        </div>
                        <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                          {entry.tier ?? "Unranked"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                        {formatScore(entry.total_score)}
                      </div>
                      <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                        Total Score
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      );
    }

    if (activeTab === "my-rank") {
      return myEntry ? (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Rank
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {myEntry.position ? `#${myEntry.position}` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Overall Score
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatScore(myEntry.total_score)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Strength
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatScore(myEntry.strength_score)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Stamina
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatScore(myEntry.stamina_score)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Consistency
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatScore(myEntry.consistency_score)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-day-text-secondary dark:text-night-text-secondary">
                  Improvement
                </span>
                <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {formatScore(myEntry.improvement_score)}
                </span>
              </div>
            </div>
          </Card>
          <div className="text-center text-sm text-day-text-secondary dark:text-night-text-secondary">
            <p>Your ranking updates in real-time as you log workouts and progress</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-day-text-secondary dark:text-night-text-secondary">
            Ranking will appear after your profile gets its first leaderboard snapshot.
          </p>
        </div>
      );
    }

    return isAdmin ? (
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
              Admin Dashboard
            </h3>
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Open the current admin dashboard to manage rankings and users.
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
          >
            Open Admin
          </Link>
        </div>
      </Card>
    ) : (
      <div>Access denied</div>
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary mb-2">
              Smart Ranking System
            </h1>
            <p className="text-day-text-secondary dark:text-night-text-secondary">
              Dynamic leaderboards based on multi-factor performance metrics
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="p-0">
          <div className="flex flex-wrap gap-2 p-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center space-x-2"
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {renderTabContent()}
      </motion.div>
    </div>
  );
}
