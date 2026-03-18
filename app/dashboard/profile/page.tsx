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
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";

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

type SettingsKey = "privacy" | "notifications" | "billing" | "language";

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
  {
    name: "Streak Master",
    description: "7 day workout streak",
    date: "2 days ago",
    icon: Award,
  },
  {
    name: "Goal Crusher",
    description: "Hit 3 monthly goals",
    date: "1 week ago",
    icon: Target,
  },
  {
    name: "Energy Boost",
    description: "Burned 2000+ calories",
    date: "2 weeks ago",
    icon: Award,
  },
];

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
    <label className="flex items-center justify-between rounded-lg border border-day-border dark:border-night-border px-4 py-3">
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
      <span className="block text-sm font-medium text-day-text-secondary dark:text-night-text-secondary mb-2">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-day-border bg-day-card dark:bg-night-card px-4 py-3 text-day-text-primary dark:text-night-text-primary focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:focus:ring-night-accent"
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
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSettings, setActiveSettings] = useState<SettingsKey | null>(null);
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
    { key: "privacy" as const, label: "Privacy & Security", icon: Shield },
    { key: "notifications" as const, label: "Notifications", icon: Bell },
    { key: "billing" as const, label: "Billing & Payment", icon: CreditCard },
    { key: "language" as const, label: "Language & Region", icon: Globe },
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
        setProfile(payload.profile);
        setSettings({ ...defaultProfileSettings, ...payload.settings });
        setProfileStats(payload.stats);
        setEditData((prev) => ({
          ...prev,
          name: payload.profile.name ?? "",
          email: payload.profile.email ?? "",
        }));
        if (!payload.settingsAvailable) {
          setSettingsMessage("Settings table is not ready yet. Run profile_settings SQL first.");
        }
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

  const activeSettingsLabel =
    settingsCards.find((item) => item.key === activeSettings)?.label ?? "";

  const renderProfileLayout = () => (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary mb-2">
          Profile
        </h1>
        <p className="text-day-text-secondary dark:text-night-text-secondary">
          Manage your account and preferences
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <div className="relative">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile?.name ?? "Profile avatar"}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-day-border dark:bg-night-border flex items-center justify-center text-2xl font-semibold text-day-text-secondary dark:text-night-text-secondary">
                  {initials}
                </div>
              )}
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-day-accent-primary dark:bg-night-accent rounded-full flex items-center justify-center text-white hover:bg-day-accent-primary/80 dark:hover:bg-night-accent/80 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {profile?.name ?? "Member"}
                </h2>
                <Badge variant="primary">{profile?.rank ?? "Rookie"}</Badge>
                {profile?.membership === "premium" ? (
                  <Crown className="w-5 h-5 text-yellow-500" />
                ) : null}
              </div>

              <p className="text-day-text-secondary dark:text-night-text-secondary mb-3">
                {editData.bio}
              </p>

              <div className="flex items-center space-x-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined 2024</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Target className="w-4 h-4" />
                  <span>{profile?.level ?? "Beginner"} level</span>
                </div>
              </div>
            </div>

            <Button variant="ghost" onClick={() => setIsEditing((prev) => !prev)}>
              <Edit className="w-4 h-4 mr-2" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4 text-center">
              <Icon className="w-6 h-6 text-day-accent-primary dark:text-night-accent mx-auto mb-2" />
              <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                {stat.label}
              </div>
            </Card>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Personal Information
              </h3>
            </div>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Full Name
                  </label>
                  <input
                    value={editData.name}
                    onChange={(event) =>
                      setEditData((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="input-field mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(event) =>
                      setEditData((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="input-field mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Bio
                  </label>
                  <input
                    value={editData.bio}
                    onChange={(event) =>
                      setEditData((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    className="input-field mt-2"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button variant="primary" onClick={handleSave}>
                    Save Changes
                  </Button>
                  <Button variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Full Name
                  </label>
                  <p className="text-day-text-primary dark:text-night-text-primary">
                    {profile?.name ?? "Member"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Email
                  </label>
                  <p className="text-day-text-primary dark:text-night-text-primary">
                    {profile?.email ?? "member@biolift.com"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-day-text-secondary dark:text-night-text-secondary">
                    Bio
                  </label>
                  <p className="text-day-text-primary dark:text-night-text-primary">
                    {editData.bio}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                Membership
              </h3>
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="space-y-4">
              {membershipTiers.map((tier) => {
                const current = tier.name.toLowerCase() === profile?.membership;
                return (
                  <div
                    key={tier.name}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      current
                        ? "border-day-accent-primary dark:border-night-accent bg-day-accent-primary/5 dark:bg-night-accent/5"
                        : "border-day-border dark:border-night-border hover:border-day-accent-primary/50 dark:hover:border-night-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-day-text-primary dark:text-night-text-primary">
                        {tier.name}
                      </h4>
                      <div className="text-right">
                        <div className="font-bold text-day-text-primary dark:text-night-text-primary">
                          {tier.price}
                        </div>
                        {current ? (
                          <Badge variant="primary" size="sm">
                            Current
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <ul className="space-y-1 mb-3">
                      {tier.features.map((feature) => (
                        <li
                          key={feature}
                          className="text-sm text-day-text-secondary dark:text-night-text-secondary flex items-center"
                        >
                          <div className="w-1 h-1 bg-day-accent-primary dark:bg-night-accent rounded-full mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {!current ? (
                      <Button variant="primary" size="sm" fullWidth>
                        Upgrade
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
              Recent Achievements
            </h3>
          </div>
          <div className="space-y-4">
            {recentAchievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.name}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-day-hover dark:hover:bg-night-hover transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-day-text-primary dark:text-night-text-primary">
                      {achievement.name}
                    </h4>
                    <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                      {achievement.description}
                    </p>
                  </div>
                  <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
                    {achievement.date}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
              Settings
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsCards.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  className="justify-start h-12"
                  onClick={() => setActiveSettings(item.key)}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <AnimatePresence>
        {activeSettings ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveSettings(null)}
          >
            <div
              className="bg-white dark:bg-black rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-black border-b border-day-border dark:border-night-border p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-day-text-primary dark:text-night-text-primary">
                  {activeSettingsLabel}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveSettings(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {settingsLoading ? (
                  <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
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

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving || settingsLoading}
                  >
                    {settingsSaving ? "Saving..." : "Save Settings"}
                  </Button>
                  <Button variant="ghost" onClick={() => setActiveSettings(null)}>
                    Close
                  </Button>
                  {settingsMessage ? (
                    <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {settingsMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      <div className="hidden md:block">{renderProfileLayout()}</div>
      <div className="block md:hidden">{renderProfileLayout()}</div>
    </>
  );
}
