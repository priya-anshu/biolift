export function toDayIndex(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function normalizeToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

export function slugifyExerciseName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toIsoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function daysAgoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function clampIntValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function parseNumeric(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function computeDateStreak(dateKeys: string[]) {
  if (dateKeys.length === 0) return 0;
  const unique = Array.from(new Set(dateKeys)).sort();
  let streak = 0;
  const cursor = new Date(`${unique[unique.length - 1]}T00:00:00Z`);
  while (true) {
    const key = toIsoDateOnly(cursor);
    if (!unique.includes(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function tierForScore(totalScore: number) {
  if (totalScore >= 750) return "Diamond";
  if (totalScore >= 550) return "Platinum";
  if (totalScore >= 350) return "Gold";
  if (totalScore >= 200) return "Silver";
  return "Bronze";
}