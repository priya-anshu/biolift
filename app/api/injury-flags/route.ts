import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";

type InjuryPayload = {
  bodyRegion?: unknown;
  painLevel?: unknown;
  severity?: unknown;
  injuryType?: unknown;
  notes?: unknown;
};

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

function toInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return fallback;
}

function parsePayload(payload: InjuryPayload) {
  const bodyRegion = String(payload.bodyRegion ?? "").trim();
  if (!bodyRegion) {
    throw new Error("bodyRegion is required");
  }
  const painLevel = Math.max(0, Math.min(10, toInt(payload.painLevel, 0)));
  const severity = Math.max(1, Math.min(5, toInt(payload.severity, 1)));
  const injuryTypeRaw = String(payload.injuryType ?? "other").trim().toLowerCase();
  const allowedTypes = new Set([
    "acute_pain",
    "strain",
    "sprain",
    "joint_irritation",
    "overuse",
    "post_surgery",
    "other",
  ]);
  const injuryType = allowedTypes.has(injuryTypeRaw) ? injuryTypeRaw : "other";
  const notes =
    typeof payload.notes === "string" && payload.notes.trim().length > 0
      ? payload.notes.trim()
      : null;
  return {
    bodyRegion,
    painLevel,
    severity,
    injuryType,
    notes,
  };
}

export async function GET() {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "injury-flags-list",
      limit: 120,
      windowSeconds: 60,
    });

    const result = await api.client
      .from("injury_flags")
      .select(
        "id,flagged_on,body_region,injury_type,severity,pain_level,status,notes,created_at,updated_at",
      )
      .eq("user_id", api.current.profileId)
      .in("status", ["active", "monitoring", "recovering"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (result.error) throw new Error(result.error.message);

    return NextResponse.json({ items: result.data ?? [] });
  } catch (error) {
    return toErrorResponse(error, "Failed to load injury flags");
  }
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "injury-flags-create",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = parsePayload((await request.json()) as InjuryPayload);

    const insertRes = await api.client
      .from("injury_flags")
      .insert({
        user_id: api.current.profileId,
        flagged_on: new Date().toISOString().slice(0, 10),
        body_region: payload.bodyRegion,
        injury_type: payload.injuryType,
        severity: payload.severity,
        pain_level: payload.painLevel,
        status: "active",
        created_by: "user",
        notes: payload.notes,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id,flagged_on,body_region,injury_type,severity,pain_level,status,notes,created_at,updated_at",
      )
      .single();
    if (insertRes.error) throw new Error(insertRes.error.message);

    return NextResponse.json({ item: insertRes.data });
  } catch (error) {
    return toErrorResponse(error, "Failed to create injury flag");
  }
}
