import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkerSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { processAiJobQueue } from "@/lib/workout-planner/workerQueue";

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

function parseLimit(request: NextRequest) {
  const parsed = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(300, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    ensureAuthorized(request);
    const adminClient = createSupabaseAdminClient();
    const summary = await processAiJobQueue(adminClient, {
      limit: parseLimit(request),
      workerId: "cron-ai-worker",
    });
    return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error, "Failed to run AI worker cron", {
      scope: "cron.ai-worker",
    });
  }
}
