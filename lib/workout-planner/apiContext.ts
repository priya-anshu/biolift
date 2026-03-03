import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCurrentProfile } from "@/lib/auth/currentProfile";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type ContextInput = {
  routeKey: string;
  limit: number;
  windowSeconds: number;
};

export async function getWorkoutPlannerApiContext(input: ContextInput) {
  const client = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const current = await resolveCurrentProfile(client, adminClient);

  await enforceRateLimit({
    client,
    key: `${current.profileId}:${input.routeKey}`,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  });

  return {
    client,
    adminClient,
    current,
  };
}
