"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/lib/theme/ThemeContext";

type AdminOverviewIdentity = {
  admin: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
};

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/queue", label: "Queue", icon: ShieldCheck },
];

function getInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [identity, setIdentity] = useState<AdminOverviewIdentity["admin"] | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadIdentity = async () => {
      try {
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        if (!response.ok) {
          setIdentity(null);
          return;
        }
        const payload = (await response.json()) as AdminOverviewIdentity;
        setIdentity(payload.admin ?? null);
      } catch {
        setIdentity(null);
      }
    };
    loadIdentity();
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isUserMenuOpen]);

  const displayName = useMemo(() => {
    if (identity?.name && identity.name.trim().length > 0) return identity.name;
    const fromUser =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    if (fromUser && fromUser.trim().length > 0) return fromUser;
    if (identity?.email) return identity.email.split("@")[0];
    if (user?.email) return user.email.split("@")[0];
    return "Admin";
  }, [identity?.email, identity?.name, user?.email, user?.user_metadata]);

  const displayEmail = identity?.email ?? user?.email ?? "admin@biolift.com";
  const avatarUrl =
    identity?.avatarUrl ??
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    router.replace("/signin");
  };

  return (
    <div className="min-h-screen bg-day-bg text-day-text-primary dark:bg-night-bg dark:text-night-text-primary">
      <header className="sticky top-0 z-30 border-b border-day-border bg-white/85 backdrop-blur dark:border-night-border dark:bg-black/75">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-day-border text-day-text-secondary dark:border-night-border dark:text-night-text-secondary lg:hidden"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open admin menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
                B
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-day-text-secondary dark:text-night-text-secondary">
                  Admin Control Center
                </div>
                <div className="text-xl font-semibold">BioLift Operations</div>
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    active
                      ? "bg-day-hover text-day-accent-primary dark:bg-night-hover dark:text-night-accent"
                      : "text-day-text-secondary hover:bg-day-hover hover:text-day-text-primary dark:text-night-text-secondary dark:hover:bg-night-hover dark:hover:text-night-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-day-border p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button
                type="button"
                className="rounded-full border border-day-border p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </button>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
            </div>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-day-border bg-day-card px-2 py-1 dark:border-night-border dark:bg-night-card"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-day-hover text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>
                <div className="hidden text-left leading-tight sm:block">
                  <div className="max-w-[140px] truncate text-sm font-semibold">
                    {displayName}
                  </div>
                  <div className="max-w-[140px] truncate text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {displayEmail}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
              </button>

              {isUserMenuOpen ? (
                <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-day-border bg-day-card p-1.5 shadow-xl dark:border-night-border dark:bg-night-card">
                  <Link
                    href="/dashboard"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-day-hover dark:hover:bg-night-hover"
                  >
                    Open User App
                  </Link>
                  <Link
                    href="/admin/users"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-day-hover dark:hover:bg-night-hover"
                  >
                    Manage Users
                  </Link>
                  <Link
                    href="/admin/queue"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-day-hover dark:hover:bg-night-hover"
                  >
                    Verification Queue
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-day-hover dark:hover:bg-night-hover"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close admin menu overlay"
          />
          <aside className="relative h-full w-72 border-r border-day-border bg-day-card shadow-2xl dark:border-night-border dark:bg-night-card">
            <div className="flex items-center justify-between border-b border-day-border px-4 py-4 dark:border-night-border">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-xs font-bold text-white">
                  B
                </div>
                <div className="text-lg font-semibold">Admin</div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-day-border p-2 text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close admin menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-4">
              <div className="rounded-2xl border border-day-border bg-day-hover p-3 dark:border-night-border dark:bg-night-hover">
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="truncate text-xs text-day-text-secondary dark:text-night-text-secondary">
                  {displayEmail}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        active
                          ? "bg-day-hover text-day-accent-primary dark:bg-night-hover dark:text-night-accent"
                          : "text-day-text-primary dark:text-night-text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
