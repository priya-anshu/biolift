import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import {
  AdminAuthError,
  dedupeProfilesByEmail,
  fetchAllProfiles,
  getAdminContext,
  resolveProfileIdentity,
} from "@/lib/admin/server";

type Role = "user" | "admin";

export async function GET() {
  try {
    await getAdminContext();
    const profiles = await fetchAllProfiles();
    const identities = await Promise.all(
      profiles.map((profile) => resolveProfileIdentity(profile)),
    );
    const users = dedupeProfilesByEmail(identities);
    return NextResponse.json({ users });
  } catch (error) {
    return apiErrorResponse(
      error instanceof AdminAuthError ? new Error(error.message) : error,
      "Failed to load users.",
      { scope: "admin.users.get" },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { adminClient } = await getAdminContext();
    const body = (await request.json()) as {
      profileIds?: string[];
      role?: Role;
    };

    if (
      !body.profileIds ||
      body.profileIds.length === 0 ||
      !body.role ||
      !["user", "admin"].includes(body.role)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid payload. Expected profileIds and role." },
        { status: 400 },
      );
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ role: body.role })
      .in("id", body.profileIds);

    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to update role: ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(
      error instanceof AdminAuthError ? new Error(error.message) : error,
      "Failed to update user role.",
      { scope: "admin.users.patch" },
    );
  }
}
