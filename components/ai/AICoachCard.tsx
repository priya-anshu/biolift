"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  buildCoachInsight,
  type CoachInsight,
} from "@/lib/workout-planner/insightEngine";

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
  volume_trend_pct?: number | null;
} | null;

type TrainingStats = {
  workouts_completed_7d?: number | null;
  consistency_score?: number | null;
  streak_days?: number | null;
} | null;

type AICoachCardProps = {
  insight?: CoachInsight | null;
  requiresPlan?: boolean;
  recommendations?: RecommendationPreview[];
  recovery?: RecoveryState;
  trainingLoad?: TrainingLoadState;
  trainingStats?: TrainingStats;
  className?: string;
};

export default function AICoachCard(props: AICoachCardProps) {
  const insight =
    props.insight ??
    buildCoachInsight({
      requiresPlan: props.requiresPlan,
      recommendations: props.recommendations ?? [],
      recovery: props.recovery ?? null,
      trainingLoad: props.trainingLoad ?? null,
      trainingStats: props.trainingStats ?? null,
    });

  return (
    <Card className={props.className ?? "p-5 sm:p-6"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">
            AI Coach
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
            <Bot className="h-5 w-5 text-day-accent-primary dark:text-night-accent" />
            Today&apos;s Guidance
          </h2>
        </div>
        <Badge variant={insight.variant} size="sm" icon={<Sparkles className="h-3 w-3" />}>
          {insight.label}
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-day-text-primary dark:text-night-text-primary">
            {insight.headline}
          </h3>
          <p className="mt-2 text-sm leading-6 text-day-text-secondary dark:text-night-text-secondary">
            {insight.message}
          </p>
        </div>

        {insight.bullets.length > 0 ? (
          <div className="space-y-2">
            {insight.bullets.slice(0, 2).map((bullet, index) => (
              <div
                key={`${bullet}-${index}`}
                className="rounded-xl border border-day-border/80 bg-day-hover/50 px-3 py-2 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary"
              >
                {bullet}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={insight.primaryAction.href}
            className="inline-flex items-center justify-center rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:bg-night-accent"
          >
            {insight.primaryAction.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          {insight.secondaryAction ? (
            <Link
              href={insight.secondaryAction.href}
              className="inline-flex items-center justify-center rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
            >
              {insight.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
