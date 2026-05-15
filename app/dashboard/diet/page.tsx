"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Apple,
  BarChart3,
  CheckCircle,
  Clock,
  Droplets,
  Flame,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  MEAL_SLOTS,
  NUTRIENT_DEFINITIONS,
  PRIMARY_MEAL_SLOT_IDS,
  toPercent,
} from "@/lib/nutrition/config";
import type {
  MealSlotId,
  NutritionApiResponse,
  NutritionDashboardData,
  NutritionGoals,
  NutritionMealSummary,
} from "@/lib/nutrition/types";

type NutritionGoalsResponse = {
  goals?: NutritionGoals;
  error?: string;
};

const PANEL_CLASS =
  "border border-day-border/80 bg-day-card shadow-none dark:border-white/[0.08] dark:bg-[#0f1115] dark:shadow-none";
const INSET_CLASS =
  "rounded-2xl border border-day-border/70 bg-day-hover/70 dark:border-white/[0.08] dark:bg-white/[0.03]";

const MEAL_EXAMPLES: Record<MealSlotId, string> = {
  pre_workout: "1 banana, 1 scoop whey",
  breakfast: "2 eggs, 1 cup oats, 200 ml milk",
  mid_morning: "1 apple, 10 almonds",
  lunch: "2 chapati, 1 bowl dal, 1 bowl salad",
  evening_snack: "1 cup chai, 2 idli",
  dinner: "150 g chicken, 1 cup rice, 1 bowl salad",
  hydration: "250 ml water",
};

