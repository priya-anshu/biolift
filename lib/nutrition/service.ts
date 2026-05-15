import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_NUTRITION_GOALS,
  MEAL_SLOTS,
  PRIMARY_MEAL_SLOT_IDS,
  addNutritionTotals,
  createEmptyNutritionTotals,
  roundNutritionTotals,
} from "@/lib/nutrition/config";
import { parseNutritionText } from "@/lib/nutrition/parser";
import type {
  MealSlotId,
  NutritionApiResponse,
  NutritionDashboardData,
  NutritionGoals,
  NutritionInsight,
  NutritionLogRecord,
  NutritionMealSummary,
  NutritionTotals,
  RecognizedNutritionItem,
} from "@/lib/nutrition/types";

type NutritionContext = {
  client: SupabaseClient;
  profileId: string;
};

type NutritionLogInsertInput = {
  date: string;
  mealSlot: MealSlotId;
  description: string;
};

type NutritionGoalUpdateInput = Partial<
  Pick<NutritionGoals, "calories" | "protein" | "carbs" | "fiber" | "fat" | "water">
>;

type NutritionGoalRow = {
  user_id: string;
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fiber_target_g: number;
  fat_target_g: number;
  sugar_target_g: number;
  water_target_ml: number;
  sodium_target_mg: number;
  calcium_target_mg: number;
  iron_target_mg: number;
  vitamin_c_target_mg: number;
};

type NutritionLogRow = {
  id: string;
  meal_slot: MealSlotId;
  description: string;
  recognized_items: RecognizedNutritionItem[];
  unmatched_tokens: string[] | null;
  confidence_score: number;
  review_status: "reviewed" | "needs_review";
  source: "catalog" | "manual" | "mixed" | "usda" | "open_food_facts";
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
  fat_g: number;
  sugar_g: number;
  water_ml: number;
  sodium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  vitamin_c_mg: number;
  created_at: string;
};

function nutritionDbErrorMessage(message: string) {
  if (
    message.includes("nutrition_goals") ||
    message.includes("nutrition_logs") ||
    message.includes('relation "nutrition_')
  ) {
    return "Nutrition tables are not installed yet. Run database/nutrition/001_nutrition_tracking.sql first.";
  }

  return message;
}

