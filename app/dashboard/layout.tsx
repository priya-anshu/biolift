"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Bell,
  Calendar,
  ChevronDown,
  Dumbbell,
  Home,
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

type DashboardLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  featureKey?: "social" | "shop";
};

type QuickAction = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type FeatureFlagState = {
  enabled: boolean;
  beta: boolean;
};

type DashboardFeatureFlags = {
  social: FeatureFlagState;
  shop: FeatureFlagState;
};

type FeatureFlagsResponse = {
  flags?: Partial<DashboardFeatureFlags>;
};

const defaultFeatureFlags: DashboardFeatureFlags = {
  social: { enabled: false, beta: true },
  shop: { enabled: false, beta: false },
};

const headerNavigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Workout", href: "/dashboard/workout-session", icon: Dumbbell },
  { name: "Ranking", href: "/dashboard/ranking", icon: Trophy },
  { name: "Progress", href: "/dashboard/progress", icon: LineChart },
  { name: "Diet", href: "/dashboard/diet", icon: Apple },
  { name: "Social", href: "/dashboard/social", icon: Users, featureKey: "social" },
  { name: "Store", href: "/dashboard/shop", icon: ShoppingBag, featureKey: "shop" },
  { name: "Profile", href: "/dashboard/profile", icon: User },
];

const sidebarNavigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Workout", href: "/dashboard/workout-session", icon: Dumbbell },
  { name: "Ranking", href: "/dashboard/ranking", icon: Trophy },
  { name: "Progress", href: "/dashboard/progress", icon: LineChart },
  { name: "Diet", href: "/dashboard/diet", icon: Apple },
  { name: "Social", href: "/dashboard/social", icon: Users, featureKey: "social" },
  { name: "Shop", href: "/dashboard/shop", icon: ShoppingBag, featureKey: "shop" },
  { name: "Profile", href: "/dashboard/profile", icon: User },
];