function formatDateInput(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function joinPreview(items: string[], fallback: string) {
  if (!items.length) return fallback;
  return items.slice(0, 2).join(", ");
}

function getToneVariant(tone: NutritionDashboardData["insight"]["tone"]) {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  return "info";
}

function getTonePanelClasses(tone: NutritionDashboardData["insight"]["tone"]) {
  if (tone === "success") {
    return "border-emerald-200/70 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (tone === "warning") {
    return "border-amber-200/70 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "border-sky-200/70 bg-sky-50/90 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300";
}

function getCalorieScore(value: number, goal: number) {
  if (!goal) return 0;
  return Math.max(0, 100 - Math.min((Math.abs(value - goal) / goal) * 100, 100));
}

function RadialGauge({
  value,
  goal,
  accent,
  size = 90,
  strokeWidth = 9,
  caption,
}: {
  value: number;
  goal: number;
  accent: string;
  size?: number;
  strokeWidth?: number;
  caption: string;
}) {
  const progress = Math.min(Math.max(value / Math.max(goal, 1), 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = progress * circumference;

  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-day-border dark:text-white/[0.10]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold text-day-text-primary dark:text-white">
          {Math.round(value)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.24em] text-day-text-secondary dark:text-white/55">
          {caption}
        </div>
      </div>
    </div>
  );
}

function VisualStatCard({
  label,
  value,
  goal,
  unit,
  accent,
  note,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  accent: string;
  note: string;
}) {
  const percent = toPercent(value, goal);

  return (
    <Card className={`${PANEL_CLASS} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-day-text-secondary dark:text-white/50">
            {label}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-bold text-day-text-primary dark:text-white">
              {formatValue(value)}
            </span>
            <span className="pb-1 text-xs text-day-text-secondary dark:text-white/55">{unit}</span>
          </div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-white/45">{note}</p>
        </div>
        <div className="rounded-full bg-day-hover px-2.5 py-1 text-xs font-semibold text-day-text-secondary dark:bg-white/[0.04] dark:text-white/70">
          {Math.round(percent)}%
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%`, backgroundColor: accent }}
          />
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
          Goal {formatValue(goal)} {unit}
        </p>
      </div>
    </Card>
  );
}

function MacroBalanceCard({
  totals,
  goals,
}: {
  totals: NutritionDashboardData["totals"];
  goals: NutritionDashboardData["goals"];
}) {
  const proteinCalories = totals.protein * 4;
  const carbsCalories = totals.carbs * 4;
  const fatCalories = totals.fat * 9;
  const macroTotalCalories = Math.max(proteinCalories + carbsCalories + fatCalories, 1);
  const macros = [
    {
      label: "Protein",
      value: totals.protein,
      goal: goals.protein,
      accent: "#38BDF8",
      energy: proteinCalories,
    },
    {
      label: "Carbs",
      value: totals.carbs,
      goal: goals.carbs,
      accent: "#F59E0B",
      energy: carbsCalories,
    },
    {
      label: "Fat",
      value: totals.fat,
      goal: goals.fat,
      accent: "#F43F5E",
      energy: fatCalories,
    },
  ];

  return (
    <Card className={`${PANEL_CLASS} p-5`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
        <BarChart3 className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
        Macro balance
      </div>
      <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
        Quick visual of your main macro targets.
      </p>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
        {macros.map((macro) => (
          <div
            key={macro.label}
            className="h-full float-left"
            style={{
              width: `${(macro.energy / macroTotalCalories) * 100}%`,
              backgroundColor: macro.accent,
            }}
          />
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {macros.map((macro) => {
          const progress = toPercent(macro.value, macro.goal);
          return (
            <div key={macro.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-day-text-primary dark:text-white">
                  {macro.label}
                </span>
                <span className="text-day-text-secondary dark:text-white/55">
                  {formatValue(macro.value)} / {formatValue(macro.goal)} g
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: macro.accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EnergyFlowCard({
  meals,
}: {
  meals: Array<{
    id: MealSlotId;
    shortLabel: string;
    label: string;
    calories: number;
    accent: string;
  }>;
}) {
  const maxCalories = Math.max(...meals.map((meal) => meal.calories), 1);
  const activeMeals = meals.filter((meal) => meal.calories > 0).length;

  return (
    <Card className={`${PANEL_CLASS} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
          <Activity className="h-4 w-4 text-emerald-500" />
          Meal energy flow
        </div>
        <Badge variant="ghost" size="sm" className="dark:bg-white/[0.04] dark:text-white/70">
          {activeMeals}/{meals.length} active
        </Badge>
      </div>
      <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
        Calories spread across the day.
      </p>

      <div className="mt-5 flex h-44 items-end gap-3">
        {meals.map((meal) => {
          const height = meal.calories > 0 ? Math.max(14, (meal.calories / maxCalories) * 100) : 10;
          return (
            <div key={meal.id} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-day-text-secondary dark:text-white/55">
                {Math.round(meal.calories)}
              </span>
              <div className="flex h-28 w-full items-end rounded-2xl bg-day-hover p-1 dark:bg-white/[0.04]">
                <div
                  className={`w-full rounded-[14px] bg-gradient-to-t ${meal.accent}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-day-text-secondary dark:text-white/45">
                {meal.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InsightPanel({
  dashboard,
  dayScore,
  loggedMeals,
}: {
  dashboard: NutritionDashboardData;
  dayScore: number;
  loggedMeals: number;
}) {
  return (
    <Card className={`${PANEL_CLASS} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
          <Sparkles className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
          Smart guidance
        </div>
        <Badge variant={getToneVariant(dashboard.insight.tone)} size="sm">
          {dashboard.insight.tone}
        </Badge>
      </div>

      <div className={`mt-4 rounded-2xl border p-4 ${getTonePanelClasses(dashboard.insight.tone)}`}>
        <h3 className="font-semibold">{dashboard.insight.title}</h3>
        <p className="mt-2 text-sm leading-6">{dashboard.insight.body}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className={`${INSET_CLASS} p-3`}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
            Day score
          </div>
          <div className="mt-2 text-xl font-bold text-day-text-primary dark:text-white">
            {dayScore}
          </div>
        </div>
        <div className={`${INSET_CLASS} p-3`}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
            Logged
          </div>
          <div className="mt-2 text-xl font-bold text-day-text-primary dark:text-white">
            {loggedMeals}
          </div>
        </div>
        <div className={`${INSET_CLASS} p-3`}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
            Review
          </div>
          <div className="mt-2 text-xl font-bold text-day-text-primary dark:text-white">
            {dashboard.reviewCount}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CompactMealTile({
  meal,
  calorieGoal,
}: {
  meal: NutritionMealSummary;
  calorieGoal: number;
}) {
  const slot = MEAL_SLOTS.find((entry) => entry.id === meal.mealSlot)!;
  const mealGoal = Math.max(calorieGoal / 4, 1);
  const progress = toPercent(meal.totals.calories, mealGoal);

  return (
    <div className={`${INSET_CLASS} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${slot.accent} text-xs font-bold text-white`}>
          {slot.shortLabel}
        </div>
        {meal.needsReview ? (
          <Badge variant="warning" size="sm">
            Review
          </Badge>
        ) : meal.logCount > 0 ? (
          <Badge variant="success" size="sm">
            Live
          </Badge>
        ) : (
          <Badge variant="ghost" size="sm" className="dark:bg-white/[0.04] dark:text-white/60">
            Empty
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-base font-semibold text-day-text-primary dark:text-white">
          {slot.label}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-day-text-secondary dark:text-white/50">
          {joinPreview(meal.items, "No items logged yet")}
        </p>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-day-text-primary dark:text-white">
            {Math.round(meal.totals.calories)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-day-text-secondary dark:text-white/45">
            kcal
          </div>
        </div>
        <div className="text-right text-xs text-day-text-secondary dark:text-white/45">
          <div>{formatValue(meal.totals.protein)} g protein</div>
          <div>{slot.time}</div>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${slot.accent}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function MicroNutrientGrid({
  dashboard,
}: {
  dashboard: NutritionDashboardData;
}) {
  const nutrients = NUTRIENT_DEFINITIONS.filter((nutrient) =>
    ["water", "sugar", "sodium", "calcium", "iron", "vitaminC"].includes(nutrient.key),
  );

  return (
    <Card className={`${PANEL_CLASS} p-5`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
        <TrendingUp className="h-4 w-4 text-violet-500" />
        Compact nutrient view
      </div>
      <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
        Secondary nutrients in a tighter visual grid.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {nutrients.map((nutrient) => {
          const value = dashboard.totals[nutrient.key] ?? 0;
          const goal = dashboard.goals[nutrient.key] ?? 0;
          const progress = toPercent(value, goal);
          return (
            <div key={nutrient.key} className={`${INSET_CLASS} p-3`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.2em] text-day-text-secondary dark:text-white/45">
                  {nutrient.label}
                </span>
                <span className="text-xs font-semibold text-day-text-secondary dark:text-white/60">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-lg font-bold text-day-text-primary dark:text-white">
                  {formatValue(value)}
                </span>
                <span className="pb-0.5 text-xs text-day-text-secondary dark:text-white/45">
                  {nutrient.unit}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${nutrient.accent}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GoalEditor({
  goalDraft,
  setGoalDraft,
  onSave,
  savingGoals,
}: {
  goalDraft: {
    calories: string;
    protein: string;
    carbs: string;
    fiber: string;
    fat: string;
    water: string;
  };
  setGoalDraft: React.Dispatch<
    React.SetStateAction<{
      calories: string;
      protein: string;
      carbs: string;
      fiber: string;
      fat: string;
      water: string;
    }>
  >;
  onSave: () => void;
  savingGoals: boolean;
}) {
  const fields = [
    { key: "calories", label: "Calories", unit: "kcal" },
    { key: "protein", label: "Protein", unit: "g" },
    { key: "carbs", label: "Carbs", unit: "g" },
    { key: "fiber", label: "Fiber", unit: "g" },
    { key: "fat", label: "Fat", unit: "g" },
    { key: "water", label: "Water", unit: "ml" },
  ] as const;

  return (
    <Card className={`${PANEL_CLASS} p-5`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
        <Target className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
        Goal targets
      </div>
      <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
        Stored per user, but kept visually compact.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <label key={field.key} className={`${INSET_CLASS} p-3`}>
            <span className="text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
              {field.label}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={goalDraft[field.key]}
                onChange={(event) =>
                  setGoalDraft((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                className="w-full bg-transparent text-base font-semibold text-day-text-primary outline-none dark:text-white"
              />
              <span className="text-xs text-day-text-secondary dark:text-white/45">
                {field.unit}
              </span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <Button
          onClick={onSave}
          loading={savingGoals}
          size="sm"
          icon={<Save className="h-4 w-4" />}
        >
          Save goals
        </Button>
      </div>
    </Card>
  );
}

function MealCard({
  slot,
  meal,
  expanded,
  inputValue,
  busy,
  onToggle,
  onInputChange,
  onLog,
  onClear,
}: {
  slot: (typeof MEAL_SLOTS)[number];
  meal: NutritionMealSummary | undefined;
  expanded: boolean;
  inputValue: string;
  busy: boolean;
  onToggle: () => void;
  onInputChange: (value: string) => void;
  onLog: () => void;
  onClear: () => void;
}) {
  return (
    <Card padding="p-0" className={`${PANEL_CLASS} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-day-hover/50 dark:hover:bg-white/[0.03]"
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${slot.accent} text-xs font-bold text-white`}>
          {slot.shortLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-day-text-primary dark:text-white">
              {slot.label}
            </h3>
            {meal?.needsReview ? (
              <Badge variant="warning" size="sm">
                Review
              </Badge>
            ) : meal?.logCount ? (
              <Badge variant="success" size="sm">
                Logged
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-white/45">{slot.time}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-day-text-primary dark:text-white">
            {Math.round(meal?.totals.calories ?? 0)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-day-text-secondary dark:text-white/45">
            kcal
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-day-border/70 px-4 pb-4 pt-3 dark:border-white/[0.08]">
          {meal?.items.length ? (
            <div className={`${INSET_CLASS} p-3`}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                <CheckCircle className="h-4 w-4" />
                Recognized items
              </div>
              <div className="flex flex-wrap gap-2">
                {meal.items.map((item, index) => (
                  <Badge
                    key={`${slot.id}-${index}-${item}`}
                    variant="ghost"
                    size="sm"
                    className="dark:bg-white/[0.04] dark:text-white/65"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className={`${INSET_CLASS} border-dashed p-3 text-sm text-day-text-secondary dark:text-white/50`}>
              Nothing logged yet for this slot.
            </div>
          )}

          <div className="mt-3">
            <textarea
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              rows={3}
              placeholder={MEAL_EXAMPLES[slot.id]}
              className="w-full rounded-2xl border border-day-border bg-day-card px-4 py-3 text-sm text-day-text-primary outline-none transition focus:border-day-accent-primary dark:border-white/[0.08] dark:bg-[#151821] dark:text-white dark:focus:border-sky-400"
            />
            <p className="mt-2 text-xs text-day-text-secondary dark:text-white/45">
              Keep foods comma-separated and include units like cup, bowl, g, ml, tsp, or scoop.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={onLog}
              loading={busy}
              disabled={!inputValue.trim()}
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              Log meal
            </Button>
            <Button
              variant="ghost"
              onClick={onClear}
              disabled={busy || !meal?.logCount}
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default function DietPage() {
  const [date, setDate] = useState(formatDateInput());
  const [dashboard, setDashboard] = useState<NutritionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "log">("dashboard");
  const [expandedMeal, setExpandedMeal] = useState<MealSlotId | null>("breakfast");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState({
    calories: "2200",
    protein: "140",
    carbs: "220",
    fiber: "30",
    fat: "70",
    water: "3000",
  });

  const loadNutrition = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/nutrition?date=${selectedDate}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as NutritionApiResponse & { error?: string };
      if (!response.ok || !payload.dashboard) {
        throw new Error(payload.error ?? "Failed to load the nutrition tracker.");
      }
      setDashboard(payload.dashboard);
      setGoalDraft({
        calories: String(Math.round(payload.dashboard.goals.calories)),
        protein: String(Math.round(payload.dashboard.goals.protein)),
        carbs: String(Math.round(payload.dashboard.goals.carbs)),
        fiber: String(Math.round(payload.dashboard.goals.fiber)),
        fat: String(Math.round(payload.dashboard.goals.fat)),
        water: String(Math.round(payload.dashboard.goals.water)),
      });
    } catch (loadError) {
      setDashboard(null);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load the nutrition tracker.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNutrition(date);
  }, [date, loadNutrition]);

  const mealMap = useMemo(
    () => new Map((dashboard?.meals ?? []).map((meal) => [meal.mealSlot, meal])),
    [dashboard?.meals],
  );

  const primaryMeals = PRIMARY_MEAL_SLOT_IDS.map((id) => mealMap.get(id)).filter(
    (meal): meal is NutritionMealSummary => Boolean(meal),
  );

  const hydrationMeal = mealMap.get("hydration");
  const loggedMeals = primaryMeals.filter((meal) => meal.logCount > 0).length;

  const dayScore = useMemo(() => {
    if (!dashboard) return 0;

    const calorieScore = getCalorieScore(dashboard.totals.calories, dashboard.goals.calories);
    const proteinScore = Math.min(
      (dashboard.totals.protein / Math.max(dashboard.goals.protein, 1)) * 100,
      100,
    );
    const waterScore = Math.min(
      (dashboard.totals.water / Math.max(dashboard.goals.water, 1)) * 100,
      100,
    );
    const coverageScore = (loggedMeals / Math.max(primaryMeals.length, 1)) * 100;

    return Math.round((calorieScore + proteinScore + waterScore + coverageScore) / 4);
  }, [dashboard, loggedMeals, primaryMeals.length]);

  const caloriesRemaining = Math.round(
    (dashboard?.goals.calories ?? 0) - (dashboard?.totals.calories ?? 0),
  );

  const mealBars = useMemo(
    () =>
      PRIMARY_MEAL_SLOT_IDS.map((id) => {
        const slot = MEAL_SLOTS.find((entry) => entry.id === id)!;
        const meal = mealMap.get(id);
        return {
          id,
          shortLabel: slot.shortLabel,
          label: slot.label,
          calories: Math.round(meal?.totals.calories ?? 0),
          accent: slot.accent,
        };
      }),
    [mealMap],
  );

  async function handleLog(mealSlot: MealSlotId, description: string) {
    setActiveAction(`log:${mealSlot}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/nutrition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          mealSlot,
          description,
        }),
      });
      const payload = (await response.json()) as NutritionApiResponse & { error?: string };
      if (!response.ok || !payload.dashboard) {
        throw new Error(payload.error ?? "Failed to save the nutrition entry.");
      }

      setDashboard(payload.dashboard);
      setInputs((current) => ({ ...current, [mealSlot]: "" }));
      if (payload.log?.reviewStatus === "needs_review") {
        const unmatched = payload.log.unmatched.length
          ? ` Review items: ${payload.log.unmatched.join(", ")}.`
          : "";
        setNotice(`Meal saved with a review flag.${unmatched}`);
      } else {
        setNotice("Meal saved successfully.");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save the nutrition entry.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleClear(mealSlot: MealSlotId) {
    setActiveAction(`clear:${mealSlot}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/nutrition", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          mealSlot,
        }),
      });
      const payload = (await response.json()) as NutritionApiResponse & { error?: string };
      if (!response.ok || !payload.dashboard) {
        throw new Error(payload.error ?? "Failed to clear the meal slot.");
      }

      setDashboard(payload.dashboard);
      setNotice("Meal slot cleared.");
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : "Failed to clear the meal slot.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleHydrationAdd(amount: number) {
    await handleLog("hydration", `${amount} ml water`);
  }

  async function handleSaveGoals() {
    setSavingGoals(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/nutrition/goals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calories: Number(goalDraft.calories),
          protein: Number(goalDraft.protein),
          carbs: Number(goalDraft.carbs),
          fiber: Number(goalDraft.fiber),
          fat: Number(goalDraft.fat),
          water: Number(goalDraft.water),
        }),
      });
      const payload = (await response.json()) as NutritionGoalsResponse;
      if (!response.ok || !payload.goals) {
        throw new Error(payload.error ?? "Failed to update goals.");
      }

      const nextGoals = payload.goals;
      setDashboard((current) =>
        current
          ? {
              ...current,
              goals: nextGoals,
            }
          : current,
      );
      setNotice("Nutrition goals updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update goals.");
    } finally {
      setSavingGoals(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-3xl bg-day-card dark:bg-night-card" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-3xl bg-day-card dark:bg-night-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <Button size="sm" onClick={() => void loadNutrition(date)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border border-day-border/80 bg-day-card shadow-none dark:border-white/[0.08] dark:bg-[#0c0f13] dark:shadow-none">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 opacity-80 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_38%)]" />
            <div className="relative grid gap-4 p-5 xl:grid-cols-[1.2fr_0.85fr_0.75fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" size="sm">
                    Smart tracking
                  </Badge>
                  <Badge variant="success" size="sm">
                    Dark compact UI
                  </Badge>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="rounded-2xl bg-day-hover p-3 dark:bg-white/[0.04]">
                    <Apple className="h-6 w-6 text-day-accent-primary dark:text-sky-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-day-text-primary dark:text-white">
                      Biolift Nutrition Tracker
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-day-text-secondary dark:text-white/55">
                      Slimmer cards, faster scan, more charts, and a cleaner dark dashboard for
                      daily food tracking.
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${INSET_CLASS} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Daily energy
                  </div>
                  <Badge variant="ghost" size="sm" className="dark:bg-white/[0.04] dark:text-white/70">
                    {loggedMeals}/{primaryMeals.length} meals
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <RadialGauge
                    value={dashboard.totals.calories}
                    goal={dashboard.goals.calories}
                    accent="#12D6BF"
                    size={112}
                    strokeWidth={10}
                    caption="kcal"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-day-text-secondary dark:text-white/45">
                        Remaining
                      </div>
                      <div className="mt-1 text-2xl font-bold text-day-text-primary dark:text-white">
                        {caloriesRemaining >= 0 ? caloriesRemaining : Math.abs(caloriesRemaining)}
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-day-border dark:bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                        style={{
                          width: `${toPercent(
                            dashboard.totals.calories,
                            dashboard.goals.calories,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-day-text-secondary dark:text-white/50">
                      {caloriesRemaining >= 0 ? "Still room for the day." : "You are above target."}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${INSET_CLASS} p-4`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                  <Clock className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
                  Tracker date
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-day-border bg-day-card px-4 py-3 text-sm text-day-text-primary outline-none transition focus:border-day-accent-primary dark:border-white/[0.08] dark:bg-[#151821] dark:text-white dark:focus:border-sky-400"
                />
                <div className="mt-4 text-sm text-day-text-secondary dark:text-white/55">
                  {dashboard.dataSource.mode}
                </div>
                <p className="mt-2 text-xs leading-6 text-day-text-secondary dark:text-white/45">
                  Unknown foods are flagged for review instead of guessed.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "dashboard" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </Button>
        <Button
          variant={activeTab === "log" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("log")}
        >
          Log meals
        </Button>
      </div>

      {activeTab === "dashboard" ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.03 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <VisualStatCard
              label="Calories"
              value={dashboard.totals.calories}
              goal={dashboard.goals.calories}
              unit="kcal"
              accent="#14B8A6"
              note="Energy target"
            />
            <VisualStatCard
              label="Protein"
              value={dashboard.totals.protein}
              goal={dashboard.goals.protein}
              unit="g"
              accent="#38BDF8"
              note="Recovery support"
            />
            <VisualStatCard
              label="Water"
              value={dashboard.totals.water}
              goal={dashboard.goals.water}
              unit="ml"
              accent="#0EA5E9"
              note="Hydration target"
            />
            <VisualStatCard
              label="Day Score"
              value={dayScore}
              goal={100}
              unit="%"
              accent="#8B5CF6"
              note="Overall balance"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06 }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.95fr_0.95fr]"
          >
            <EnergyFlowCard meals={mealBars} />
            <MacroBalanceCard totals={dashboard.totals} goals={dashboard.goals} />
            <InsightPanel dashboard={dashboard} dayScore={dayScore} loggedMeals={loggedMeals} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.09 }}
          >
            <Card className={`${PANEL_CLASS} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                    <Apple className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
                    Meal summary
                  </div>
                  <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
                    Compact meal cards instead of a long one-column list.
                  </p>
                </div>
                <Badge variant="ghost" size="sm" className="dark:bg-white/[0.04] dark:text-white/70">
                  4-up layout
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {primaryMeals.map((meal) => (
                  <CompactMealTile
                    key={meal.mealSlot}
                    meal={meal}
                    calorieGoal={dashboard.goals.calories}
                  />
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]"
          >
            <GoalEditor
              goalDraft={goalDraft}
              setGoalDraft={setGoalDraft}
              onSave={() => void handleSaveGoals()}
              savingGoals={savingGoals}
            />
            <MicroNutrientGrid dashboard={dashboard} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className={`${PANEL_CLASS} p-4`}>
              <div className="flex flex-wrap items-center gap-3 text-sm text-day-text-secondary dark:text-white/55">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>{dashboard.dataSource.accuracyNote}</span>
              </div>
            </Card>
          </motion.div>
        </>
      ) : (
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.78fr]"
          >
            <Card className={`${PANEL_CLASS} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                    <Sparkles className="h-4 w-4 text-day-accent-primary dark:text-sky-400" />
                    Log meals with review-safe parsing
                  </div>
                  <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
                    Food matches are saved from the BioLift catalog. Unclear items stay honest and
                    get flagged for review.
                  </p>
                </div>
                <Badge variant="info" size="sm">
                  Supabase connected
                </Badge>
              </div>
            </Card>

            <Card className={`${PANEL_CLASS} p-5`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-day-text-primary dark:text-white">
                <Droplets className="h-4 w-4 text-cyan-500" />
                Hydration quick add
              </div>
              <p className="mt-1 text-sm text-day-text-secondary dark:text-white/50">
                Current water tracked: {Math.round(hydrationMeal?.totals.water ?? 0)} ml
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[250, 500, 750].map((amount) => (
                  <Button
                    key={amount}
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleHydrationAdd(amount)}
                    loading={activeAction === "log:hydration"}
                  >
                    +{amount} ml
                  </Button>
                ))}
              </div>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {MEAL_SLOTS.filter((slot) => slot.id !== "hydration").map((slot, index) => (
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: index * 0.03 }}
              >
                <MealCard
                  slot={slot}
                  meal={mealMap.get(slot.id)}
                  expanded={expandedMeal === slot.id}
                  inputValue={inputs[slot.id] ?? ""}
                  busy={activeAction === `log:${slot.id}` || activeAction === `clear:${slot.id}`}
                  onToggle={() => setExpandedMeal((current) => (current === slot.id ? null : slot.id))}
                  onInputChange={(value) =>
                    setInputs((current) => ({
                      ...current,
                      [slot.id]: value,
                    }))
                  }
                  onLog={() => void handleLog(slot.id, inputs[slot.id] ?? "")}
                  onClear={() => void handleClear(slot.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
