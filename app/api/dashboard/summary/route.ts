import { NextRequest, NextResponse } from "next/server";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getDashboardSummary } from "@/lib/workout-planner/service";

function parseDays(value: string | null) {
  if (!value) return 7;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(1, Math.min(60, Math.floor(parsed)));
}

function parseLimit(value: string | null) {
  if (!value) return 6;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "dashboard-summary",
      limit: 120,
      windowSeconds: 60,
    });

    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const recentLimit = parseLimit(request.nextUrl.searchParams.get("recentLimit"));
    const summary = await getDashboardSummary(
      { client: api.client, profileId: api.current.profileId },
      { days, recentLimit },
    );
    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard summary";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Rate limit exceeded"
          ? 429
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
