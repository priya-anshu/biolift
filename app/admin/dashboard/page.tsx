"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type OverviewResponse = {
  admin: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  metrics: {
    totalUsers: number;
    activeToday: number;
    totalWorkouts: number;
    pendingCorrections: number;
    approvedLast24h: number;
  };
  recentUsers: Array<{
    key: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    role: string | null;
    createdAt: string | null;
    profileIds: string[];
    authUserIds: string[];
  }>;
  recentRequests: Array<{
    id: string;
    user_id: string;
    target_table: "progress_entries" | "workouts";
    target_record_id: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    requested_at: string;
    reviewed_at: string | null;
    requester: {
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
    };
  }>;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function getName(name: string | null, email: string | null) {
  if (name && name.trim().length > 0) return name;
  if (email) return email.split("@")[0];
  return "User";
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        const payload = (await response.json()) as OverviewResponse & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Failed to load admin dashboard.");
          setData(null);
          setLoading(false);
          return;
        }
        setData(payload);
      } catch {
        setError("Failed to load admin dashboard.");
      }
      setLoading(false);
    };
    load();
  }, []);

  const displayName = useMemo(() => {
    return getName(data?.admin.name ?? null, data?.admin.email ?? null);
  }, [data?.admin.email, data?.admin.name]);

  const stats = [
    {
      label: "Total Users",
      value: data?.metrics.totalUsers ?? 0,
      helper: `${data?.recentUsers.length ?? 0} recent signups`,
      icon: Users,
      tint: "text-blue-600",
      badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300",
    },
    {
      label: "Active Today",
      value: data?.metrics.activeToday ?? 0,
      helper: "workout/progress activity",
      icon: Activity,
      tint: "text-emerald-600",
      badge:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
    },
    {
      label: "Total Workouts",
      value: data?.metrics.totalWorkouts ?? 0,
      helper: "logged in database",
      icon: BarChart3,
      tint: "text-amber-600",
      badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
    },
    {
      label: "Pending Corrections",
      value: data?.metrics.pendingCorrections ?? 0,
      helper: `${data?.metrics.approvedLast24h ?? 0} approved (24h)`,
      icon: ShieldCheck,
      tint: "text-purple-600",
      badge:
        "bg-purple-50 text-purple-700 dark:bg-purple-900/25 dark:text-purple-300",
    },
  ];

  return (
    <div className="space-y-8">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-3xl font-semibold">Welcome back, {displayName}</h1>
        <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
          Live operational data from production tables.
        </p>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
                <item.icon className={`h-4 w-4 ${item.tint}`} />
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.badge}`}>
                Live
              </span>
            </div>
            <div className="mt-4 text-2xl font-semibold">{loading ? "..." : item.value}</div>
            <div className="text-sm">{item.label}</div>
            <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
              {item.helper}
            </div>
          </article>
        ))}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.08 }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <Link
          href="/admin/users"
          className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg dark:border-night-border dark:bg-night-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
              <Users className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">User Management</h2>
          <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
            View all users, deduped by email, and manage roles.
          </p>
          <div className="btn-primary mt-5 inline-flex px-4 py-2 text-sm">Open Users</div>
        </Link>

        <Link
          href="/admin/queue"
          className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg dark:border-night-border dark:bg-night-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Verification Queue</h2>
          <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Approve or reject ranking correction requests.
          </p>
          <div className="btn-primary mt-5 inline-flex px-4 py-2 text-sm">Open Queue</div>
        </Link>

        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Data Integrity</h2>
          <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Duplicate users are merged at display level by normalized email to avoid split identity.
          </p>
          <div className="mt-5 rounded-xl bg-day-hover/70 px-3 py-2 text-xs dark:bg-night-hover/60">
            Dedupe mode: enabled
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.12 }}
        className="grid gap-4 xl:grid-cols-[1.2fr,1fr]"
      >
        <article className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Users</h2>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 text-sm font-semibold text-day-accent-primary dark:text-night-accent"
            >
              Manage all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Loading users...
              </div>
            ) : (data?.recentUsers ?? []).length === 0 ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                No users found.
              </div>
            ) : (
              (data?.recentUsers ?? []).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-day-border bg-day-hover/60 px-3 py-2 dark:border-night-border dark:bg-night-hover/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-day-card text-xs font-semibold dark:bg-night-card">
                      {item.avatarUrl ? (
                        <Image
                          src={item.avatarUrl}
                          alt={getName(item.name, item.email)}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        getName(item.name, item.email)[0]
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {getName(item.name, item.email)}
                      </div>
                      <div className="truncate text-xs text-day-text-secondary dark:text-night-text-secondary">
                        {item.email ?? "Unknown email"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-day-text-secondary dark:text-night-text-secondary">
                    <div>{item.profileIds.length} linked</div>
                    <div>{formatDate(item.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Queue Activity</h2>
            <Link
              href="/admin/queue"
              className="inline-flex items-center gap-2 text-sm font-semibold text-day-accent-primary dark:text-night-accent"
            >
              Open queue
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                Loading queue...
              </div>
            ) : (data?.recentRequests ?? []).length === 0 ? (
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                No correction requests.
              </div>
            ) : (
              (data?.recentRequests ?? []).map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-day-border bg-day-hover/60 px-3 py-2 dark:border-night-border dark:bg-night-hover/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {getName(request.requester.name, request.requester.email)}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        request.status === "approved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : request.status === "rejected"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {request.target_table} • {formatDate(request.requested_at)}
                  </div>
                  <div className="mt-1 text-sm">{request.reason}</div>
                </div>
              ))
            )}
          </div>
        </article>
      </motion.section>
    </div>
  );
}