const quickActions: QuickAction[] = [
  { name: "Progress", href: "/dashboard/progress", icon: LineChart },
  { name: "Goals", href: "/dashboard/workout-planner", icon: Target },
  { name: "Schedule", href: "/dashboard/workouts", icon: Calendar },
  { name: "Settings", href: "/dashboard/profile", icon: Settings },
];

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeFeatureFlags(
  flags?: Partial<Record<keyof DashboardFeatureFlags, Partial<FeatureFlagState>>>,
): DashboardFeatureFlags {
  return {
    social: { ...defaultFeatureFlags.social, ...(flags?.social ?? {}) },
    shop: { ...defaultFeatureFlags.shop, ...(flags?.shop ?? {}) },
  };
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isDarkMode, isHydrated, toggleTheme } = useTheme();
  const [featureFlags, setFeatureFlags] =
    useState<DashboardFeatureFlags>(defaultFeatureFlags);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadFeatureFlags = async () => {
      try {
        const response = await fetch("/api/features", { cache: "no-store" });
        const payload = (await response.json()) as FeatureFlagsResponse;
        if (!response.ok || !payload.flags || cancelled) return;
        setFeatureFlags(mergeFeatureFlags(payload.flags));
      } catch {
        if (!cancelled) {
          setFeatureFlags(defaultFeatureFlags);
        }
      }
    };

    void loadFeatureFlags();

    return () => {
      cancelled = true;
    };
  }, []);

  const profileName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null;
  const profileEmail = user?.email ?? null;
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;
  const profileRank =
    (user?.user_metadata?.rank as string | undefined) ??
    (user?.user_metadata?.tier as string | undefined) ??
    "Rookie";
  const profileMembership =
    (user?.user_metadata?.membership as string | undefined) ?? "free";
  const profileLevel =
    (user?.user_metadata?.level as string | undefined) ?? "Beginner";
  const profilePoints = Number(user?.user_metadata?.points ?? 0);

  const displayName = profileName ?? profileEmail ?? "Member";
  const displayEmail = profileEmail ?? "member@biolift.com";

  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [displayName],
  );

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    setSidebarOpen(false);
    router.replace("/signin");
  };

  const isActive = (href: string) => pathname === href;

  const visibleHeaderNavigation = useMemo(
    () =>
      headerNavigation.filter(
        (item) => !item.featureKey || featureFlags[item.featureKey].enabled,
      ),
    [featureFlags],
  );

  const visibleSidebarNavigation = useMemo(
    () =>
      sidebarNavigation.filter(
        (item) => !item.featureKey || featureFlags[item.featureKey].enabled,
      ),
    [featureFlags],
  );

  const renderFeatureBadge = (item: NavItem) => {
    if (!item.featureKey || !featureFlags[item.featureKey].beta) {
      return null;
    }

    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        BETA
      </span>
    );
  };

  const renderAvatar = (size: number, textSize: string) => (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-day-border font-semibold text-day-text-secondary dark:bg-night-border dark:text-night-text-secondary ${textSize}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );

  const sidebarContent = (mobile: boolean) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-day-border dark:border-night-border">
        <Link href="/dashboard" className="flex items-center space-x-2" onClick={() => setSidebarOpen(false)}>
          <div className="w-8 h-8 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="text-xl font-bold font-orbitron text-gradient">Biolift</span>
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      {user ? (
        <div className="p-6 border-b border-day-border dark:border-night-border">
          <div className="flex items-center space-x-3">
            {renderAvatar(48, "text-sm")}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-day-text-primary dark:text-night-text-primary truncate">
                {displayName}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="badge badge-primary">{profileRank}</span>
                <span className="badge badge-ghost">{titleCase(profileMembership)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Level
              </span>
              <span className="font-medium text-day-text-primary dark:text-night-text-primary">
                {profileLevel}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-day-text-secondary dark:text-night-text-secondary">
                Points
              </span>
              <span className="font-medium text-day-text-primary dark:text-night-text-primary">
                {profilePoints.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="flex-1 p-6 space-y-2">
        <h3 className="text-xs font-semibold text-day-text-secondary dark:text-night-text-secondary uppercase tracking-wider mb-4">
          Navigation
        </h3>
        {visibleSidebarNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "text-day-accent-primary dark:text-night-accent bg-day-hover dark:bg-night-hover"
                  : "text-day-text-secondary dark:text-night-text-secondary hover:text-day-text-primary dark:hover:text-night-text-primary hover:bg-day-hover dark:hover:bg-night-hover"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="flex items-center gap-2">
                <span>{item.name}</span>
                {renderFeatureBadge(item)}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-day-border dark:border-night-border">
        <h3 className="text-xs font-semibold text-day-text-secondary dark:text-night-text-secondary uppercase tracking-wider mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex flex-col items-center p-3 rounded-lg text-center hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
              >
                <Icon className="w-5 h-5 mb-1 text-day-text-secondary dark:text-night-text-secondary" />
                <span className="text-xs font-medium text-day-text-secondary dark:text-night-text-secondary">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-day-bg dark:bg-night-bg text-day-text-primary dark:text-night-text-primary">
      <header className="fixed top-0 left-0 right-0 z-50 bg-day-card dark:bg-night-card border-b border-day-border dark:border-night-border backdrop-blur-sm">
        <div className="px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                aria-label="Open navigation"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link href="/dashboard" className="flex items-center space-x-2">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm lg:text-lg">B</span>
                </div>
                <span className="text-xl lg:text-2xl font-bold font-orbitron text-gradient">
                  Biolift
                </span>
              </Link>
            </div>

            <nav className="hidden lg:flex items-center space-x-8">
              {visibleHeaderNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-day-accent-primary dark:text-night-accent bg-day-hover dark:bg-night-hover"
                      : "text-day-text-secondary dark:text-night-text-secondary hover:text-day-text-primary dark:hover:text-night-text-primary hover:bg-day-hover dark:hover:bg-night-hover"
                  }`}
                >
                  {item.name}
                  {renderFeatureBadge(item)}
                </Link>
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                aria-label="Toggle theme"
              >
                {isHydrated ? (
                  isDarkMode ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              </motion.button>

              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                  >
                    <div className="w-8 h-8">{renderAvatar(32, "text-xs")}</div>
                    <span className="hidden md:block text-sm font-medium">{displayName}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-day-card dark:bg-night-card border border-day-border dark:border-night-border rounded-lg shadow-lg py-2"
                      >
                        <div className="px-4 py-2 border-b border-day-border dark:border-night-border">
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                            {displayEmail}
                          </p>
                        </div>

                        <Link
                          href="/dashboard/profile"
                          className="flex items-center px-4 py-2 text-sm hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <User className="w-4 h-4 mr-2" />
                          Profile
                        </Link>

                        <Link
                          href="/dashboard/profile"
                          className="flex items-center px-4 py-2 text-sm hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Link>

                        <button
                          type="button"
                          onClick={() => void handleSignOut()}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {sidebarOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-day-card dark:bg-night-card border-r border-day-border dark:border-night-border z-50 lg:hidden"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="pt-16 lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen p-4 lg:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
