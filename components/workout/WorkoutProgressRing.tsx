"use client";

type WorkoutProgressRingProps = {
  completedSets: number;
  totalSets: number;
  size?: number;
  strokeWidth?: number;
};

export default function WorkoutProgressRing({
  completedSets,
  totalSets,
  size = 92,
  strokeWidth = 10,
}: WorkoutProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress =
    totalSets > 0
      ? Math.max(0, Math.min(1, completedSets / totalSets))
      : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-day-border dark:text-night-border"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-day-accent-primary dark:text-night-accent"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center leading-tight">
        <div className="text-base font-semibold">
          {Math.round(progress * 100)}%
        </div>
        <div className="text-[10px] text-day-text-secondary dark:text-night-text-secondary">
          {completedSets}/{totalSets} sets
        </div>
      </div>
    </div>
  );
}

