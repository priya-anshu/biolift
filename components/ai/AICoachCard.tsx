"use client";

import { Bot, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type ProgressionAction = "increase" | "maintain" | "reduce" | "deload" | "substitute";

type RecommendationPreview = {
  progression_action: ProgressionAction;
  recommendation_reason: string[];
};

type RecoveryState = {
  readiness_score?: number | null;
  fatigue_score?: number | null;
} | null;

type TrainingLoadState = {
  acwr?: number | null;
  overtraining_risk?: number | null;
  plateau_risk?: number | null;
} | null;

type TrainingStats = {
  workouts_completed_7d?: number | null;
  consistency_score?: number | null;
} | null;

type AICoachCardProps = {
  requiresPlan?: boolean;
  recommendations: RecommendationPreview[];
  recovery: RecoveryState;
  trainingLoad: TrainingLoadState;
  trainingStats: TrainingStats;
};

type CoachTone = {
  label: string;
  variant: "success" | "warning" | "danger" | "info";
  message: string;
};

function deriveCoachTone(props: AICoachCardProps): CoachTone {
  if (props.requiresPlan) {
    return {
      label: "Setup",
      variant: "info",
      message: "Generate your first workout plan and AI will start adapting day-to-day loads.",
    };
  }

  const actions = props.recommendations.map((row) => row.progression_action);
  const firstReason = props.recommendations
    .flatMap((row) => row.recommendation_reason)
    .find((reason) => reason.trim().length > 0);
  const readiness = Number(props.recovery?.readiness_score ?? 50);
  const fatigue = Number(props.recovery?.fatigue_score ?? 50);
  const overtraining = Number(props.trainingLoad?.overtraining_risk ?? 0);
  const plateau = Number(props.trainingLoad?.plateau_risk ?? 0);
  const consistency = Number(props.trainingStats?.consistency_score ?? 0);
  const workouts7d = Number(props.trainingStats?.workouts_completed_7d ?? 0);

  if (actions.includes("substitute")) {
    return {
      label: "Protection",
      variant: "warning",
      message:
        firstReason ?? "AI substituted an exercise today to lower stress on sensitive joints.",
    };
  }
  if (actions.includes("deload")) {
    return {
      label: "Deload",
      variant: "warning",
      message:
        firstReason ??
        "AI scheduled a deload step so you can recover and keep long-term progress stable.",
    };
  }
  if (actions.includes("reduce") || readiness < 40 || fatigue >= 70 || overtraining >= 70) {
    return {
      label: "Recovery",
      variant: "warning",
      message:
        firstReason ??
        "Recovery is slightly low today. Focus on controlled training and technical quality.",
    };
  }
  if (actions.includes("increase")) {
    return {
      label: "Progression",
      variant: "success",
      message: firstReason ?? "AI increased your weight for today's workout.",
    };
  }
  if (plateau >= 70) {
    return {
      label: "Plateau Break",
      variant: "info",
      message:
        firstReason ??
        "Progress has flattened recently. AI is nudging volume and intensity to restart gains.",
    };
  }
  if (consistency >= 70 && workouts7d >= 3) {
    return {
      label: "Momentum",
      variant: "success",
      message: "Great progress! Your consistency is strong and strength is trending up.",
    };
  }

  return {
    label: "Balanced",
    variant: "info",
    message:
      firstReason ??
      "Plan is stable today. Keep clean execution and AI will continue adapting automatically.",
  };
}

export default function AICoachCard(props: AICoachCardProps) {
  const tone = deriveCoachTone(props);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
            AI Coach
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <Bot className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
            Today&apos;s Guidance
          </h2>
        </div>
        <Badge variant={tone.variant} size="sm" icon={<Sparkles className="h-3 w-3" />}>
          {tone.label}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-day-text-secondary dark:text-night-text-secondary">
        {tone.message}
      </p>
    </Card>
  );
}

