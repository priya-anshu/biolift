import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const defaultFeatureFlags = {
  social: { enabled: false, beta: true },
  shop: { enabled: false, beta: false },
} as const;

export type FeatureFlagName = keyof typeof defaultFeatureFlags;
export type FeatureFlags = {
  [K in FeatureFlagName]: {
    enabled: boolean;
    beta: boolean;
  };
};

const featureFlagNames = Object.keys(defaultFeatureFlags) as FeatureFlagName[];
const MISSING_TABLE_CODES = new Set(["42P01"]);

function cloneDefaultFeatureFlags(): FeatureFlags {
  return {
    social: { ...defaultFeatureFlags.social },
    shop: { ...defaultFeatureFlags.shop },
  };
}

export function isFeatureFlagName(value: string): value is FeatureFlagName {
  return featureFlagNames.includes(value as FeatureFlagName);
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("feature_flags")
    .select("name,enabled,beta");

  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? "")) {
      return cloneDefaultFeatureFlags();
    }
    throw new Error(error.message);
  }

  const flags = cloneDefaultFeatureFlags();
  for (const row of data ?? []) {
    const name = typeof row.name === "string" ? row.name.trim().toLowerCase() : "";
    if (!isFeatureFlagName(name)) continue;
    flags[name] = {
      enabled: Boolean(row.enabled),
      beta: Boolean(row.beta),
    };
  }

  return flags;
}
