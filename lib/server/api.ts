import { NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";

const BAD_REQUEST_PATTERNS = [
  "required",
  "invalid",
  "must be",
  "failed to parse",
  "not available",
];

function inferStatus(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message === "Rate limit exceeded") return 429;

  const normalized = message.toLowerCase();
  if (normalized.includes("not found")) return 404;
  if (normalized.includes("already exists") || normalized.includes("duplicate")) return 409;
  if (BAD_REQUEST_PATTERNS.some((pattern) => normalized.includes(pattern))) return 400;
  return 500;
}

export function apiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  options?: {
    scope?: string;
    meta?: Record<string, unknown>;
  },
) {
  const rawMessage = error instanceof Error ? error.message : fallbackMessage;
  const status = inferStatus(rawMessage);
  const exposedMessage = status >= 500 ? fallbackMessage : rawMessage;

  const payload = {
    success: false,
    error: exposedMessage,
  };

  if (options?.scope) {
    const logPayload = {
      scope: options.scope,
      message: fallbackMessage,
      meta: {
        status,
        error: rawMessage,
        ...(options.meta ?? {}),
      },
    };
    if (status >= 500) {
      logger.error(logPayload);
    } else {
      logger.warn(logPayload);
    }
  }

  return NextResponse.json(payload, { status });
}
