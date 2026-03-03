import type { SupabaseClient, User } from "@supabase/supabase-js";

export type CurrentProfile = {
  authUser: User;
  profileId: string;
  email: string;
  role: string;
  preferredLanguage: "en" | "hi" | "bi";
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function resolveCurrentProfile(
  serverClient: SupabaseClient,
  adminClient: SupabaseClient,
): Promise<CurrentProfile> {
  const authRes = await serverClient.auth.getUser();
  const authUser = authRes.data.user;
  if (!authUser) {
    throw new Error("Unauthorized");
  }

  const authUserId = authUser.id;
  const email = normalizeEmail(authUser.email);
  if (!email) {
    throw new Error("Authenticated user email missing");
  }

  const byAuthUser = await adminClient
    .from("profiles")
    .select("id,email,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let profile =
    byAuthUser.error || !byAuthUser.data
      ? null
      : {
          id: byAuthUser.data.id as string,
          email: normalizeEmail(byAuthUser.data.email as string | null),
          role: (byAuthUser.data.role as string | null) ?? "user",
        };

  if (!profile) {
    const byEmail = await adminClient
      .from("profiles")
      .select("id,email,role")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail.error || !byEmail.data) {
      throw new Error("Profile row not found for current user");
    }
    profile = {
      id: byEmail.data.id as string,
      email: normalizeEmail(byEmail.data.email as string | null),
      role: (byEmail.data.role as string | null) ?? "user",
    };
  }

  await adminClient.from("users").upsert(
    {
      id: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const userSettingsRes = await adminClient
    .from("users")
    .select("preferred_language")
    .eq("id", profile.id)
    .maybeSingle();

  const preferredLanguageRaw = (userSettingsRes.data?.preferred_language ??
    "en") as string;
  const preferredLanguage: "en" | "hi" | "bi" =
    preferredLanguageRaw === "hi" || preferredLanguageRaw === "bi"
      ? preferredLanguageRaw
      : "en";

  return {
    authUser,
    profileId: profile.id,
    email: profile.email || email,
    role: profile.role,
    preferredLanguage,
  };
}
