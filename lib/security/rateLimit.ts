import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitInput = {
  client: SupabaseClient;
  key: string;
  limit: number;
  windowSeconds: number;
};

export async function enforceRateLimit(input: RateLimitInput) {
  const { data, error } = await input.client.rpc("consume_rate_limit", {
    p_rate_key: input.key,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) {
    throw new Error(`Rate limiter failed: ${error.message}`);
  }
  if (data !== true) {
    throw new Error("Rate limit exceeded");
  }
}
