import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkerSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { processAiJobQueue } from "@/lib/workout-planner/workerQueue";

function extractSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const headerSecret = request.headers.get("x-worker-secret");
  if (headerSecret && headerSecret.trim().length > 0) {
    return headerSecret.trim();
  }
  return "";
}

function ensureAuthorized(request: NextRequest) {
  const expectedSecret = getWorkerSecret();
  if (extractSecret(request) !== expectedSecret) {
    throw new Error("Unauthorized");
  }
}

function parseLimit(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  if (!Number.isFinite(raw)) return 20;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

async function handleProcess(request: NextRequest) {
  ensureAuthorized(request);
  const adminClient = createSupabaseAdminClient();
  const limit = parseLimit(request);
  const summary = await processAiJobQueue(adminClient, {
    limit,
    workerId: "internal-api-worker",
  });
  return NextResponse.json({ summary });
}

export async function GET(request: NextRequest) {
  try {
    return await handleProcess(request);
  } catch (error) {
    return apiErrorResponse(error, "Failed to process AI queue", {
      scope: "internal.ai-worker.process.get",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleProcess(request);
  } catch (error) {
    return apiErrorResponse(error, "Failed to process AI queue", {
      scope: "internal.ai-worker.process.post",
    });
  }
}
