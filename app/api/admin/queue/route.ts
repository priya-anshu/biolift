import { NextRequest, NextResponse } from "next/server";
import {
  AdminAuthError,
  fetchAllProfiles,
  getAdminContext,
  resolveProfileIdentity,
} from "@/lib/admin/server";

type QueueStatus = "pending" | "approved" | "rejected";

type QueueRow = {
  id: string;
  user_id: string;
  target_table: "progress_entries" | "workouts";
  target_record_id: string;
  reason: string;
  status: QueueStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export async function GET() {
  try {
    const { adminClient } = await getAdminContext();
    const profiles = await fetchAllProfiles();
    const identities = await Promise.all(profiles.map((profile) => resolveProfileIdentity(profile)));
    const identityByProfileId = new Map(identities.map((item) => [item.id, item]));

    const { data, error } = await adminClient
      .from("ranking_edit_requests")
      .select(
        "id,user_id,target_table,target_record_id,reason,status,requested_at,reviewed_at,reviewed_by",
      )
      .order("requested_at", { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Queue table is not available. Run ranking queue SQL files first.",
        },
        { status: 400 },
      );
    }

    const rows = (data ?? []) as QueueRow[];
    const items = rows.map((row) => {
      const requester = identityByProfileId.get(row.user_id);
      const reviewer = row.reviewed_by
        ? identityByProfileId.get(row.reviewed_by)
        : null;

      return {
        ...row,
        requester: {
          name: requester?.name ?? null,
          email: requester?.email ?? null,
          avatarUrl: requester?.avatarUrl ?? null,
        },
        reviewer: {
          name: reviewer?.name ?? null,
          email: reviewer?.email ?? null,
        },
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load queue." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { adminClient, adminProfile } = await getAdminContext();
    const body = (await request.json()) as { id?: string; status?: QueueStatus };

    if (!body.id || !body.status || !["approved", "rejected"].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid payload. Expected id and status." },
        { status: 400 },
      );
    }

    const { error } = await adminClient
      .from("ranking_edit_requests")
      .update({
        status: body.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile.id,
      })
      .eq("id", body.id)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json(
        { error: `Failed to update request: ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update queue item." }, { status: 500 });
  }
}
