type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
};

function emit(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    scope: payload.scope,
    message: payload.message,
    meta: payload.meta ?? {},
    timestamp: new Date().toISOString(),
  };
  const text = JSON.stringify(entry);
  if (level === "error") {
    console.error(text);
    return;
  }
  if (level === "warn") {
    console.warn(text);
    return;
  }
  console.log(text);
}

export const logger = {
  info: (payload: LogPayload) => emit("info", payload),
  warn: (payload: LogPayload) => emit("warn", payload),
  error: (payload: LogPayload) => emit("error", payload),
};
