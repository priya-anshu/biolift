import type {
  MealSlotDefinition,
  MealSlotId,
  NutrientDefinition,
  NutritionGoals,
  NutritionTotals,
} from "@/lib/nutrition/types";

export const MEAL_SLOTS: MealSlotDefinition[] = [
  {
    id: "pre_workout",
    label: "Pre-Workout",
    time: "5 AM - 7 AM",
    shortLabel: "PW",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    id: "breakfast",
    label: "Breakfast",
    time: "7 AM - 9 AM",
    shortLabel: "B",
    accent: "from-amber-500 to-orange-500",
  },
  {
    id: "mid_morning",
    label: "Mid-Morning",
    time: "10 AM - 11 AM",
    shortLabel: "MM",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    id: "lunch",
    label: "Lunch",
    time: "12 PM - 2 PM",
    shortLabel: "L",
    accent: "from-sky-500 to-blue-600",
  },
  {
    id: "evening_snack",
    label: "Evening Snack",
    time: "4 PM - 6 PM",
    shortLabel: "ES",
    accent: "from-pink-500 to-rose-500",
  },
  {
    id: "dinner",
    label: "Dinner",
    time: "7 PM - 9 PM",
    shortLabel: "D",
    accent: "from-slate-700 to-slate-900 dark:from-red-600 dark:to-red-800",
  },
  {
    id: "hydration",
    label: "Hydration",
    time: "Any time",
    shortLabel: "H2O",
    accent: "from-cyan-500 to-blue-500",
  },
];

export const PRIMARY_MEAL_SLOT_IDS = MEAL_SLOTS.filter(
  (slot) => slot.id !== "hydration",
).map((slot) => slot.id) as MealSlotId[];

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  { key: "calories", label: "Calories", unit: "kcal", accent: "from-orange-500 to-red-500" },
  { key: "protein", label: "Protein", unit: "g", accent: "from-sky-500 to-blue-600" },
  { key: "carbs", label: "Carbs", unit: "g", accent: "from-yellow-500 to-amber-500" },
  { key: "fiber", label: "Fiber", unit: "g", accent: "from-emerald-500 to-green-600" },
  { key: "fat", label: "Fat", unit: "g", accent: "from-fuchsia-500 to-pink-500" },
  { key: "sugar", label: "Sugar", unit: "g", accent: "from-rose-500 to-pink-500" },
  { key: "water", label: "Water", unit: "ml", accent: "from-cyan-500 to-blue-500" },
  { key: "sodium", label: "Sodium", unit: "mg", accent: "from-red-500 to-rose-600" },
  { key: "calcium", label: "Calcium", unit: "mg", accent: "from-lime-500 to-green-500" },
  { key: "iron", label: "Iron", unit: "mg", accent: "from-amber-600 to-orange-600" },
  { key: "vitaminC", label: "Vitamin C", unit: "mg", accent: "from-orange-400 to-orange-600" },
];

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  calories: 2200,
  protein: 140,
  carbs: 220,
  fiber: 30,
  fat: 70,
  sugar: 36,
  water: 3000,
  sodium: 2300,
  calcium: 1000,
  iron: 18,
  vitaminC: 90,
};

export function createEmptyNutritionTotals(): NutritionTotals {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fiber: 0,
    fat: 0,
    sugar: 0,
    water: 0,
    sodium: 0,
    calcium: 0,
    iron: 0,
    vitaminC: 0,
  };
}

export function addNutritionTotals(
  base: NutritionTotals,
  next: NutritionTotals,
): NutritionTotals {
  return {
    calories: base.calories + next.calories,
    protein: base.protein + next.protein,
    carbs: base.carbs + next.carbs,
    fiber: base.fiber + next.fiber,
    fat: base.fat + next.fat,
    sugar: base.sugar + next.sugar,
    water: base.water + next.water,
    sodium: base.sodium + next.sodium,
    calcium: base.calcium + next.calcium,
    iron: base.iron + next.iron,
    vitaminC: base.vitaminC + next.vitaminC,
  };
}

export function scaleNutritionTotals(
  totals: NutritionTotals,
  multiplier: number,
): NutritionTotals {
  return {
    calories: totals.calories * multiplier,
    protein: totals.protein * multiplier,
    carbs: totals.carbs * multiplier,
    fiber: totals.fiber * multiplier,
    fat: totals.fat * multiplier,
    sugar: totals.sugar * multiplier,
    water: totals.water * multiplier,
    sodium: totals.sodium * multiplier,
    calcium: totals.calcium * multiplier,
    iron: totals.iron * multiplier,
    vitaminC: totals.vitaminC * multiplier,
  };
}

export function roundNutritionTotals(totals: NutritionTotals): NutritionTotals {
  const round = (value: number) => Number(value.toFixed(1));

  return {
    calories: round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fiber: round(totals.fiber),
    fat: round(totals.fat),
    sugar: round(totals.sugar),
    water: Math.round(totals.water),
    sodium: round(totals.sodium),
    calcium: round(totals.calcium),
    iron: round(totals.iron),
    vitaminC: round(totals.vitaminC),
  };
}

export function toPercent(current: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min((current / goal) * 100, 100));
}
