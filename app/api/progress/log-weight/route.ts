import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { logBodyWeightEntry } from "@/lib/workout-planner/service";

type Payload = {
  valueKg?: unknown;
  recordedAt?: unknown;
};

function parseWeight(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

export async function POST(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "progress-log-weight",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = (await request.json()) as Payload;
    const valueKg = parseWeight(payload.valueKg);
    const recordedAt =
      typeof payload.recordedAt === "string"
        ? payload.recordedAt
        : new Date().toISOString();

    const entry = await logBodyWeightEntry(
      { client: api.client, profileId: api.current.profileId },
      { valueKg, recordedAt },
    );
    return NextResponse.json({ entry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log body weight";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
