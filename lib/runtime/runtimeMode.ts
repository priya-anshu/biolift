// LEGACY: synchronous hobby-mode AI execution is deprecated. Production routes enqueue workers.
export function isHobbyMode() {
  const plan = String(process.env.VERCEL_PLAN ?? "").trim().toLowerCase();
  if (plan.length > 0) {
    return plan !== "pro";
  }

  const onVercel =
    process.env.VERCEL === "1" ||
    (typeof process.env.VERCEL_ENV === "string" &&
      process.env.VERCEL_ENV.trim().length > 0);

  return onVercel;
}
