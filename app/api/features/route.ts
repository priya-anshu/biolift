import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { AdminAuthError, getAdminContext } from "@/lib/admin/server";
import {
  defaultFeatureFlags,
  getFeatureFlags,
  isFeatureFlagName,
} from "@/lib/features";

export async function GET() {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load feature flags.", {
      scope: "features.get",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminClient } = await getAdminContext();
    const payload = (await request.json()) as {
      name?: unknown;
      enabled?: unknown;
      beta?: unknown;
    };

    const name =
      typeof payload.name === "string" ? payload.name.trim().toLowerCase() : "";
    if (!isFeatureFlagName(name)) {
      return NextResponse.json(
        { success: false, error: "Invalid feature flag name." },
        { status: 400 },
      );
    }

    if (typeof payload.enabled !== "boolean" && typeof payload.beta !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload. Expected enabled and/or beta boolean values.",
        },
        { status: 400 },
      );
    }

    const currentFlags = await getFeatureFlags();
    const currentFlag = currentFlags[name] ?? defaultFeatureFlags[name];

    const { error } = await adminClient.from("feature_flags").upsert(
      {
        name,
        enabled:
          typeof payload.enabled === "boolean" ? payload.enabled : currentFlag.enabled,
        beta: typeof payload.beta === "boolean" ? payload.beta : currentFlag.beta,
      },
      { onConflict: "name" },
    );

    if (error) {
      throw new Error(error.message);
    }

    const flags = await getFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return apiErrorResponse(
      error instanceof AdminAuthError ? new Error(error.message) : error,
      "Failed to update feature flag.",
      { scope: "features.post" },
    );
  }
}
