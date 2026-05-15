import { FOOD_CATALOG, type CatalogFood, type CatalogUnit } from "@/lib/nutrition/catalog";
import {
  addNutritionTotals,
  createEmptyNutritionTotals,
  roundNutritionTotals,
  scaleNutritionTotals,
} from "@/lib/nutrition/config";
import type { RecognizedNutritionItem } from "@/lib/nutrition/types";

type ParsedSegment = {
  quantity: number | null;
  unit: CatalogUnit | null;
  text: string;
  raw: string;
};

export type ParsedNutritionResult = {
  items: RecognizedNutritionItem[];
  unmatched: string[];
  confidence: number;
  reviewStatus: "reviewed" | "needs_review";
  source: "catalog" | "mixed";
  totals: ReturnType<typeof createEmptyNutritionTotals>;
};

const UNIT_ALIASES: Array<{ pattern: RegExp; unit: CatalogUnit }> = [
  { pattern: /^(ml|milliliter|milliliters|millilitre|millilitres)\b/, unit: "ml" },
  { pattern: /^(g|gm|gram|grams)\b/, unit: "gram" },
  { pattern: /^(cups|cup)\b/, unit: "cup" },
  { pattern: /^(bowls|bowl)\b/, unit: "bowl" },
  { pattern: /^(tsp|teaspoon|teaspoons)\b/, unit: "teaspoon" },
  { pattern: /^(tbsp|tablespoon|tablespoons)\b/, unit: "tablespoon" },
  { pattern: /^(glasses|glass)\b/, unit: "glass" },
  { pattern: /^(slices|slice)\b/, unit: "slice" },
  { pattern: /^(scoops|scoop)\b/, unit: "scoop" },
  { pattern: /^(pieces|piece)\b/, unit: "piece" },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  half: 0.5,
  quarter: 0.25,
};

const SORTED_CATALOG = FOOD_CATALOG.slice().sort((left, right) => {
  const leftAlias = Math.max(...left.aliases.map((alias) => alias.length));
  const rightAlias = Math.max(...right.aliases.map((alias) => alias.length));
  return rightAlias - leftAlias;
});

function parseFraction(value: string) {
  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map((part) => Number(part));
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
    return top / bottom;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInput(raw: string) {
  return normalizeWhitespace(
    raw
      .toLowerCase()
      .replace(/[()]/g, " ")
      .replace(/\bin (chai|tea|coffee)\b/g, ", $1")
      .replace(/\bwith\b/g, ", ")
      .replace(/[|]/g, ",")
      .replace(/\s*&\s*/g, ", ")
      .replace(/\s*\+\s*/g, ", "),
  );
}

function splitSegments(raw: string) {
  return normalizeInput(raw)
    .split(/,|;|\n|\band\b/)
    .map((segment) => normalizeWhitespace(segment.replace(/\bof\b/g, " ")))
    .filter(Boolean);
}

function extractLeadingQuantity(segment: string): ParsedSegment {
  let working = segment.trim();
  let quantity: number | null = null;
  let unit: CatalogUnit | null = null;

  const leadingMatch = working.match(/^(\d+(?:\.\d+)?|\d+\/\d+|a|an|one|two|three|four|five|half|quarter)\b/);
  if (leadingMatch?.[1]) {
    const matched = leadingMatch[1];
    quantity =
      NUMBER_WORDS[matched] ??
      parseFraction(matched) ??
      null;
    working = working.slice(leadingMatch[0].length).trim();
  }

  for (const definition of UNIT_ALIASES) {
    const unitMatch = working.match(definition.pattern);
    if (!unitMatch) continue;
    unit = definition.unit;
    working = working.slice(unitMatch[0].length).trim();
    break;
  }

  return {
    quantity,
    unit,
    text: working,
    raw: segment,
  };
}

function findCatalogFood(segmentText: string) {
  for (const food of SORTED_CATALOG) {
    const alias = food.aliases.find((candidate) =>
      new RegExp(`(^|\\b)${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`).test(
        segmentText,
      ),
    );
    if (alias) {
      return { food, alias };
    }
  }

  return null;
}

function resolveServings(
  food: CatalogFood,
  quantity: number | null,
  unit: CatalogUnit | null,
) {
  if (unit && food.unitMultipliers[unit] !== undefined) {
    return {
      servings: (quantity ?? 1) * Number(food.unitMultipliers[unit]),
      confidence: quantity === null ? 0.88 : 0.98,
      unitLabel: unit,
      quantity: quantity ?? 1,
    };
  }

  if (quantity !== null) {
    if (food.defaultUnit === "piece" || food.defaultUnit === "slice" || food.defaultUnit === "scoop") {
      return {
        servings: quantity,
        confidence: 0.92,
        unitLabel: food.defaultUnit,
        quantity,
      };
    }
    if (food.defaultUnit === "bowl" || food.defaultUnit === "cup" || food.defaultUnit === "glass") {
      return {
        servings: quantity,
        confidence: 0.9,
        unitLabel: food.defaultUnit,
        quantity,
      };
    }
    return null;
  }

  return {
    servings: 1,
    confidence: 0.86,
    unitLabel: food.defaultUnit,
    quantity: food.defaultAmount,
  };
}

function buildRecognizedItem(segment: ParsedSegment) {
  const candidate = findCatalogFood(segment.text || segment.raw);
  if (!candidate) return null;

  const resolved = resolveServings(candidate.food, segment.quantity, segment.unit);
  if (!resolved || resolved.servings <= 0) return null;

  const totals = roundNutritionTotals(
    scaleNutritionTotals(candidate.food.nutrients, resolved.servings),
  );

  const item: RecognizedNutritionItem = {
    id: candidate.food.id,
    label: candidate.food.name,
    quantity: Number(resolved.quantity.toFixed(2)),
    unit: resolved.unitLabel,
    servings: Number(resolved.servings.toFixed(3)),
    confidence: Number(resolved.confidence.toFixed(2)),
    source: "catalog",
    totals,
  };

  return item;
}

export function parseNutritionText(description: string): ParsedNutritionResult {
  const segments = splitSegments(description);
  const items: RecognizedNutritionItem[] = [];
  const unmatched: string[] = [];
  let combinedTotals = createEmptyNutritionTotals();

  for (const rawSegment of segments) {
    const parsedSegment = extractLeadingQuantity(rawSegment);
    const item = buildRecognizedItem(parsedSegment);
    if (!item) {
      unmatched.push(rawSegment);
      continue;
    }

    items.push(item);
    combinedTotals = addNutritionTotals(combinedTotals, item.totals);
  }

  const averageConfidence =
    items.length > 0
      ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
      : 0;
  const adjustedConfidence =
    unmatched.length > 0
      ? Math.max(0.45, averageConfidence - unmatched.length * 0.1)
      : averageConfidence;

  return {
    items,
    unmatched,
    confidence: Number(adjustedConfidence.toFixed(2)),
    reviewStatus: unmatched.length > 0 ? "needs_review" : "reviewed",
    source: unmatched.length > 0 ? "mixed" : "catalog",
    totals: roundNutritionTotals(combinedTotals),
  };
}
