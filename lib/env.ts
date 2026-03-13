type RequiredEnvOptions = {
  aliases?: string[];
  publicOnly?: boolean;
};

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function resolveEnv(name: string, options?: RequiredEnvOptions) {
  const primary = readEnv(name);
  if (primary) {
    return primary;
  }

  for (const alias of options?.aliases ?? []) {
    const value = readEnv(alias);
    if (value) {
      return value;
    }
  }

  const acceptedNames = [name, ...(options?.aliases ?? [])].join(", ");
  const scopeHint = options?.publicOnly
    ? "Client-side Supabase access requires a NEXT_PUBLIC_* value."
    : "Add the missing variable to the deployment environment.";
  throw new Error(`Missing required environment variable: ${acceptedNames}. ${scopeHint}`);
}

export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    "";

  if (!url) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. Client-side Supabase access requires a NEXT_PUBLIC_* value.",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY. Client-side Supabase access requires a NEXT_PUBLIC_* value.",
    );
  }

  return {
    url,
    anonKey,
  };
}

export function getSupabaseServerEnv() {
  return {
    url: resolveEnv("NEXT_PUBLIC_SUPABASE_URL", {
      aliases: ["SUPABASE_URL"],
    }),
    anonKey: resolveEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", {
      aliases: ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
    }),
    serviceRoleKey: resolveEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getWorkerSecret() {
  return resolveEnv("AI_WORKER_SECRET", {
    aliases: ["CRON_SECRET"],
  });
}
