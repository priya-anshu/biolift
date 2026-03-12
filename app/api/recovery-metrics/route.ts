import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { enqueueAiJob } from "@/lib/workout-planner/workerQueue";

type RecoveryPayload = {
  metricDate?: unknown;
  sleepDurationMinutes?: unknown;
  sleepQuality?: unknown;
  sorenessLevel?: unknown;
  stressLevel?: unknown;
  energyLevel?: unknown;
  readinessScore?: unknown;
  fatigueScore?: unknown;
  restingHeartRate?: unknown;
  hrvRmssd?: unknown;
  stepCount?: unknown;
  hydrationLiters?: unknown;
  source?: unknown;
  notes?: unknown;
};

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseMetricDate(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return todayDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("metricDate must be YYYY-MM-DD");
  }
  return raw;
}

function parseSource(value: unknown) {
  const normalized = String(value ?? "manual").trim().toLowerCase();
  if (
    normalized === "wearable" ||
    normalized === "ai_inferred" ||
    normalized === "coach"
  ) {
    return normalized;
  }
  return "manual";
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "recovery-metrics-list",
      limit: 120,
      windowSeconds: 60,
    });
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 14);
    const limit = Math.max(1, Math.min(60, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 14));
    const rowsRes = await api.client
      .from("recovery_metrics")
      .select(
        "id,metric_date,sleep_duration_minutes,sleep_quality,soreness_level,stress_level,energy_level,readiness_score,fatigue_score,resting_heart_rate,hrv_rmssd,step_count,hydration_liters,source,notes,created_at,updated_at",
      )
      .eq("user_id", api.current.profileId)
      .order("metric_date", { ascending: false })
      .limit(limit);
    if (rowsRes.error) {
      throw new Error(rowsRes.error.message);
    }
    return NextResponse.json({ items: rowsRes.data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recovery metrics";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "recovery-metrics-upsert",
      limit: 120,
      windowSeconds: 60,
    });

    const payload = (await request.json()) as RecoveryPayload;
    const metricDate = parseMetricDate(payload.metricDate);

    const upsertRes = await api.client
      .from("recovery_metrics")
      .upsert(
        {
          user_id: api.current.profileId,
          metric_date: metricDate,
          sleep_duration_minutes: parseNumber(payload.sleepDurationMinutes),
          sleep_quality: parseNumber(payload.sleepQuality),
          soreness_level: parseNumber(payload.sorenessLevel) ?? 0,
          stress_level: parseNumber(payload.stressLevel) ?? 0,
          energy_level: parseNumber(payload.energyLevel),
          readiness_score: parseNumber(payload.readinessScore),
          fatigue_score: parseNumber(payload.fatigueScore),
          resting_heart_rate: parseNumber(payload.restingHeartRate),
          hrv_rmssd: parseNumber(payload.hrvRmssd),
          step_count: parseNumber(payload.stepCount),
          hydration_liters: parseNumber(payload.hydrationLiters),
          source: parseSource(payload.source),
          notes:
            typeof payload.notes === "string" && payload.notes.trim().length > 0
              ? payload.notes.trim()
              : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,metric_date" },
      )
      .select(
        "id,metric_date,sleep_duration_minutes,sleep_quality,soreness_level,stress_level,energy_level,readiness_score,fatigue_score,resting_heart_rate,hrv_rmssd,step_count,hydration_liters,source,notes,created_at,updated_at",
      )
      .single();
    if (upsertRes.error) {
      throw new Error(upsertRes.error.message);
    }

    void enqueueAiJob(api.adminClient, {
      userId: api.current.profileId,
      jobType: "recovery_updated",
      payload: {
        workoutDate: metricDate,
        lookbackDays: 42,
      },
      dedupeKey: `recovery_updated:${api.current.profileId}:${metricDate}`,
    }).catch(() => {});

    return NextResponse.json({ item: upsertRes.data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update recovery metrics";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
