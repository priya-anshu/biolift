"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Bell,
  Calendar,
  Camera,
  Crown,
  CreditCard,
  Edit,
  Globe,
  Shield,
  Target,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  rank: string | null;
  membership: string | null;
  level: string | null;
  points: number | null;
};

type ProfileSettings = {
  two_factor_enabled: boolean;
  login_alerts: boolean;
  profile_visibility: "private" | "friends" | "public";
  data_sharing_analytics: boolean;
  notify_workout_reminders: boolean;
  notify_progress_milestones: boolean;
  notify_social_updates: boolean;
  notify_marketing: boolean;
  billing_plan: "free" | "premium" | "elite";
  auto_renew: boolean;
  currency: "USD" | "EUR" | "INR";
  language: "en" | "es" | "hi";
  timezone: string;
  units: "metric" | "imperial";
  date_format: "MM/DD/YYYY" | "DD/MM/YYYY";
};

type ProfileStats = {
  workoutsCompleted: number;
  daysActive: number;
  achievements: number;
  currentStreak: number;
};

type ProfileOverviewResponse = {
  profile: Profile;
  settings: ProfileSettings;
  settingsAvailable: boolean;
  stats: ProfileStats;
  error?: string;
};

const defaultProfileSettings: ProfileSettings = {
  two_factor_enabled: false,
  login_alerts: true,
  profile_visibility: "private",
  data_sharing_analytics: false,
  notify_workout_reminders: true,
  notify_progress_milestones: true,
  notify_social_updates: true,
  notify_marketing: false,
  billing_plan: "free",
  auto_renew: true,
  currency: "USD",
  language: "en",
  timezone: "Asia/Kolkata",
  units: "metric",
  date_format: "DD/MM/YYYY",
};

const membershipTiers = [
  {
    name: "Free",
    price: "$0",
    features: ["Basic workout plans", "Progress tracking", "Community access"],
  },
  {
    name: "Premium",
    price: "$9.99/month",
    features: [
      "AI-powered plans",
      "Advanced analytics",
      "Personal trainer",
      "Priority support",
    ],
  },
  {
    name: "Elite",
    price: "$19.99/month",
    features: [
      "Everything in Premium",
      "1-on-1 coaching",
      "Custom meal plans",
      "Exclusive content",
    ],
  },
];

const recentAchievements = [
  { name: "Streak Master", description: "7 day workout streak", date: "2 days ago" },
  { name: "Goal Crusher", description: "Hit 3 monthly goals", date: "1 week ago" },
  { name: "Energy Boost", description: "Burned 2000+ calories", date: "2 weeks ago" },
];

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-day-border/70 bg-day-card/60 px-4 py-3 transition hover:border-day-accent-primary/40 dark:border-night-border/70 dark:bg-night-card/60 dark:hover:border-night-accent/50">
      <span className="text-sm font-medium text-day-text-primary dark:text-night-text-primary">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked
            ? "bg-day-accent-primary dark:bg-night-accent"
            : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

function SettingSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-xl border border-day-border/70 bg-day-card/80 px-4 py-3 text-sm font-medium text-day-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border/70 dark:bg-night-card/80 dark:text-night-text-primary dark:focus:ring-night-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSettings, setActiveSettings] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProfileSettings>(defaultProfileSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    workoutsCompleted: 0,
    daysActive: 0,
    achievements: 0,
    currentStreak: 0,
  });
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    bio: "Fitness enthusiast passionate about health and wellness",
  });

  const settingsCards = [
    {
      key: "privacy",
      label: "Privacy & Security",
      icon: Shield,
      description: "Password, 2FA, and data controls",
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: Bell,
      description: "Push, email, and reminders",
    },
    {
      key: "billing",
      label: "Billing & Payment",
      icon: CreditCard,
      description: "Plan, invoices, and payment methods",
    },
    {
      key: "language",
      label: "Language & Region",
      icon: Globe,
      description: "Locale, timezone, and units",
    },
  ];

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      setSettingsLoading(true);
      setSettingsMessage(null);
      try {
        const response = await fetch("/api/profile/overview", { cache: "no-store" });
        const payload = (await response.json()) as ProfileOverviewResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Failed to load profile");
        }
        const profileData = payload.profile;
        setProfile(profileData);
        setSettings({ ...defaultProfileSettings, ...payload.settings });
        setProfileStats(payload.stats);
        if (!payload.settingsAvailable) {
          setSettingsMessage("Settings table is not ready yet. Run profile_settings SQL first.");
        }
        setEditData((prev) => ({
          ...prev,
          name: profileData.name ?? "",
          email: profileData.email ?? "",
        }));
      } catch (error) {
        setSettingsMessage(
          error instanceof Error ? error.message : "Failed to load profile overview.",
        );
      } finally {
        setSettingsLoading(false);
      }
    };
    void loadProfile();
  }, [user]);

  useEffect(() => {
    if (!activeSettings) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeSettings]);

  const initials = useMemo(() => {
    if (!profile?.name) return "B";
    return profile.name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [profile?.name]);

  const stats = [
    { label: "Workouts Completed", value: String(profileStats.workoutsCompleted), icon: Target },
    { label: "Days Active", value: String(profileStats.daysActive), icon: Calendar },
    { label: "Achievements", value: String(profileStats.achievements), icon: Award },
    { label: "Current Streak", value: String(profileStats.currentStreak), icon: Award },
  ];

  const handleSave = async () => {
    if (!profile?.id) return;
    setSettingsMessage(null);
    try {
      const response = await fetch("/api/profile/overview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editData.name }),
      });
      const payload = (await response.json()) as ProfileOverviewResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to save profile");
      }
      setProfile(payload.profile);
      setIsEditing(false);
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : "Could not save profile.",
      );
    }
  };

  const handleCancel = () => {
    setEditData((prev) => ({
      ...prev,
      name: profile?.name ?? "",
      email: profile?.email ?? "",
      bio: prev.bio,
    }));
    setIsEditing(false);
  };

  const updateSetting = <K extends keyof ProfileSettings>(
    key: K,
    value: ProfileSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const response = await fetch("/api/profile/overview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = (await response.json()) as ProfileOverviewResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Could not save settings");
      }
      setProfile(payload.profile);
      setSettings({ ...defaultProfileSettings, ...payload.settings });
      setProfileStats(payload.stats);
      setSettingsMessage("Settings saved successfully.");
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? `Could not save settings: ${error.message}` : "Could not save settings.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/signin");
  };

  const activeSettingsItem = settingsCards.find((item) => item.key === activeSettings);

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
          Manage your account and preferences.
        </p>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-day-hover text-2xl font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.name ?? "Avatar"}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-day-accent-primary text-white dark:bg-night-accent">
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold">{profile?.name ?? "Member"}</h2>
              <span className="rounded-full bg-day-hover px-2 py-0.5 text-xs font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                {profile?.rank ?? "Rookie"}
              </span>
              {profile?.membership === "premium" || profile?.membership === "elite" ? (
                <Crown className="h-5 w-5 text-amber-500" />
              ) : null}
            </div>
            <p className="mt-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
              {editData.bio}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-day-text-secondary dark:text-night-text-secondary">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined 2024
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {profile?.level ?? "Beginner"} level
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {profile?.points ?? 0} points
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              onClick={() => setIsEditing((prev) => !prev)}
            >
              <Edit className="h-4 w-4" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-night-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-day-border bg-day-card p-4 text-center shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <Icon className="mx-auto h-5 w-5 text-day-accent-primary dark:text-night-accent" />
              <div className="mt-2 text-2xl font-semibold">{stat.value}</div>
              <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                {stat.label}
              </div>
            </div>
          );
        })}
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
        >
          <h3 className="text-lg font-semibold">Personal Information</h3>
          {isEditing ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Full Name
                </label>
                <input
                  value={editData.name}
                  onChange={(event) =>
                    setEditData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
                />
              </div>
              <div>
                <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Email
                </label>
                <input
                  value={editData.email}
                  onChange={(event) =>
                    setEditData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
                />
              </div>
              <div>
                <label className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Bio
                </label>
                <textarea
                  value={editData.bio}
                  onChange={(event) =>
                    setEditData((prev) => ({ ...prev, bio: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm text-day-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
                <button
                  className="rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Full Name
                </div>
                <div>{profile?.name ?? "Member"}</div>
              </div>
              <div>
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Email
                </div>
                <div>{profile?.email ?? "member@biolift.com"}</div>
              </div>
              <div>
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  Bio
                </div>
                <div>{editData.bio}</div>
              </div>
            </div>
          )}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Membership</h3>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-4 space-y-4 text-sm">
            {membershipTiers.map((tier) => {
              const current = tier.name.toLowerCase() === profile?.membership;
              return (
                <div
                  key={tier.name}
                  className={`rounded-xl border-2 p-4 ${
                    current
                      ? "border-day-accent-primary bg-day-accent-primary/5 dark:border-night-accent dark:bg-night-accent/10"
                      : "border-day-border hover:border-day-accent-primary/40 dark:border-night-border dark:hover:border-night-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{tier.name}</div>
                    <div className="text-right">
                      <div className="font-semibold">{tier.price}</div>
                      {current ? (
                        <span className="rounded-full bg-day-accent-primary px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-night-accent">
                          Current
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-day-accent-primary dark:bg-night-accent" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {!current ? (
                    <button className="mt-3 w-full rounded-lg bg-day-accent-primary px-4 py-2 text-xs font-semibold text-white dark:bg-night-accent">
                      Upgrade
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </motion.section>
      </div>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.25 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <h3 className="text-lg font-semibold">Recent Achievements</h3>
        <div className="mt-4 space-y-3 text-sm">
          {recentAchievements.map((achievement) => (
            <div
              key={achievement.name}
              className="flex items-center justify-between rounded-xl border border-day-border px-3 py-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
            >
              <div>
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  {achievement.name}
                </div>
                <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                  {achievement.description}
                </div>
              </div>
              <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                {achievement.date}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <h3 className="text-lg font-semibold">Settings</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {settingsCards.map((item) => {
            const Icon = item.icon;
            const isActive = activeSettings === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSettings(item.key)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-4 text-left text-sm transition ${
                  isActive
                    ? "border-day-accent-primary bg-day-hover text-day-text-primary dark:border-night-accent dark:bg-night-hover dark:text-night-text-primary"
                    : "border-day-border text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-day-hover text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {item.label}
                  </div>
                  <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.section>

      <AnimatePresence>
        {activeSettings ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-lg"
            onClick={() => setActiveSettings(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-day-border/80 bg-day-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.35)] dark:border-night-border/80 dark:bg-night-card/95"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-day-border/80 bg-gradient-to-r from-day-card via-day-hover/60 to-day-card px-5 py-4 backdrop-blur dark:border-night-border/80 dark:bg-gradient-to-r dark:from-night-card dark:via-night-hover/40 dark:to-night-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                      {activeSettingsItem?.label}
                    </h4>
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {activeSettingsItem?.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSettings(null)}
                    className="rounded-xl border border-day-border/80 p-2 text-day-text-secondary transition hover:bg-day-hover dark:border-night-border/80 dark:text-night-text-secondary dark:hover:bg-night-hover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 text-sm">
                {settingsLoading ? (
                  <div className="rounded-xl border border-day-border/70 bg-day-hover/60 p-4 text-day-text-secondary dark:border-night-border/70 dark:bg-night-hover/60 dark:text-night-text-secondary">
                    Loading settings...
                  </div>
                ) : null}

                {!settingsLoading && activeSettings === "privacy" ? (
                  <div className="space-y-4">
                    <SettingToggle
                      label="Two-factor authentication"
                      checked={settings.two_factor_enabled}
                      onChange={(value) => updateSetting("two_factor_enabled", value)}
                    />
                    <SettingToggle
                      label="Login alerts"
                      checked={settings.login_alerts}
                      onChange={(value) => updateSetting("login_alerts", value)}
                    />
                    <SettingSelect
                      label="Profile visibility"
                      value={settings.profile_visibility}
                      onChange={(value) => updateSetting("profile_visibility", value)}
                      options={[
                        { label: "Private", value: "private" },
                        { label: "Friends", value: "friends" },
                        { label: "Public", value: "public" },
                      ]}
                    />
                    <SettingToggle
                      label="Share anonymized analytics"
                      checked={settings.data_sharing_analytics}
                      onChange={(value) => updateSetting("data_sharing_analytics", value)}
                    />
                  </div>
                ) : null}

                {!settingsLoading && activeSettings === "notifications" ? (
                  <div className="space-y-4">
                    <SettingToggle
                      label="Workout reminders"
                      checked={settings.notify_workout_reminders}
                      onChange={(value) => updateSetting("notify_workout_reminders", value)}
                    />
                    <SettingToggle
                      label="Progress milestones"
                      checked={settings.notify_progress_milestones}
                      onChange={(value) => updateSetting("notify_progress_milestones", value)}
                    />
                    <SettingToggle
                      label="Social updates"
                      checked={settings.notify_social_updates}
                      onChange={(value) => updateSetting("notify_social_updates", value)}
                    />
                    <SettingToggle
                      label="Marketing emails"
                      checked={settings.notify_marketing}
                      onChange={(value) => updateSetting("notify_marketing", value)}
                    />
                  </div>
                ) : null}

                {!settingsLoading && activeSettings === "billing" ? (
                  <div className="space-y-4">
                    <SettingSelect
                      label="Plan"
                      value={settings.billing_plan}
                      onChange={(value) => updateSetting("billing_plan", value)}
                      options={[
                        { label: "Free", value: "free" },
                        { label: "Premium", value: "premium" },
                        { label: "Elite", value: "elite" },
                      ]}
                    />
                    <SettingSelect
                      label="Currency"
                      value={settings.currency}
                      onChange={(value) => updateSetting("currency", value)}
                      options={[
                        { label: "USD", value: "USD" },
                        { label: "EUR", value: "EUR" },
                        { label: "INR", value: "INR" },
                      ]}
                    />
                    <SettingToggle
                      label="Auto-renew subscription"
                      checked={settings.auto_renew}
                      onChange={(value) => updateSetting("auto_renew", value)}
                    />
                  </div>
                ) : null}

                {!settingsLoading && activeSettings === "language" ? (
                  <div className="space-y-4">
                    <SettingSelect
                      label="Language"
                      value={settings.language}
                      onChange={(value) => updateSetting("language", value)}
                      options={[
                        { label: "English", value: "en" },
                        { label: "Spanish", value: "es" },
                        { label: "Hindi", value: "hi" },
                      ]}
                    />
                    <SettingSelect
                      label="Timezone"
                      value={settings.timezone}
                      onChange={(value) => updateSetting("timezone", value)}
                      options={[
                        { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                        { label: "UTC", value: "UTC" },
                        { label: "America/New_York (EST)", value: "America/New_York" },
                        { label: "Europe/London (GMT)", value: "Europe/London" },
                      ]}
                    />
                    <SettingSelect
                      label="Units"
                      value={settings.units}
                      onChange={(value) => updateSetting("units", value)}
                      options={[
                        { label: "Metric (kg, cm)", value: "metric" },
                        { label: "Imperial (lb, ft)", value: "imperial" },
                      ]}
                    />
                    <SettingSelect
                      label="Date format"
                      value={settings.date_format}
                      onChange={(value) => updateSetting("date_format", value)}
                      options={[
                        { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
                        { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
                      ]}
                    />
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-day-border/80 pt-4 dark:border-night-border/80">
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving || settingsLoading}
                    className="rounded-xl bg-gradient-to-r from-day-accent-primary to-day-accent-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,123,255,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 dark:from-night-accent dark:to-red-600 dark:shadow-[0_10px_24px_rgba(255,44,44,0.25)]"
                  >
                    {settingsSaving ? "Saving..." : "Save Settings"}
                  </button>
                  <button
                    onClick={() => setActiveSettings(null)}
                    className="rounded-xl border border-day-border px-4 py-2.5 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
                  >
                    Close
                  </button>
                  {settingsMessage ? (
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {settingsMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
