import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncUserRoleAndProfile } from "@/lib/auth/syncUserRole";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session?.user) {
    return NextResponse.redirect(`${origin}/signin?error=oauth_failed`);
  }

  try {
    const role = await syncUserRoleAndProfile(data.session.user);
    const destination = role === "admin" ? "/admin/dashboard" : next;
    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(`${origin}/signin?error=oauth_sync_failed`);
  }
}
