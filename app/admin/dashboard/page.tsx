"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useTheme } from "@/lib/theme/ThemeContext";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bolt,
  CheckCircle2,
  Clock,
  Database,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Moon,
  Sun,
  X,
} from "lucide-react";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const stats = [
  {
    label: "Total Users",
    value: "1,248",
    delta: "+7.2%",
    icon: Users,
    tint: "text-blue-600",
    badge: "bg-blue-50 text-blue-600",
  },
  {
    label: "Active Today",
    value: "412",
    delta: "+3.1%",
    icon: Activity,
    tint: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "Ranking Runs",
    value: "28",
    delta: "Last 24h",
    icon: BarChart3,
    tint: "text-amber-600",
    badge: "bg-amber-50 text-amber-600",
  },
  {
    label: "System Status",
    value: "Stable",
    delta: "99.9% uptime",
    icon: ShieldCheck,
    tint: "text-purple-600",
    badge: "bg-purple-50 text-purple-600",
  },
];

const alerts = [
  {
    title: "Nutrition model refresh",
    time: "2 hours ago",
    status: "Queued",
  },
  {
    title: "Workout index rebuild",
    time: "Yesterday",
    status: "Completed",
  },
  {
    title: "Ranking weights review",
    time: "3 days ago",
    status: "Pending",
  },
];

const systemCards = [
  {
    title: "Ranking Engine",
    description: "Adjust scoring weights and monitor recalculation jobs.",
    cta: "Open Controls",
    icon: SlidersHorizontal,
  },
  {
    title: "Data Pipelines",
    description: "Track ingestion, validation, and enrichment status.",
    cta: "View Pipelines",
    icon: Database,
  },
  {
    title: "AI Agents",
    description: "Monitor personalization bots and conversation queues.",
    cta: "Manage Agents",
    icon: Bolt,
  },
];

export default function AdminDashboardPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-day-bg text-day-text-primary dark:bg-night-bg dark:text-night-text-primary">
      <header className="sticky top-0 z-10 border-b border-day-border bg-white/80 backdrop-blur dark:border-night-border dark:bg-black/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-day-border text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover lg:hidden"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open admin navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
            <p className="text-xs uppercase tracking-[0.2em] text-day-text-secondary dark:text-night-text-secondary">
              Admin Control Center
            </p>
            <h1 className="text-xl font-semibold">BioLift Operations</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-full border border-day-border p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            <button className="rounded-full border border-day-border p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-day-border bg-day-card px-3 py-2 text-xs font-semibold dark:border-night-border dark:bg-night-card">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Admin Verified
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation overlay"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-day-border bg-day-card text-day-text-primary shadow-2xl dark:border-night-border dark:bg-night-card dark:text-night-text-primary">
            <div className="flex items-center justify-between border-b border-day-border px-4 py-4 dark:border-night-border">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-day-text-secondary dark:text-night-text-secondary">
                  Admin Control Center
                </p>
                <h2 className="text-lg font-semibold">BioLift Ops</h2>
              </div>
              <button
                type="button"
                className="rounded-lg border border-day-border p-2 text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close admin navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="rounded-2xl border border-day-border bg-day-hover p-4 text-sm dark:border-night-border dark:bg-night-hover">
                <div className="text-xs uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Navigation
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {["Overview", "Users", "Content", "Security", "Settings"].map((item) => (
                    <li
                      key={item}
                      className="rounded-xl border border-day-border px-3 py-2 text-day-text-secondary transition hover:bg-day-card dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-card"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded-2xl border border-day-border bg-day-hover p-4 text-sm dark:border-night-border dark:bg-night-hover">
                <div className="text-xs uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                  Quick Actions
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-day-text-secondary dark:text-night-text-secondary">
                  {["Audit Logs", "Flags", "Exports", "Access"].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-day-border px-3 py-2 text-center dark:border-night-border"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold">
            Welcome back, Admin
          </h2>
          <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Live operational overview (sample data until DB models land).
          </p>
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
                  <card.icon className={`h-4 w-4 ${card.tint}`} />
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${card.badge}`}>
                  {card.delta}
                </span>
              </div>
              <div className="mt-4 text-2xl font-semibold">{card.value}</div>
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {card.label}
              </div>
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
          {systemCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-day-hover dark:bg-night-hover">
                  <card.icon className="h-5 w-5 text-day-text-primary dark:text-night-text-primary" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
                {card.description}
              </p>
              <button className="btn-primary mt-5 w-full text-sm">
                {card.cta}
              </button>
            </div>
          ))}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid gap-4 lg:grid-cols-[1.2fr,1fr]"
        >
          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <h3 className="text-lg font-semibold">AI & Data Operations</h3>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              Track automated pipelines, model refresh, and data integrity.
            </p>
            <div className="mt-6 space-y-4">
              {[
                { label: "Vector Index Sync", value: "92%", icon: Database },
                { label: "Nutrition ETL", value: "76%", icon: Clock },
                { label: "Ranking Recalc", value: "48%", icon: BarChart3 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                    <div
                      className="h-2 rounded-full bg-day-accent-primary dark:bg-night-accent"
                      style={{ width: row.value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
            <h3 className="text-lg font-semibold">System Alerts</h3>
            <div className="mt-4 space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.title}
                  className="flex items-start justify-between rounded-xl border border-day-border bg-day-hover/60 px-4 py-3 dark:border-night-border dark:bg-night-hover/60"
                >
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {alert.time}
                    </p>
                  </div>
                  <span className="rounded-full bg-day-card px-2 py-1 text-xs font-semibold text-day-text-secondary dark:bg-night-card dark:text-night-text-secondary">
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