function assertNoDbError(error: { message: string } | null) {
  if (!error) return;
  throw new Error(nutritionDbErrorMessage(error.message));
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertDate(value: string) {
  if (!isValidDate(value)) {
    throw new Error("Invalid date. Use YYYY-MM-DD.");
  }
}

function mapGoalRow(row: NutritionGoalRow | null | undefined): NutritionGoals {
  if (!row) {
    return DEFAULT_NUTRITION_GOALS;
  }

  return {
    calories: Number(row.calories_target ?? DEFAULT_NUTRITION_GOALS.calories),
    protein: Number(row.protein_target_g ?? DEFAULT_NUTRITION_GOALS.protein),
    carbs: Number(row.carbs_target_g ?? DEFAULT_NUTRITION_GOALS.carbs),
    fiber: Number(row.fiber_target_g ?? DEFAULT_NUTRITION_GOALS.fiber),
    fat: Number(row.fat_target_g ?? DEFAULT_NUTRITION_GOALS.fat),
    sugar: Number(row.sugar_target_g ?? DEFAULT_NUTRITION_GOALS.sugar),
    water: Number(row.water_target_ml ?? DEFAULT_NUTRITION_GOALS.water),
    sodium: Number(row.sodium_target_mg ?? DEFAULT_NUTRITION_GOALS.sodium),
    calcium: Number(row.calcium_target_mg ?? DEFAULT_NUTRITION_GOALS.calcium),
    iron: Number(row.iron_target_mg ?? DEFAULT_NUTRITION_GOALS.iron),
    vitaminC: Number(row.vitamin_c_target_mg ?? DEFAULT_NUTRITION_GOALS.vitaminC),
  };
}

function goalRowFromTotals(profileId: string, goals: NutritionGoals) {
  return {
    user_id: profileId,
    calories_target: Math.round(goals.calories),
    protein_target_g: Number(goals.protein.toFixed(1)),
    carbs_target_g: Number(goals.carbs.toFixed(1)),
    fiber_target_g: Number(goals.fiber.toFixed(1)),
    fat_target_g: Number(goals.fat.toFixed(1)),
    sugar_target_g: Number(goals.sugar.toFixed(1)),
    water_target_ml: Math.round(goals.water),
    sodium_target_mg: Number(goals.sodium.toFixed(1)),
    calcium_target_mg: Number(goals.calcium.toFixed(1)),
    iron_target_mg: Number(goals.iron.toFixed(1)),
    vitamin_c_target_mg: Number(goals.vitaminC.toFixed(1)),
  };
}

function nutritionTotalsFromRow(row: NutritionLogRow): NutritionTotals {
  return roundNutritionTotals({
    calories: Number(row.calories_kcal ?? 0),
    protein: Number(row.protein_g ?? 0),
    carbs: Number(row.carbs_g ?? 0),
    fiber: Number(row.fiber_g ?? 0),
    fat: Number(row.fat_g ?? 0),
    sugar: Number(row.sugar_g ?? 0),
    water: Number(row.water_ml ?? 0),
    sodium: Number(row.sodium_mg ?? 0),
    calcium: Number(row.calcium_mg ?? 0),
    iron: Number(row.iron_mg ?? 0),
    vitaminC: Number(row.vitamin_c_mg ?? 0),
  });
}

function mapLogRow(row: NutritionLogRow): NutritionLogRecord {
  return {
    id: row.id,
    mealSlot: row.meal_slot,
    description: row.description,
    recognizedItems: Array.isArray(row.recognized_items) ? row.recognized_items : [],
    unmatched: row.unmatched_tokens ?? [],
    confidence: Number(Number(row.confidence_score ?? 0).toFixed(2)),
    reviewStatus: row.review_status,
    source: row.source,
    totals: nutritionTotalsFromRow(row),
    createdAt: row.created_at,
  };
}

function buildMealSummaries(logs: NutritionLogRecord[]) {
  const bySlot = new Map<MealSlotId, NutritionMealSummary>();

  for (const slot of MEAL_SLOTS) {
    bySlot.set(slot.id, {
      mealSlot: slot.id,
      items: [],
      totals: createEmptyNutritionTotals(),
      logCount: 0,
      needsReview: false,
      logs: [],
    });
  }

  for (const log of logs) {
    const current = bySlot.get(log.mealSlot);
    if (!current) continue;

    current.logs.push(log);
    current.logCount += 1;
    current.needsReview = current.needsReview || log.reviewStatus === "needs_review";
    current.totals = addNutritionTotals(current.totals, log.totals);
    current.items.push(
      ...log.recognizedItems.map((item) => {
        const quantity = item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(1);
        return `${quantity} ${item.unit} ${item.label}`;
      }),
    );
  }

  return MEAL_SLOTS.map((slot) => {
    const meal = bySlot.get(slot.id)!;
    return {
      ...meal,
      totals: roundNutritionTotals(meal.totals),
    };
  });
}

function buildInsight(
  totals: NutritionTotals,
  goals: NutritionGoals,
  reviewCount: number,
): NutritionInsight {
  if (reviewCount > 0) {
    return {
      title: "Review a few entries",
      body:
        "Some foods were only partially matched to the BioLift catalog, so their totals are saved but marked for a quick manual review instead of guessing.",
      tone: "warning",
    };
  }

  if (totals.protein < goals.protein * 0.65) {
    return {
      title: "Protein is behind",
      body:
        "You are still short on protein for the day. Lean chicken, paneer, eggs, curd, or whey would lift the score fastest without forcing carbs too high.",
      tone: "info",
    };
  }

  if (totals.water < goals.water * 0.6) {
    return {
      title: "Hydration needs work",
      body:
        "Water intake is running low versus your target. Keep the quick-add hydration controls moving through the day so recovery and workout quality do not dip.",
      tone: "warning",
    };
  }

  if (totals.calories > goals.calories * 1.08) {
    return {
      title: "Calories are already ahead",
      body:
        "The day is trending above your calorie target. Keep the remaining meals cleaner and bias toward protein, vegetables, and fluids.",
      tone: "warning",
    };
  }

  return {
    title: "Tracker is on pace",
    body:
      "Your logged food is within a healthy range for the day. Keep protein steady across the remaining meals and use the hydration quick-add to finish strong.",
    tone: "success",
  };
}

async function ensureNutritionGoals(context: NutritionContext) {
  const existing = await context.client
    .from("nutrition_goals")
    .select(
      "user_id,calories_target,protein_target_g,carbs_target_g,fiber_target_g,fat_target_g,sugar_target_g,water_target_ml,sodium_target_mg,calcium_target_mg,iron_target_mg,vitamin_c_target_mg",
    )
    .eq("user_id", context.profileId)
    .maybeSingle<NutritionGoalRow>();

  assertNoDbError(existing.error);

  if (existing.data) {
    return mapGoalRow(existing.data);
  }

  const inserted = await context.client
    .from("nutrition_goals")
    .upsert(goalRowFromTotals(context.profileId, DEFAULT_NUTRITION_GOALS), {
      onConflict: "user_id",
    })
    .select(
      "user_id,calories_target,protein_target_g,carbs_target_g,fiber_target_g,fat_target_g,sugar_target_g,water_target_ml,sodium_target_mg,calcium_target_mg,iron_target_mg,vitamin_c_target_mg",
    )
    .single<NutritionGoalRow>();

  assertNoDbError(inserted.error);
  if (!inserted.data) {
    throw new Error("Nutrition goals could not be created.");
  }

  return mapGoalRow(inserted.data);
}

export async function getNutritionDashboard(
  context: NutritionContext,
  date: string,
): Promise<NutritionDashboardData> {
  assertDate(date);

  const [goals, logRes] = await Promise.all([
    ensureNutritionGoals(context),
    context.client
      .from("nutrition_logs")
      .select(
        "id,meal_slot,description,recognized_items,unmatched_tokens,confidence_score,review_status,source,calories_kcal,protein_g,carbs_g,fiber_g,fat_g,sugar_g,water_ml,sodium_mg,calcium_mg,iron_mg,vitamin_c_mg,created_at",
      )
      .eq("user_id", context.profileId)
      .eq("log_date", date)
      .order("created_at", { ascending: true }),
  ]);

  assertNoDbError(logRes.error);

  const logs = ((logRes.data ?? []) as NutritionLogRow[]).map(mapLogRow);
  const meals = buildMealSummaries(logs);
  const totals = roundNutritionTotals(
    meals.reduce(
      (sum, meal) => addNutritionTotals(sum, meal.totals),
      createEmptyNutritionTotals(),
    ),
  );
  const reviewCount = logs.filter((log) => log.reviewStatus === "needs_review").length;

  return {
    date,
    goals,
    totals,
    meals,
    insight: buildInsight(totals, goals, reviewCount),
    reviewCount,
    dataSource: {
      mode: "BioLift standard food catalog",
      accuracyNote:
        "This tracker uses a deterministic food catalog and refuses to hallucinate unknown nutrition values. Unclear foods are saved with a review flag instead of fake precision.",
      recommendation:
        "For broader packaged-food coverage later, we can add USDA FoodData Central or Open Food Facts as an optional lookup layer.",
    },
  };
}

export async function logNutritionEntry(
  context: NutritionContext,
  input: NutritionLogInsertInput,
) {
  assertDate(input.date);
  const description = input.description.trim();
  if (description.length < 2) {
    throw new Error("Add a little more detail before logging the meal.");
  }

  const parsed = parseNutritionText(description);
  if (parsed.items.length === 0) {
    throw new Error(
      "No supported foods were matched. Try comma-separated items like '2 chapati, 1 bowl dal, 1 tsp ghee'.",
    );
  }

  const inserted = await context.client
    .from("nutrition_logs")
    .insert({
      user_id: context.profileId,
      log_date: input.date,
      meal_slot: input.mealSlot,
      description,
      recognized_items: parsed.items,
      unmatched_tokens: parsed.unmatched,
      confidence_score: parsed.confidence,
      review_status: parsed.reviewStatus,
      source: parsed.source,
      calories_kcal: parsed.totals.calories,
      protein_g: parsed.totals.protein,
      carbs_g: parsed.totals.carbs,
      fiber_g: parsed.totals.fiber,
      fat_g: parsed.totals.fat,
      sugar_g: parsed.totals.sugar,
      water_ml: parsed.totals.water,
      sodium_mg: parsed.totals.sodium,
      calcium_mg: parsed.totals.calcium,
      iron_mg: parsed.totals.iron,
      vitamin_c_mg: parsed.totals.vitaminC,
    })
    .select(
      "id,meal_slot,description,recognized_items,unmatched_tokens,confidence_score,review_status,source,calories_kcal,protein_g,carbs_g,fiber_g,fat_g,sugar_g,water_ml,sodium_mg,calcium_mg,iron_mg,vitamin_c_mg,created_at",
    )
    .single<NutritionLogRow>();

  assertNoDbError(inserted.error);
  if (!inserted.data) {
    throw new Error("Nutrition log entry could not be saved.");
  }

  return mapLogRow(inserted.data);
}

export async function clearNutritionMeal(
  context: NutritionContext,
  date: string,
  mealSlot: MealSlotId,
) {
  assertDate(date);

  const deleted = await context.client
    .from("nutrition_logs")
    .delete()
    .eq("user_id", context.profileId)
    .eq("log_date", date)
    .eq("meal_slot", mealSlot);

  assertNoDbError(deleted.error);
}

export async function updateNutritionGoals(
  context: NutritionContext,
  updates: NutritionGoalUpdateInput,
) {
  const currentGoals = await ensureNutritionGoals(context);
  const nextGoals: NutritionGoals = {
    ...currentGoals,
    ...updates,
  };

  const updated = await context.client
    .from("nutrition_goals")
    .upsert(goalRowFromTotals(context.profileId, nextGoals), {
      onConflict: "user_id",
    })
    .select(
      "user_id,calories_target,protein_target_g,carbs_target_g,fiber_target_g,fat_target_g,sugar_target_g,water_target_ml,sodium_target_mg,calcium_target_mg,iron_target_mg,vitamin_c_target_mg",
    )
    .single<NutritionGoalRow>();

  assertNoDbError(updated.error);
  if (!updated.data) {
    throw new Error("Nutrition goals could not be updated.");
  }

  return mapGoalRow(updated.data);
}

export function getMealSlot(mealSlot: MealSlotId) {
  return MEAL_SLOTS.find((slot) => slot.id === mealSlot);
}

export function getPrimaryMealSlots() {
  return PRIMARY_MEAL_SLOT_IDS;
}

export async function buildNutritionResponse(
  context: NutritionContext,
  date: string,
  log?: NutritionLogRecord,
): Promise<NutritionApiResponse> {
  return {
    dashboard: await getNutritionDashboard(context, date),
    ...(log ? { log } : {}),
  };
}
