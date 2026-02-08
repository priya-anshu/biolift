"use client";

import { motion } from "framer-motion";
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
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

type Profile = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  rank: string | null;
  membership: string | null;
  level: string | null;
  points: number | null;
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

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSettings, setActiveSettings] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    bio: "Fitness enthusiast passionate about health and wellness",
  });

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name,email,avatar_url,rank,membership,level,points")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const profileData = {
        name: data?.name ?? user.user_metadata?.name ?? user.user_metadata?.full_name ?? "",
        email: data?.email ?? user.email ?? "",
        avatar_url: data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        rank: data?.rank ?? "Rookie",
        membership: data?.membership ?? "free",
        level: data?.level ?? "beginner",
        points: data?.points ?? 0,
      };
      setProfile(profileData);
      setEditData((prev) => ({
        ...prev,
        name: profileData.name ?? "",
        email: profileData.email ?? "",
      }));
    };
    loadProfile();
  }, [user]);

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
    { label: "Workouts Completed", value: "127", icon: Target },
    { label: "Days Active", value: "45", icon: Calendar },
    { label: "Achievements", value: "23", icon: Award },
    { label: "Current Streak", value: "7", icon: Award },
  ];

  const handleSave = () => {
    setIsEditing(false);
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
                <img
                  src={profile.avatar_url}
                  alt={profile.name ?? "Avatar"}
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

          <button
            className="inline-flex items-center gap-2 rounded-full border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            <Edit className="h-4 w-4" />
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
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
          {[
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
          ].map((item) => {
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

        {activeSettings ? (
          <div className="mt-6 rounded-2xl border border-day-border bg-day-hover p-4 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover dark:text-night-text-secondary">
            {activeSettings === "privacy" && (
              <div className="space-y-2">
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  Privacy & Security
                </div>
                <ul className="list-disc pl-5">
                  <li>Password & login controls</li>
                  <li>Two-factor authentication</li>
                  <li>Manage connected devices</li>
                </ul>
              </div>
            )}
            {activeSettings === "notifications" && (
              <div className="space-y-2">
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  Notifications
                </div>
                <ul className="list-disc pl-5">
                  <li>Workout reminders</li>
                  <li>Progress milestones</li>
                  <li>Community updates</li>
                </ul>
              </div>
            )}
            {activeSettings === "billing" && (
              <div className="space-y-2">
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  Billing & Payment
                </div>
                <ul className="list-disc pl-5">
                  <li>Manage plan and renewals</li>
                  <li>Payment methods</li>
                  <li>Invoices and receipts</li>
                </ul>
              </div>
            )}
            {activeSettings === "language" && (
              <div className="space-y-2">
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  Language & Region
                </div>
                <ul className="list-disc pl-5">
                  <li>App language</li>
                  <li>Timezone & date format</li>
                  <li>Metric vs. imperial units</li>
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
