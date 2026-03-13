import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/env";

const supabaseEnv = getSupabaseBrowserEnv();

export const supabase = createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey, {
  auth: { flowType: "pkce" },
});
