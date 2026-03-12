import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

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

const SETTINGS_COLUMNS =
  "two_factor_enabled,login_alerts,profile_visibility,data_sharing_analytics,notify_workout_reminders,notify_progress_milestones,notify_social_updates,notify_marketing,billing_plan,auto_renew,currency,language,timezone,units,date_format";

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

const MISSING_TABLE_CODES = new Set(["42P01", "42703"]);

function toErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "Unauthorized"
      ? 401
      : message === "Rate limit exceeded"
        ? 429
        : 400;
  return NextResponse.json({ error: message }, { status });
}

function normalizeSettings(input: unknown): ProfileSettings {
  if (!input || typeof input !== "object") return defaultProfileSettings;
  const row = input as Record<string, unknown>;
  const profileVisibility = String(
    row.profile_visibility ?? defaultProfileSettings.profile_visibility,
  ).toLowerCase();
  const billingPlan = String(row.billing_plan ?? defaultProfileSettings.billing_plan).toLowerCase();
  const currency = String(row.currency ?? defaultProfileSettings.currency).toUpperCase();
  const language = String(row.language ?? defaultProfileSettings.language).toLowerCase();
  const units = String(row.units ?? defaultProfileSettings.units).toLowerCase();
  const dateFormat = String(row.date_format ?? defaultProfileSettings.date_format).toUpperCase();

  return {
    two_factor_enabled: Boolean(
      row.two_factor_enabled ?? defaultProfileSettings.two_factor_enabled,
    ),
    login_alerts: Boolean(row.login_alerts ?? defaultProfileSettings.login_alerts),
    profile_visibility:
      profileVisibility === "friends" || profileVisibility === "public"
        ? profileVisibility
        : "private",
    data_sharing_analytics: Boolean(
      row.data_sharing_analytics ?? defaultProfileSettings.data_sharing_analytics,
    ),
    notify_workout_reminders: Boolean(
      row.notify_workout_reminders ?? defaultProfileSettings.notify_workout_reminders,
    ),
    notify_progress_milestones: Boolean(
      row.notify_progress_milestones ?? defaultProfileSettings.notify_progress_milestones,
    ),
    notify_social_updates: Boolean(
      row.notify_social_updates ?? defaultProfileSettings.notify_social_updates,
    ),
    notify_marketing: Boolean(
      row.notify_marketing ?? defaultProfileSettings.notify_marketing,
    ),
    billing_plan:
      billingPlan === "premium" || billingPlan === "elite" ? billingPlan : "free",
    auto_renew: Boolean(row.auto_renew ?? defaultProfileSettings.auto_renew),
    currency:
      currency === "EUR" || currency === "INR" ? currency : defaultProfileSettings.currency,
    language:
      language === "es" || language === "hi" ? language : defaultProfileSettings.language,
    timezone:
      typeof row.timezone === "string" && row.timezone.trim().length > 0
        ? row.timezone.trim()
        : defaultProfileSettings.timezone,
    units: units === "imperial" ? "imperial" : "metric",
    date_format: dateFormat === "MM/DD/YYYY" ? "MM/DD/YYYY" : "DD/MM/YYYY",
  };
}

async function loadProfileOverview(context: Awaited<ReturnType<typeof getWorkoutPlannerApiContext>>) {
  const profileRes = await context.client
    .from("profiles")
    .select("id,name,email,avatar_url,created_at")
    .eq("id", context.current.profileId)
    .maybeSingle();
  if (profileRes.error) throw new Error(profileRes.error.message);

  let settings: ProfileSettings = defaultProfileSettings;
  let settingsAvailable = true;
  const settingsRes = await context.client
    .from("profile_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", context.current.profileId)
    .maybeSingle();
  if (settingsRes.error) {
    if (MISSING_TABLE_CODES.has(settingsRes.error.code ?? "")) {
      settingsAvailable = false;
    } else {
      throw new Error(settingsRes.error.message);
    }
  } else {
    settings = normalizeSettings(settingsRes.data);
  }

  const [completedWorkoutsRes, activeDaysRes, achievementsRes, streakRes, leaderboardRes] =
    await Promise.all([
      context.client
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.current.profileId)
        .eq("status", "completed"),
      context.client
        .from("calendar_status")
        .select("status_date", { count: "exact", head: true })
        .eq("user_id", context.current.profileId)
        .eq("status", "completed"),
      context.client
        .from("personal_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.current.profileId),
      context.client
        .from("user_training_stats")
        .select("streak_days")
        .eq("user_id", context.current.profileId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.client
        .from("leaderboard")
        .select("tier,total_score")
        .eq("user_id", context.current.profileId)
        .maybeSingle(),
    ]);

  if (completedWorkoutsRes.error) throw new Error(completedWorkoutsRes.error.message);
  if (activeDaysRes.error) throw new Error(activeDaysRes.error.message);
  if (achievementsRes.error) throw new Error(achievementsRes.error.message);
  if (streakRes.error && !MISSING_TABLE_CODES.has(streakRes.error.code ?? "")) {
    throw new Error(streakRes.error.message);
  }
  if (leaderboardRes.error) throw new Error(leaderboardRes.error.message);

  const profile = {
    id: context.current.profileId,
    name:
      profileRes.data?.name ??
      (context.current.authUser.user_metadata?.name as string | undefined) ??
      (context.current.authUser.user_metadata?.full_name as string | undefined) ??
      context.current.email,
    email: profileRes.data?.email ?? context.current.email,
    avatar_url:
      profileRes.data?.avatar_url ??
      (context.current.authUser.user_metadata?.avatar_url as string | undefined) ??
      null,
    rank: leaderboardRes.data?.tier ?? "Rookie",
    membership: settings.billing_plan,
    level: "beginner",
    points: Number(leaderboardRes.data?.total_score ?? 0),
  };

  return {
    profile,
    settings,
    settingsAvailable,
    stats: {
      workoutsCompleted: completedWorkoutsRes.count ?? 0,
      daysActive: activeDaysRes.count ?? 0,
      achievements: achievementsRes.count ?? 0,
      currentStreak: Number(streakRes.data?.streak_days ?? 0),
    },
  };
}

export async function GET() {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "profile-overview",
      limit: 120,
      windowSeconds: 60,
    });
    const data = await loadProfileOverview(context);
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error, "Failed to load profile overview");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getWorkoutPlannerApiContext({
      routeKey: "profile-overview-update",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as {
      name?: unknown;
      settings?: unknown;
    };

    if (typeof payload.name === "string" && payload.name.trim().length > 0) {
      const profileUpdate = await context.client
        .from("profiles")
        .update({
          name: payload.name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", context.current.profileId);
      if (profileUpdate.error) {
        throw new Error(profileUpdate.error.message);
      }
    }

    if (payload.settings !== undefined) {
      const settings = normalizeSettings(payload.settings);
      const upsertRes = await context.client.from("profile_settings").upsert(
        {
          user_id: context.current.profileId,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (upsertRes.error && !MISSING_TABLE_CODES.has(upsertRes.error.code ?? "")) {
        throw new Error(upsertRes.error.message);
      }
    }

    const data = await loadProfileOverview(context);
    return NextResponse.json(data);
  } catch (error) {
    return toErrorResponse(error, "Failed to update profile settings");
  }
}
