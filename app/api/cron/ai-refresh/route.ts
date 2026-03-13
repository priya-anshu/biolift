import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkerSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  enqueueDailyRefreshForActiveUsers,
  processAiJobQueue,
} from "@/lib/workout-planner/workerQueue";

function extractBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function ensureAuthorized(request: NextRequest) {
  const secret = getWorkerSecret();
  if (extractBearerToken(request) !== secret) {
    throw new Error("Unauthorized");
  }
}

function parseWorkoutDate(request: NextRequest) {
  const raw = String(request.nextUrl.searchParams.get("workoutDate") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    ensureAuthorized(request);
    const adminClient = createSupabaseAdminClient();
    const workoutDate = parseWorkoutDate(request);

    const enqueueSummary = await enqueueDailyRefreshForActiveUsers(adminClient, {
      workoutDate,
    });

    const processSummary = await processAiJobQueue(adminClient, {
      limit: 200,
      workerId: "cron-daily-refresh",
    });

    return NextResponse.json({
      workoutDate,
      enqueueSummary,
      processSummary,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to run daily AI refresh", {
      scope: "cron.ai-refresh",
    });
  }
}
