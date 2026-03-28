import type { ExerciseRecommendation } from "@/lib/workout-planner/intelligenceEngine";

type ProgressionAction = ExerciseRecommendation["progression_action"];

export type CoachInsightVariant = "success" | "warning" | "danger" | "info";

export type CoachInsightAction = {
  href: string;
  label: string;
};

export type CoachAutomationItem = {
  id: string;
  title: string;
  description: string;
  variant: CoachInsightVariant;
};

export type CoachInsight = {
  variant: CoachInsightVariant;
  label: string;
  headline: string;
  message: string;
  bullets: string[];
  primaryAction: CoachInsightAction;
  secondaryAction: CoachInsightAction | null;
  automationItems: CoachAutomationItem[];
  generatedAt: string;
};

export type CoachInsightRecommendation = {
  progression_action: ProgressionAction;
  recommendation_reason: string[];
};

export type CoachInsightExercise = {
  exercise_name: string;
  muscle_group?: string | null;
};

export type CoachInsightInput = {
  requiresPlan?: boolean;
  recommendations?: CoachInsightRecommendation[];
  recovery?: {
    readiness_score?: number | null;
    fatigue_score?: number | null;
  } | null;
  trainingLoad?: {
    acwr?: number | null;
    overtraining_risk?: number | null;
    plateau_risk?: number | null;
    volume_trend_pct?: number | null;
  } | null;
  trainingStats?: {
    workouts_completed_7d?: number | null;
    consistency_score?: number | null;
    streak_days?: number | null;
  } | null;
  previewExercises?: CoachInsightExercise[];
  cacheState?: "exact" | "plan_fallback" | "baseline" | string;
  cacheTtl?: {
    isStale?: boolean;
  } | null;
};

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function joinList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function sentenceFromParts(parts: string[]) {
  const filtered = parts.map((value) => value.trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  const sentence = joinList(filtered);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function buildFocusLine(previewExercises: CoachInsightExercise[]) {
  const focusNames = uniqueNonEmpty(
    previewExercises
      .slice(0, 3)
      .map((row) => row.exercise_name),
  );
  if (focusNames.length > 0) {
    return `Today's focus is ${joinList(focusNames)}.`;
  }

  const muscleGroups = uniqueNonEmpty(
    previewExercises
      .slice(0, 3)
      .map((row) => String(row.muscle_group ?? "")),
  );
  if (muscleGroups.length > 0) {
    return `Today's session targets ${joinList(muscleGroups)}.`;
  }

  return null;
}

const MISSING_METRICS_LINE = "Recovery and load metrics will appear after a few logged workouts.";

function buildRecoverySnapshotLine(input: {
  readiness: number | null;
  fatigue: number | null;
  acwr: number | null;
  overtraining: number | null;
}) {
  const parts = [
    input.readiness !== null ? `readiness ${round(input.readiness)}/100` : "",
    input.fatigue !== null ? `fatigue ${round(input.fatigue)}/100` : "",
    input.acwr !== null ? `ACWR ${round(input.acwr, 2)}` : "",
    input.overtraining !== null ? `overtraining risk ${round(input.overtraining)}/100` : "",
  ].filter(Boolean);
  return sentenceFromParts(parts);
}

function buildMetricsLine(input: {
  readiness: number | null;
  fatigue: number | null;
  workouts7d: number;
  consistency: number;
  streak: number;
  acwr: number | null;
}) {
  if (input.workouts7d > 0 || input.consistency > 0 || input.streak > 0) {
    return sentenceFromParts([
      input.workouts7d > 0
        ? `${input.workouts7d} workout${input.workouts7d === 1 ? "" : "s"} in the last 7 days`
        : "",
      input.consistency > 0 ? `consistency ${round(input.consistency)}` : "",
      input.streak > 0 ? `${input.streak}-day streak` : "",
    ]);
  }
  return buildRecoverySnapshotLine({
    readiness: input.readiness,
    fatigue: input.fatigue,
    acwr: input.acwr,
    overtraining: null,
  });
}

function buildRefreshLine(cacheState?: string, isStale?: boolean) {
  if (cacheState && cacheState !== "exact") {
    return "A background refresh is already queued for fresher guidance.";
  }
  if (isStale) {
    return "This guidance is cached and will refresh automatically.";
  }
  return "Completing today's workout refreshes recovery, load, and ranking automatically.";
}

function buildSetupInsight(): CoachInsight {
  return {
    variant: "info",
    label: "Setup",
    headline: "Create your first plan",
    message:
      "A plan unlocks daily workout guidance and automatic refreshes after each session.",
    bullets: [
      "No active workout plan is connected yet.",
      "Your first plan enables daily recommendations and session guidance.",
      "Progress, recovery, and ranking updates already run after completed workouts.",
    ],
    primaryAction: {
      href: "/dashboard/workout-planner",
      label: "Create Plan",
    },
    secondaryAction: {
      href: "/dashboard/progress",
      label: "View Progress",
    },
    automationItems: [
      {
        id: "plan-bootstrap",
        title: "Plan bootstrap",
        description: "The planner seeds training days and queues the first recommendation refresh.",
        variant: "info",
      },
      {
        id: "post-workout-refresh",
        title: "Automatic refresh",
        description: "Finished sessions trigger leaderboard, recovery, and load updates automatically.",
        variant: "success",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function buildCoachInsight(input: CoachInsightInput): CoachInsight {
  if (input.requiresPlan) {
    return buildSetupInsight();
  }

  const recommendations = input.recommendations ?? [];
  const actions = recommendations.map((row) => row.progression_action);
  const firstReason = recommendations
    .flatMap((row) => row.recommendation_reason)
    .map((reason) => reason.trim())
    .find((reason) => reason.length > 0);

  const readiness = toNullableNumber(input.recovery?.readiness_score);
  const fatigue = toNullableNumber(input.recovery?.fatigue_score);
  const acwr = toNullableNumber(input.trainingLoad?.acwr);
  const overtraining = toNullableNumber(input.trainingLoad?.overtraining_risk);
  const plateau = toNullableNumber(input.trainingLoad?.plateau_risk);
  const volumeTrend = toNullableNumber(input.trainingLoad?.volume_trend_pct);
  const workouts7d = Math.max(0, Math.floor(toNumber(input.trainingStats?.workouts_completed_7d, 0)));
  const consistency = Math.max(0, toNumber(input.trainingStats?.consistency_score, 0));
  const streak = Math.max(0, Math.floor(toNumber(input.trainingStats?.streak_days, 0)));
  const focusLine = buildFocusLine(input.previewExercises ?? []);
  const refreshLine = buildRefreshLine(input.cacheState, Boolean(input.cacheTtl?.isStale));
  const metricsLine =
    buildMetricsLine({
      readiness,
      fatigue,
      workouts7d,
      consistency,
      streak,
      acwr,
    }) ?? MISSING_METRICS_LINE;
  const recoveryLine = buildRecoverySnapshotLine({
    readiness,
    fatigue,
    acwr,
    overtraining,
  });
  const plateauLine =
    plateau !== null
      ? `Plateau risk is ${round(plateau)}/100${
          volumeTrend !== null ? ` with volume trend ${round(volumeTrend, 1)}%` : ""
        }.`
      : "Recent progress looks flat, so today's recommendation is nudging progression carefully.";

  let insight: Omit<CoachInsight, "generatedAt">;

  if (actions.includes("substitute")) {
    insight = {
      variant: "warning",
      label: "Protection",
      headline: "Joint stress has been redirected",
      message:
        firstReason ??
        "Today's session swapped at least one movement so you can keep training while reducing stress on a sensitive pattern.",
      bullets: uniqueNonEmpty([
        focusLine ?? "",
        metricsLine,
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Start Workout",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "View Progress",
      },
      automationItems: [
        {
          id: "exercise-substitution",
          title: "Exercise substitution active",
          description:
            "The recommendation layer already swapped exercise stress automatically so you do not need to edit the plan by hand.",
          variant: "warning",
        },
        {
          id: "session-refresh",
          title: "Post-session refresh",
          description:
            "Once you finish the workout, recovery, adaptation, and leaderboard signals update in the worker queue automatically.",
          variant: "success",
        },
      ],
    };
  } else if (actions.includes("deload")) {
    insight = {
      variant: "warning",
      label: "Deload",
      headline: "Deload session is in effect",
      message:
        firstReason ??
        "The system is intentionally lowering stress today so you can recover and keep progression moving.",
      bullets: uniqueNonEmpty([
        focusLine ?? "",
        recoveryLine ?? "Today's plan is lighter while recovery metrics are still being collected.",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Start Deload Session",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "Review Progress",
      },
      automationItems: [
        {
          id: "deload-load-adjustment",
          title: "Load reduced automatically",
          description: "Today's sets and target load already reflect the deload adjustment.",
          variant: "warning",
        },
        {
          id: "fatigue-recheck",
          title: "Fatigue recheck scheduled",
          description: "Your next logged session triggers a fresh recovery and load pass.",
          variant: "info",
        },
      ],
    };
  } else if (
    (readiness !== null && readiness < 30) ||
    (overtraining !== null && overtraining >= 80) ||
    (acwr !== null && acwr > 1.6)
  ) {
    insight = {
      variant: "danger",
      label: "Recovery",
      headline: "Recovery-first training day",
      message:
        firstReason ??
        "Recovery is low enough that the safest move is to keep effort controlled and prioritize clean execution.",
      bullets: uniqueNonEmpty([
        recoveryLine ?? "Recovery signals are limited, so keep effort controlled and log the session cleanly.",
        focusLine ?? "",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Train Conservatively",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "See Recovery Trend",
      },
      automationItems: [
        {
          id: "auto-load-guardrail",
          title: "Auto load guardrail",
          description: "The recommendation pipeline is already holding intensity down today.",
          variant: "danger",
        },
        {
          id: "post-workout-state-refresh",
          title: "State refresh ready",
          description: "As soon as you log the session, BioLift refreshes recovery, load, and ranking.",
          variant: "info",
        },
      ],
    };
  } else if (
    actions.includes("reduce") ||
    (readiness !== null && readiness < 40) ||
    (fatigue !== null && fatigue >= 70) ||
    (overtraining !== null && overtraining >= 65)
  ) {
    insight = {
      variant: "warning",
      label: "Recovery",
      headline: "Controlled effort is the right call today",
      message:
        firstReason ??
        "Signals show moderate fatigue, so the goal is stable execution and controlled volume instead of chasing hard overload.",
      bullets: uniqueNonEmpty([
        recoveryLine ?? "Today's plan is intentionally conservative while more recovery data is collected.",
        focusLine ?? "",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Start Guided Workout",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "Track Recovery",
      },
      automationItems: [
        {
          id: "controlled-volume",
          title: "Volume adjusted automatically",
          description: "Today's recommendation is already tuned down from your current signals.",
          variant: "warning",
        },
        {
          id: "future-refresh",
          title: "Future refresh queued",
          description: refreshLine,
          variant: "info",
        },
      ],
    };
  } else if (actions.includes("increase")) {
    insight = {
      variant: "success",
      label: "Progression",
      headline: "Good window for progression",
      message:
        firstReason ??
        "Your recent training and current readiness support a measured overload step today.",
      bullets: uniqueNonEmpty([
        focusLine ?? "",
        metricsLine,
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Push Today's Session",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "Track Strength Trend",
      },
      automationItems: [
        {
          id: "prefilled-load",
          title: "Target load prefilled",
          description: "Recommended sets, reps, and load are already derived from recent performance.",
          variant: "success",
        },
        {
          id: "auto-ranking-update",
          title: "Automatic ranking refresh",
          description: "Completing the workout updates training stats and leaderboard position.",
          variant: "info",
        },
      ],
    };
  } else if (plateau !== null && plateau >= 70) {
    insight = {
      variant: "info",
      label: "Plateau Break",
      headline: "The system is trying to break a plateau",
      message:
        firstReason ??
        "Recent trends look flat, so BioLift is nudging volume and execution quality to reopen progression without changing the whole plan.",
      bullets: uniqueNonEmpty([
        plateauLine,
        focusLine ?? "",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Follow Today's Plan",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "Inspect Trends",
      },
      automationItems: [
        {
          id: "plateau-guardrail",
          title: "Plateau guardrail active",
          description: "The current recommendation is already adjusting load and session flow.",
          variant: "info",
        },
        {
          id: "trend-monitor",
          title: "Trend monitor",
          description: "Exercise and training snapshots keep updating after each workout.",
          variant: "success",
        },
      ],
    };
  } else if (consistency >= 70 && workouts7d >= 3) {
    insight = {
      variant: "success",
      label: "Momentum",
      headline: "Momentum is building",
      message:
        firstReason ??
        "Consistency has been strong recently, and the system now has enough signal to keep progression more stable from session to session.",
      bullets: uniqueNonEmpty([
        metricsLine,
        focusLine ?? "",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Keep The Streak Going",
      },
      secondaryAction: {
        href: "/dashboard/ranking",
        label: "View Ranking",
      },
      automationItems: [
        {
          id: "momentum-refresh",
          title: "Momentum tracked automatically",
          description: "Your streak, leaderboard, and training snapshots update from completed workouts.",
          variant: "success",
        },
        {
          id: "readiness-watch",
          title: "Readiness watch",
          description: "BioLift keeps checking recovery and load as training volume builds.",
          variant: "info",
        },
      ],
    };
  } else {
    insight = {
      variant: "info",
      label: "Balanced",
      headline: "Plan is stable today",
      message:
        firstReason ??
        "Signals are balanced enough to keep steady execution, log the session cleanly, and let the next recommendation update automatically.",
      bullets: uniqueNonEmpty([
        metricsLine,
        focusLine ?? "",
        refreshLine,
      ]),
      primaryAction: {
        href: "/dashboard/workout-session",
        label: "Start Workout",
      },
      secondaryAction: {
        href: "/dashboard/progress",
        label: "Open Progress",
      },
      automationItems: [
        {
          id: "stable-session",
          title: "Stable recommendation",
          description: "Today's guidance is already synchronized with your current plan and history.",
          variant: "info",
        },
        {
          id: "auto-post-session-refresh",
          title: "Auto post-session refresh",
          description: refreshLine,
          variant: "success",
        },
      ],
    };
  }

  return {
    ...insight,
    generatedAt: new Date().toISOString(),
  };
}
