import { NextResponse } from "next/server";
import {
  AdminAuthError,
  dedupeProfilesByEmail,
  fetchAllProfiles,
  getAdminContext,
  resolveProfileIdentity,
} from "@/lib/admin/server";

type QueueRow = {
  id: string;
  user_id: string;
  target_table: "progress_entries" | "workouts";
  target_record_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function GET() {
  try {
    const { adminClient, adminProfile } = await getAdminContext();

    const rawProfiles = await fetchAllProfiles();
    const resolvedProfiles = await Promise.all(
      rawProfiles.map((profile) => resolveProfileIdentity(profile)),
    );
    const dedupedUsers = dedupeProfilesByEmail(resolvedProfiles);

    const profileIdentityById = new Map(
      resolvedProfiles.map((profile) => [profile.id, profile]),
    );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      workoutsTodayRes,
      progressTodayRes,
      workoutsCountRes,
      pendingCountRes,
      approved24hRes,
      recentRequestsRes,
    ] = await Promise.all([
      adminClient
        .from("workouts")
        .select("user_id")
        .gte("performed_at", startOfDay.toISOString()),
      adminClient
        .from("progress_entries")
        .select("user_id")
        .gte("recorded_at", startOfDay.toISOString()),
      adminClient.from("workouts").select("id", { count: "exact", head: true }),
      adminClient
        .from("ranking_edit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      adminClient
        .from("ranking_edit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .gte("reviewed_at", last24h.toISOString()),
      adminClient
        .from("ranking_edit_requests")
        .select(
          "id,user_id,target_table,target_record_id,reason,status,requested_at,reviewed_at,reviewed_by",
        )
        .order("requested_at", { ascending: false })
        .limit(10),
    ]);

    const activeTodaySet = new Set<string>();
    const addActiveKey = (profileId: string) => {
      const profile = profileIdentityById.get(profileId);
      const emailKey = normalizeEmail(profile?.email);
      activeTodaySet.add(emailKey || profileId);
    };
    (workoutsTodayRes.data ?? []).forEach((row) => addActiveKey(row.user_id));
    (progressTodayRes.data ?? []).forEach((row) => addActiveKey(row.user_id));

    const queueRows = (recentRequestsRes.data ?? []) as QueueRow[];
    const recentRequests = queueRows.map((row) => {
      const identity = profileIdentityById.get(row.user_id);
      return {
        ...row,
        requester: {
          name: identity?.name ?? null,
          email: identity?.email ?? null,
          avatarUrl: identity?.avatarUrl ?? null,
        },
      };
    });

    return NextResponse.json({
      admin: {
        name: adminProfile.name,
        email: adminProfile.email,
        avatarUrl: adminProfile.avatarUrl,
      },
      metrics: {
        totalUsers: dedupedUsers.length,
        activeToday: activeTodaySet.size,
        totalWorkouts: workoutsCountRes.count ?? 0,
        pendingCorrections: pendingCountRes.count ?? 0,
        approvedLast24h: approved24hRes.count ?? 0,
      },
      recentUsers: dedupedUsers.slice(0, 8),
      recentRequests,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to load admin overview." },
      { status: 500 },
    );
  }
}
