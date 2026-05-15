export const MEAL_SLOT_IDS = [
  "pre_workout",
  "breakfast",
  "mid_morning",
  "lunch",
  "evening_snack",
  "dinner",
  "hydration",
] as const;

export type MealSlotId = (typeof MEAL_SLOT_IDS)[number];

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  sugar: number;
  water: number;
  sodium: number;
  calcium: number;
  iron: number;
  vitaminC: number;
};

export type NutritionGoals = NutritionTotals;

export type NutrientDefinition = {
  key: keyof NutritionTotals;
  label: string;
  unit: string;
  accent: string;
};

export type MealSlotDefinition = {
  id: MealSlotId;
  label: string;
  time: string;
  shortLabel: string;
  accent: string;
};

export type RecognizedNutritionItem = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  servings: number;
  confidence: number;
  source: "catalog";
  totals: NutritionTotals;
};

export type NutritionLogRecord = {
  id: string;
  mealSlot: MealSlotId;
  description: string;
  recognizedItems: RecognizedNutritionItem[];
  unmatched: string[];
  confidence: number;
  reviewStatus: "reviewed" | "needs_review";
  source: "catalog" | "manual" | "mixed" | "usda" | "open_food_facts";
  totals: NutritionTotals;
  createdAt: string;
};

export type NutritionMealSummary = {
  mealSlot: MealSlotId;
  items: string[];
  totals: NutritionTotals;
  logCount: number;
  needsReview: boolean;
  logs: NutritionLogRecord[];
};

export type NutritionInsight = {
  title: string;
  body: string;
  tone: "success" | "warning" | "info";
};

export type NutritionDashboardData = {
  date: string;
  goals: NutritionGoals;
  totals: NutritionTotals;
  meals: NutritionMealSummary[];
  insight: NutritionInsight;
  reviewCount: number;
  dataSource: {
    mode: string;
    accuracyNote: string;
    recommendation: string;
  };
};

export type NutritionApiResponse = {
  dashboard: NutritionDashboardData;
  log?: NutritionLogRecord;
};
