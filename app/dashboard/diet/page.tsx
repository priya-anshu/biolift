"use client";

// LEGACY: dormant placeholder page. It is not linked from the active dashboard navigation.

import { motion } from "framer-motion";
import {
  Apple,
  Calculator,
  CheckCircle,
  Clock,
  DollarSign,
  Plus,
  ShoppingCart,
  Target,
  Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const mealPlans = [
  {
    id: 1,
    name: "Budget-Friendly Protein Pack",
    calories: 1800,
    protein: "120g",
    carbs: "180g",
    fat: "60g",
    cost: 35,
    duration: "7 days",
    meals: [
      "Oatmeal with banana",
      "Chicken rice bowl",
      "Greek yogurt with berries",
      "Tuna salad sandwich",
    ],
  },
  {
    id: 2,
    name: "Vegetarian Wellness",
    calories: 1600,
    protein: "80g",
    carbs: "200g",
    fat: "50g",
    cost: 40,
    duration: "7 days",
    meals: ["Smoothie bowl", "Quinoa salad", "Hummus wrap", "Lentil soup"],
  },
  {
    id: 3,
    name: "High-Performance Athlete",
    calories: 2200,
    protein: "150g",
    carbs: "250g",
    fat: "70g",
    cost: 65,
    duration: "7 days",
    meals: [
      "Protein pancakes",
      "Salmon with sweet potato",
      "Protein shake",
      "Lean beef stir-fry",
    ],
  },
];

const groceryList = [
  { name: "Chicken breast", quantity: "2 lbs", price: 8.99, category: "Protein" },
  { name: "Brown rice", quantity: "2 lbs", price: 3.99, category: "Grains" },
  { name: "Broccoli", quantity: "1 lb", price: 2.49, category: "Vegetables" },
  { name: "Greek yogurt", quantity: "32 oz", price: 4.99, category: "Dairy" },
  { name: "Bananas", quantity: "1 bunch", price: 1.99, category: "Fruits" },
  { name: "Eggs", quantity: "12 count", price: 3.49, category: "Protein" },
  { name: "Oatmeal", quantity: "1 lb", price: 2.99, category: "Grains" },
  { name: "Spinach", quantity: "1 lb", price: 2.99, category: "Vegetables" },
];

const nutritionGoals = {
  calories: { current: 1850, target: 2000 },
  protein: { current: 125, target: 150 },
  carbs: { current: 180, target: 200 },
  fat: { current: 55, target: 65 },
};

function getProgressColor(current: number, target: number) {
  const percentage = (current / target) * 100;
  if (percentage >= 90) return "text-emerald-600 dark:text-emerald-300";
  if (percentage >= 70) return "text-amber-500 dark:text-amber-300";
  return "text-rose-500 dark:text-rose-300";
}

export default function DietPage() {
  const [budget, setBudget] = useState(50);
  const [showCalorieCalculator, setShowCalorieCalculator] = useState(false);
  const [showMealSuggestions, setShowMealSuggestions] = useState(false);
  const [showMealPrepGuide, setShowMealPrepGuide] = useState(false);

  const groceryTotal = useMemo(
    () => groceryList.reduce((sum, item) => sum + item.price, 0),
    [],
  );

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-semibold">Nutrition & Diet</h1>
        <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
          Smart meal planning to fuel your goals.
        </p>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Weekly Budget
          </div>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Track your grocery spending for the week.
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="number"
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
            className="w-full rounded-lg border border-day-border bg-day-card px-4 py-2 text-sm text-day-text-primary placeholder-day-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:placeholder-night-text-secondary dark:focus:ring-night-accent sm:max-w-[200px]"
          />
          <button className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-night-accent">
            Update Budget
          </button>
          <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
            Planned spend: <span className="font-semibold">${groceryTotal.toFixed(2)}</span>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-day-border bg-day-card shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex items-center justify-between border-b border-day-border px-6 py-4 dark:border-night-border">
          <div>
            <h2 className="text-lg font-semibold">Recommended Meal Plans</h2>
            <p className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Balanced options tuned for your energy needs.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-day-border px-3 py-1 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
            <Plus className="h-4 w-4" />
            Create Custom
          </button>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-3">
          {mealPlans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-day-border bg-day-card p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-day-accent-primary px-2 py-1 font-semibold text-white dark:bg-night-accent">
                  ${plan.cost}
                </span>
                <span className="rounded-full bg-day-hover px-2 py-1 font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                  {plan.duration}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{plan.name}</h3>
              <div className="mt-3 space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
                <div className="flex items-center justify-between">
                  <span>Calories</span>
                  <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {plan.calories}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Protein</span>
                  <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {plan.protein}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Carbs</span>
                  <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {plan.carbs}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fat</span>
                  <span className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    {plan.fat}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-day-text-secondary dark:text-night-text-secondary">
                <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                  Sample Meals
                </div>
                {plan.meals.slice(0, 3).map((meal) => (
                  <div key={meal} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    {meal}
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-lg bg-day-accent-secondary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent">
                Select Plan
              </button>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
            Today&apos;s Nutrition
          </div>
          <div className="mt-4 space-y-4">
            {Object.entries(nutritionGoals).map(([nutrient, values]) => {
              const progress = Math.min((values.current / values.target) * 100, 100);
              return (
                <div key={nutrient} className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{nutrient}</span>
                    <span className={getProgressColor(values.current, values.target)}>
                      {values.current}/{values.target}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-day-border dark:bg-night-border">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
              Grocery List
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-day-border px-3 py-1 text-sm font-semibold text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {groceryList.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-xl border border-day-border px-3 py-2 text-sm text-day-text-secondary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-day-border text-day-accent-primary focus:ring-day-accent-primary dark:border-night-border dark:text-night-accent dark:focus:ring-night-accent"
                  />
                  <div>
                    <div className="font-medium text-day-text-primary dark:text-night-text-primary">
                      {item.name}
                    </div>
                    <div className="text-xs text-day-text-secondary dark:text-night-text-secondary">
                      {item.quantity}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-day-text-primary dark:text-night-text-primary">
                    ${item.price}
                  </div>
                  <span className="mt-1 inline-flex rounded-full bg-day-hover px-2 py-0.5 text-[11px] font-semibold text-day-text-secondary dark:bg-night-hover dark:text-night-text-secondary">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-day-border pt-4 text-sm font-semibold text-day-text-primary dark:border-night-border dark:text-night-text-primary">
            Total:{" "}
            <span className="text-day-accent-primary dark:text-night-accent">
              ${groceryTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-2xl border border-day-border bg-day-card p-6 shadow-card dark:border-night-border dark:bg-night-card dark:shadow-card-dark"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Utensils className="h-4 w-4 text-day-accent-primary dark:text-night-accent" />
          Quick Actions
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <button
            onClick={() => setShowCalorieCalculator(true)}
            className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-day-border text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
          >
            <Calculator className="h-5 w-5" />
            Calorie Calculator
          </button>
          <button
            onClick={() => setShowMealSuggestions(true)}
            className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-day-border text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
          >
            <Apple className="h-5 w-5" />
            Meal Suggestions
          </button>
          <button
            onClick={() => setShowMealPrepGuide(true)}
            className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-day-border text-sm font-semibold text-day-text-primary transition hover:bg-day-hover dark:border-night-border dark:text-night-text-primary dark:hover:bg-night-hover"
          >
            <Clock className="h-5 w-5" />
            Meal Prep Guide
          </button>
        </div>
      </motion.section>

      {(showCalorieCalculator || showMealSuggestions || showMealPrepGuide) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-day-border bg-day-card p-6 shadow-lg dark:border-night-border dark:bg-night-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {showCalorieCalculator && "Calorie Calculator"}
                {showMealSuggestions && "Meal Suggestions"}
                {showMealPrepGuide && "Meal Prep Guide"}
              </h3>
              <button
                className="rounded-full border border-day-border px-3 py-1 text-sm text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"
                onClick={() => {
                  setShowCalorieCalculator(false);
                  setShowMealSuggestions(false);
                  setShowMealPrepGuide(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
              {showCalorieCalculator && (
                <p>
                  Estimate your daily calories using your activity level and goals.
                  We’ll add the full calculator widget in the next sprint.
                </p>
              )}
              {showMealSuggestions && (
                <p>
                  Get AI-assisted meal ideas tailored to your macros and budget.
                  Connect this to your nutrition plan to unlock personal recipes.
                </p>
              )}
              {showMealPrepGuide && (
                <p>
                  Prep smart: batch proteins, portion carbs, and stock veggies to
                  hit your targets all week.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
