import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const ADMIN_EMAILS = new Set(["windows11arm64@gmail.com"]);

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  let role = "user";

  try {
    const { data: adminRow } = await adminClient
      .from("admin_emails")
      .select("email")
      .eq("email", user.email ?? "")
      .maybeSingle();
    if (adminRow?.email) {
      role = "admin";
    } else if (ADMIN_EMAILS.has(user.email ?? "")) {
      role = "admin";
    }
  } catch {
    if (ADMIN_EMAILS.has(user.email ?? "")) {
      role = "admin";
    }
  }

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

  return NextResponse.json({ role });
}
