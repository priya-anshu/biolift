"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Apple,
  Bell,
  CalendarCheck,
  ChevronDown,
  Dumbbell,
  LayoutGrid,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShoppingBag,
  Sun,
  Target,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ENABLE_SOCIAL_NAV = process.env.NEXT_PUBLIC_FEATURE_SOCIAL === "true";
const ENABLE_SHOP_NAV = process.env.NEXT_PUBLIC_FEATURE_SHOP === "true";

export default function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    router.replace("/signin");
  };

  const profileName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null;
  const profileEmail = user?.email ?? null;
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;
  const profileLevel = (user?.user_metadata?.level as string | undefined) ?? null;
  const profilePoints = (user?.user_metadata?.points as number | undefined) ?? null;

  const displayName = profileName ?? profileEmail ?? "Member";
  const displayEmail = profileEmail ?? "Member";
  const initials = displayName
    .split(" ")
    .map((word: string) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    { href: "/dashboard/workout-session", label: "Workout", icon: Dumbbell },
    { href: "/dashboard/progress", label: "Progress", icon: LineChart },
    { href: "/dashboard/ranking", label: "Ranking", icon: Trophy },
    { href: "/dashboard/diet", label: "Diet", icon: Apple },
    { href: "/dashboard/profile", label: "Profile", icon: User },
    ...(ENABLE_SOCIAL_NAV ? [{ href: "/dashboard/social", label: "Social", icon: Users }] : []),
    ...(ENABLE_SHOP_NAV
      ? [{ href: "/dashboard/shop", label: "Shop", icon: ShoppingBag }]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-day-border bg-white/80 backdrop-blur dark:border-night-border dark:bg-black/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-day-border text-day-text-secondary dark:border-night-border dark:text-night-text-secondary md:hidden"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
            B
          </div>
          <span className="text-lg font-semibold text-sky-600">BioLift</span>
        </div>
          </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-day-text-secondary dark:text-night-text-secondary md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "rounded-lg bg-slate-100 px-3 py-1 text-slate-900 dark:bg-night-hover dark:text-night-text-primary"
                    : "hover:text-day-text-primary dark:hover:text-night-text-primary"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={toggleTheme}
            className="rounded-full border border-day-border p-2 text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className="relative">
            <button className="rounded-full border border-day-border p-2 text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
              <Bell className="h-5 w-5" />
            </button>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-day-border bg-day-card px-2 py-1 dark:border-night-border dark:bg-night-card"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-day-border text-xs font-semibold text-day-text-secondary dark:bg-night-border dark:text-night-text-secondary">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={displayName} width={32} height={32} />
                ) : (
                  initials || <User className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
                )}
              </div>
              <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary lg:hidden">
                {displayName}
              </span>
              <span className="hidden text-sm font-medium text-day-text-primary dark:text-night-text-primary lg:inline">
                {displayEmail}
              </span>
              <ChevronDown className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
            </button>
            {isUserMenuOpen ? (
              <div className="absolute right-0 top-12 z-40 w-52 rounded-xl border border-day-border bg-day-card p-1.5 shadow-xl dark:border-night-border dark:bg-night-card">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-day-text-primary hover:bg-day-hover dark:text-night-text-primary dark:hover:bg-night-hover"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-day-text-primary hover:bg-day-hover dark:text-night-text-primary dark:hover:bg-night-hover"
                >
                  <Settings className="h-4 w-4" />
                  Settings
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
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-day-border bg-day-card text-day-text-primary shadow-2xl dark:border-night-border dark:bg-night-card dark:text-night-text-primary">
            <div className="flex items-center justify-between border-b border-day-border px-4 py-4 dark:border-night-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
                  B
                </div>
                <span className="text-lg font-semibold">BioLift</span>
              </div>
              <button
                type="button"
                className="rounded-lg border border-day-border p-2 text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center gap-3 rounded-2xl border border-day-border bg-day-hover p-3 dark:border-night-border dark:bg-black/30">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-day-border text-sm font-semibold text-day-text-secondary dark:bg-night-border dark:text-night-text-secondary">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={displayName} width={44} height={44} />
                  ) : (
                    initials || <User className="h-5 w-5 text-day-text-secondary dark:text-night-text-secondary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {displayEmail}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-day-text-secondary dark:text-night-text-secondary">
                <div>
                  <div className="text-[11px] uppercase tracking-wide">Level</div>
                  <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
                    {profileLevel ?? "Beginner"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide">Points</div>
                  <div className="text-sm font-semibold text-day-text-primary dark:text-night-text-primary">
                    {profilePoints ?? 0}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
                Navigation
              </div>
              <nav className="mt-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        isActive
                          ? "bg-day-hover text-day-accent-primary dark:bg-night-hover dark:text-night-accent"
                          : "text-day-text-primary hover:bg-day-hover dark:text-night-text-primary dark:hover:bg-night-hover"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-6 border-t border-day-border pt-4 text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:border-night-border dark:text-night-text-secondary">
                Quick Actions
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  { label: "Progress", icon: LineChart },
                  { label: "Goals", icon: Target },
                  { label: "Schedule", icon: CalendarCheck },
                  { label: "Settings", icon: Settings },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      className="flex flex-col items-center gap-2 rounded-xl border border-day-border bg-day-hover px-3 py-3 text-xs text-day-text-primary dark:border-night-border dark:bg-black/20 dark:text-night-text-primary"
                      type="button"
                    >
                      <Icon className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" />
                      {action.label}
                    </button>
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
    </>
  );
}
