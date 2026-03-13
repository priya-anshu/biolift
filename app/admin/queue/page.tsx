"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type QueueStatus = "pending" | "approved" | "rejected";

type QueueItem = {
  id: string;
  user_id: string;
  target_table: "progress_entries" | "workouts";
  target_record_id: string;
  reason: string;
  status: QueueStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  requester: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  reviewer: {
    name: string | null;
    email: string | null;
  } | null;
};

type QueueResponse = {
  items: QueueItem[];
  error?: string;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getDisplayName(name: string | null, email: string | null) {
  if (name && name.trim().length > 0) return name;
  if (email) return email.split("@")[0];
  return "User";
}

export default function AdminQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueStatus | "all">("pending");
  const [query, setQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/queue", { cache: "no-store" });
      const payload = (await response.json()) as QueueResponse;
      if (!response.ok) {
        setItems([]);
        setError(payload.error ?? "Failed to load queue.");
        setLoading(false);
        return;
      }
      setItems(payload.items ?? []);
    } catch {
      setItems([]);
      setError("Failed to load queue.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!term) return true;
      return (
        getDisplayName(item.requester.name, item.requester.email)
          .toLowerCase()
          .includes(term) ||
        (item.requester.email ?? "").toLowerCase().includes(term) ||
        item.reason.toLowerCase().includes(term) ||
        item.target_table.toLowerCase().includes(term)
      );
    });
  }, [filter, items, query]);

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const approvedCount = items.filter((item) => item.status === "approved").length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;

  const handleDecision = async (id: string, status: QueueStatus) => {
    if (status === "pending") return;
    setActionLoadingId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Failed to update request.");
        setActionLoadingId(null);
        return;
      }

      setNotice(`Request ${status}.`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                reviewed_at: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch {
      setError("Failed to update request.");
    }

    setActionLoadingId(null);
  };

  return (
    <div className="space-y-6">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold">Ranking Verification Queue</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Validate correction requests before score-affecting edits are unlocked.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search user, email, reason"
            className="w-full rounded-xl border border-day-border bg-day-card py-2 pl-10 pr-4 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent"
          />
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">Pending</div>
          <div className="mt-2 text-2xl font-semibold">{pendingCount}</div>
        </div>
        <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">Approved</div>
          <div className="mt-2 text-2xl font-semibold">{approvedCount}</div>
        </div>
        <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">Rejected</div>
          <div className="mt-2 text-2xl font-semibold">{rejectedCount}</div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-day-border bg-day-card p-4 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === status
                  ? "bg-day-accent-primary text-white dark:bg-night-accent"
                  : "border border-day-border text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              }`}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </motion.section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.12 }}
        className="rounded-2xl border border-day-border bg-day-card shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="divide-y divide-day-border dark:divide-night-border">
          {loading ? (
            <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Loading verification queue...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
              No requests found for this filter.
            </div>
          ) : (
            filtered.map((item) => {
              const displayName = getDisplayName(item.requester.name, item.requester.email);
              return (
                <div key={item.id} className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-day-hover text-sm font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                        {item.requester.avatarUrl ? (
                          <Image
                            src={item.requester.avatarUrl}
                            alt={displayName}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{displayName}</div>
                        <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                          {item.requester.email ?? "Unknown email"}
                        </div>
                        <div className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
                          Requested: {formatDateTime(item.requested_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-day-hover px-2 py-0.5 text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                        {item.target_table}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.status === "approved"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : item.status === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-day-border bg-day-hover/50 p-3 text-sm dark:border-night-border dark:bg-night-hover/50">
                    <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      Record ID
                    </div>
                    <div className="font-mono text-xs">{item.target_record_id}</div>
                    <div className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">
                      Reason
                    </div>
                    <div className="text-sm">{item.reason}</div>
                  </div>

                  {item.status === "pending" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(item.id, "approved")}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(item.id, "rejected")}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-day-hover px-3 py-1 text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                      <Clock3 className="h-3.5 w-3.5" />
                      Reviewed at: {formatDateTime(item.reviewed_at)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.section>

      <div className="rounded-xl border border-day-border bg-day-card px-4 py-3 text-xs text-day-text-secondary dark:border-night-border dark:bg-night-card dark:text-night-text-secondary">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Fair-play mode
        </div>
        <p className="mt-1">
          Users can request corrections, but only admins can approve score-impacting edits.
        </p>
      </div>
    </div>
  );
}
