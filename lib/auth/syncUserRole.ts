import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const FALLBACK_ADMIN_EMAILS = new Set(["windows11arm64@gmail.com"]);

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function syncUserRoleAndProfile(user: User) {
  const adminClient = createSupabaseAdminClient();
  const emailKey = normalizeEmail(user.email);

  let role: "user" | "admin" = "user";

  const adminEmailCheck = await adminClient
    .from("admin_emails")
    .select("email")
    .ilike("email", emailKey)
    .maybeSingle();

  if (adminEmailCheck.data?.email || FALLBACK_ADMIN_EMAILS.has(emailKey)) {
    role = "admin";
  } else {
    const profileByEmail = await adminClient
      .from("profiles")
      .select("role")
      .ilike("email", emailKey)
      .maybeSingle();
    if ((profileByEmail.data?.role ?? "user") === "admin") {
      role = "admin";
    }
  }

  await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      role,
    },
  });

  const profilePayload = {
    auth_user_id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    avatar_url:
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null,
    role,
    updated_at: new Date().toISOString(),
  };

  const upsertResult = await adminClient
    .from("profiles")
    .upsert(profilePayload, { onConflict: "auth_user_id" });

  if (!upsertResult.error) {
    return role;
  }

  const existingByEmail = await adminClient
    .from("profiles")
    .select("id,auth_user_id")
    .ilike("email", emailKey)
    .maybeSingle();

  if (existingByEmail.error || !existingByEmail.data?.id) {
    throw upsertResult.error;
  }

  const fallbackPayload: {
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: "user" | "admin";
    updated_at: string;
    auth_user_id?: string;
  } = {
    email: profilePayload.email,
    name: profilePayload.name,
    avatar_url: profilePayload.avatar_url,
    role: profilePayload.role,
    updated_at: profilePayload.updated_at,
  };

  if (!existingByEmail.data.auth_user_id) {
    fallbackPayload.auth_user_id = user.id;
  }

  const updateByEmail = await adminClient
    .from("profiles")
    .update(fallbackPayload)
    .eq("id", existingByEmail.data.id);

  if (updateByEmail.error) {
    throw updateByEmail.error;
  }

  return role;
}
