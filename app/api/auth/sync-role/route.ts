import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUserRoleAndProfile } from "@/lib/auth/syncUserRole";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = await syncUserRoleAndProfile(user);
    return NextResponse.json({ role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync profile role.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
