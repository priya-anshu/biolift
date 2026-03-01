import type { User } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type RawProfile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
  auth_user_id?: string | null;
};

export type ProfileIdentity = {
  id: string;
  authUserId: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
  createdAt: string | null;
};

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function fetchAllProfiles() {
  const adminClient = createSupabaseAdminClient();

  const withAuthUser = await adminClient
    .from("profiles")
    .select("id,email,name,avatar_url,role,created_at,auth_user_id")
    .order("created_at", { ascending: false });

  if (!withAuthUser.error) {
    return (withAuthUser.data ?? []) as RawProfile[];
  }

  const withoutAuthUser = await adminClient
    .from("profiles")
    .select("id,email,name,avatar_url,role,created_at")
    .order("created_at", { ascending: false });

  return ((withoutAuthUser.data ?? []) as RawProfile[]).map((row) => ({
    ...row,
    auth_user_id: null,
  }));
}

export async function resolveProfileIdentity(profile: RawProfile): Promise<ProfileIdentity> {
  const adminClient = createSupabaseAdminClient();
  const authUserId = profile.auth_user_id ?? profile.id;
  let email = profile.email;
  let name = profile.name;
  let avatarUrl = profile.avatar_url;

  if ((!email || !name || !avatarUrl) && authUserId) {
    const { data } = await adminClient.auth.admin.getUserById(authUserId);
    const authUser = data?.user;
    if (authUser) {
      email = email ?? authUser.email ?? null;
      name =
        name ??
        (authUser.user_metadata?.name as string | undefined) ??
        (authUser.user_metadata?.full_name as string | undefined) ??
        null;
      avatarUrl =
        avatarUrl ??
        (authUser.user_metadata?.avatar_url as string | undefined) ??
        (authUser.user_metadata?.picture as string | undefined) ??
        null;
    }
  }

  return {
    id: profile.id,
    authUserId: profile.auth_user_id ?? null,
    email,
    name,
    avatarUrl,
    role: profile.role ?? "user",
    createdAt: profile.created_at ?? null,
  };
}

export async function getAdminContext() {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: authData } = await serverClient.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    throw new AdminAuthError("Unauthorized", 401);
  }

  const emailKey = normalizeEmail(authUser.email);
  const adminEmailRow = await adminClient
    .from("admin_emails")
    .select("email")
    .ilike("email", emailKey)
    .maybeSingle();

  const byAuthUser = await adminClient
    .from("profiles")
    .select("id,email,name,avatar_url,role,created_at,auth_user_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  let profileRow = byAuthUser.error ? null : (byAuthUser.data as RawProfile | null);
  if (!profileRow) {
    const byId = await adminClient
      .from("profiles")
      .select("id,email,name,avatar_url,role,created_at")
      .eq("id", authUser.id)
      .maybeSingle();
    if (!byId.error && byId.data) {
      profileRow = {
        ...(byId.data as RawProfile),
        auth_user_id: null,
      };
    }
  }

  const isAdminByEmail = !!adminEmailRow.data?.email;
  const isAdminByRole = (profileRow?.role ?? "user") === "admin";
  if (!isAdminByEmail && !isAdminByRole) {
    throw new AdminAuthError("Forbidden", 403);
  }

  const profileIdentity = profileRow
    ? await resolveProfileIdentity(profileRow)
    : {
        id: authUser.id,
        authUserId: authUser.id,
        email: authUser.email ?? null,
        name:
          (authUser.user_metadata?.name as string | undefined) ??
          (authUser.user_metadata?.full_name as string | undefined) ??
          "Admin",
        avatarUrl:
          (authUser.user_metadata?.avatar_url as string | undefined) ??
          (authUser.user_metadata?.picture as string | undefined) ??
          null,
        role: "admin",
        createdAt: null,
      };

  const authName =
    (authUser.user_metadata?.name as string | undefined) ??
    (authUser.user_metadata?.full_name as string | undefined) ??
    null;
  const authAvatar =
    (authUser.user_metadata?.avatar_url as string | undefined) ??
    (authUser.user_metadata?.picture as string | undefined) ??
    null;

  const mergedAdminProfile: ProfileIdentity = {
    ...profileIdentity,
    authUserId: profileIdentity.authUserId ?? authUser.id,
    email: profileIdentity.email ?? authUser.email ?? null,
    name: profileIdentity.name ?? authName,
    avatarUrl: profileIdentity.avatarUrl ?? authAvatar,
    role: profileIdentity.role ?? "admin",
  };

  return {
    adminClient,
    authUser,
    adminProfile: mergedAdminProfile,
  };
}

export function dedupeProfilesByEmail(profiles: ProfileIdentity[]) {
  const map = new Map<
    string,
    {
      key: string;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
      role: string | null;
      createdAt: string | null;
      profileIds: string[];
      authUserIds: string[];
    }
  >();

  profiles.forEach((profile) => {
    const key = normalizeEmail(profile.email) || `id:${profile.id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        createdAt: profile.createdAt,
        profileIds: [profile.id],
        authUserIds: profile.authUserId ? [profile.authUserId] : [],
      });
      return;
    }

    existing.profileIds.push(profile.id);
    if (profile.authUserId) {
      existing.authUserIds.push(profile.authUserId);
    }

    const existingDate = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
    const candidateDate = profile.createdAt ? new Date(profile.createdAt).getTime() : 0;
    if (candidateDate >= existingDate) {
      existing.email = profile.email ?? existing.email;
      existing.name = profile.name ?? existing.name;
      existing.avatarUrl = profile.avatarUrl ?? existing.avatarUrl;
      existing.role = profile.role ?? existing.role;
      existing.createdAt = profile.createdAt ?? existing.createdAt;
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export type AdminSession = {
  adminUser: User;
  adminProfile: ProfileIdentity;
};
