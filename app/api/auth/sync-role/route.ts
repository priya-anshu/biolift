import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUserRoleAndProfile } from "@/lib/auth/syncUserRole";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return apiErrorResponse(new Error("Unauthorized"), "Unauthorized", {
      scope: "auth.sync-role",
    });
  }

  try {
    const role = await syncUserRoleAndProfile(user);
    return NextResponse.json({ role });
  } catch (error) {
    return apiErrorResponse(error, "Failed to sync profile role.", {
      scope: "auth.sync-role",
    });
  }
}
