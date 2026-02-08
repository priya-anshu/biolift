import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = new Set(["windows11arm64@gmail.com"]);

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

  const user = data.session.user;
  const adminClient = createSupabaseAdminClient();
  const role = ADMIN_EMAILS.has(user.email ?? "") ? "admin" : "user";

  await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      role,
    },
  });

  await adminClient.from("profiles").upsert(
    {
      auth_user_id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  );

  const destination = role === "admin" ? "/admin/dashboard" : next;
  return NextResponse.redirect(`${origin}${destination}`);
}
