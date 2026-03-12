"use client";

import { motion } from "framer-motion";
import { Search, ShieldCheck, User, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Role = "user" | "admin";

type AdminUser = {
  key: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
  createdAt: string | null;
  profileIds: string[];
  authUserIds: string[];
};

type UsersResponse = {
  users: AdminUser[];
  error?: string;
};

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function getDisplayName(name: string | null, email: string | null) {
  if (name && name.trim().length > 0) return name;
  if (email) return email.split("@")[0];
  return "User";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = (await response.json()) as UsersResponse;
      if (!response.ok) {
        setUsers([]);
        setError(payload.error ?? "Failed to load users.");
        setLoading(false);
        return;
      }
      setUsers(payload.users ?? []);
    } catch {
      setUsers([]);
      setError("Failed to load users.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => {
      const name = getDisplayName(item.name, item.email).toLowerCase();
      const email = (item.email ?? "").toLowerCase();
      const role = (item.role ?? "user").toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }, [query, users]);

  const adminCount = users.filter((item) => (item.role ?? "user") === "admin").length;

  const updateRole = async (user: AdminUser, role: Role) => {
    setSavingKey(user.key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: user.profileIds, role }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Failed to update role.");
        setSavingKey(null);
        return;
      }

      setUsers((prev) =>
        prev.map((item) => (item.key === user.key ? { ...item, role } : item)),
      );
      setNotice(
        `${getDisplayName(user.name, user.email)} set to ${role}.`,
      );
    } catch {
      setError("Failed to update role.");
    }
    setSavingKey(null);
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
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Accounts are deduped by email so Google + password login stays one identity.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, role"
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
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Total Users
          </div>
          <div className="mt-2 text-2xl font-semibold">{users.length}</div>
        </div>
        <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">Admins</div>
          <div className="mt-2 text-2xl font-semibold">{adminCount}</div>
        </div>
        <div className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Linked Accounts
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {users.reduce((sum, user) => sum + user.profileIds.length, 0)}
          </div>
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
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-day-border bg-day-card shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="divide-y divide-day-border dark:divide-night-border">
          {loading ? (
            <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-sm text-day-text-secondary dark:text-night-text-secondary">
              No users found.
            </div>
          ) : (
            filteredUsers.map((item) => {
              const displayName = getDisplayName(item.name, item.email);
              const role = (item.role ?? "user") as Role;
              return (
                <div key={item.key} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-day-hover text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={displayName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{displayName}</div>
                        <div className="truncate text-xs text-day-text-secondary dark:text-night-text-secondary">
                          {item.email ?? "Unknown email"}
                        </div>
                        <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                          Joined: {formatDate(item.createdAt)}
                        </div>
                        <div className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                          Linked profiles: {item.profileIds.length}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          role === "admin"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-day-hover text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary"
                        }`}
                      >
                        {role}
                      </span>
                      <button
                        type="button"
                        disabled={savingKey === item.key || role === "user"}
                        onClick={() => updateRole(item, "user")}
                        className="rounded-lg border border-day-border px-3 py-1.5 text-xs font-semibold transition hover:bg-day-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-night-border dark:hover:bg-night-hover"
                      >
                        Set User
                      </button>
                      <button
                        type="button"
                        disabled={savingKey === item.key || role === "admin"}
                        onClick={() => updateRole(item, "admin")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Set Admin
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.section>

      <div className="rounded-xl border border-day-border bg-day-card px-4 py-3 text-xs text-day-text-secondary dark:border-night-border dark:bg-night-card dark:text-night-text-secondary">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" />
          Dedupe policy
        </div>
        <p className="mt-1">
          User list is grouped by normalized email. Role updates are applied across all linked profile rows for the same account.
        </p>
      </div>
    </div>
  );
}
