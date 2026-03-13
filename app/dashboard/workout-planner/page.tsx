"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Search, Sparkles, Wand2 } from "lucide-react";
import Card from "@/components/ui/Card";

type Action = "increase" | "maintain" | "reduce" | "deload" | "substitute";
type Plan = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  workout_days_per_week: number;
  muscle_split: unknown;
  planning_mode: "smart" | "manual";
  is_active: boolean;
};
type PlanExercise = {
  id: string;
  plan_id: string;
  day_index: number;
  exercise_order: number;
  exercise_id: string | null;
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
  rpe: number | null;
  superset_group: string | null;
  difficulty_level: string;
  equipment_required: string[];
};
type ExerciseCatalog = {
  id: string;
  name: string;
  target_muscle: string;
  difficulty_level: string;
  equipment_required: string[];
};
type TodayResponse = {
  cacheState: string;
  plan: { id: string; name: string } | null;
  previewExercises: Array<{
    plan_exercise_id: string;
    exercise_name: string;
    recommended_sets: number;
    recommended_reps: { min: number; max: number };
    recommended_weight: number | null;
    rest_seconds: number;
    progression_action: Action;
    recommendation_reason: string[];
  }>;
  error?: string;
};

const templates = {
  strength: { sets: 5, repsMin: 5, repsMax: 5, rest: 180, label: "Strength 5x5" },
  hypertrophy: { sets: 4, repsMin: 8, repsMax: 12, rest: 90, label: "Hypertrophy 4x8-12" },
  endurance: { sets: 3, repsMin: 12, repsMax: 15, rest: 60, label: "Endurance 3x12-15" },
} as const;

function nice(text: string) {
  return text.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function badge(action: Action) {
  if (action === "increase") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (action === "maintain") return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  if (action === "reduce") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (action === "deload") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
}
function superset(value: string) {
  const out = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return out.length ? out.slice(0, 8) : null;
}
function normalize(rows: PlanExercise[]) {
  const sorted = [...rows].sort((a, b) => a.day_index - b.day_index || a.exercise_order - b.exercise_order);
  const perDay = new Map<number, number>();
  return sorted.map((row) => {
    const day = Math.max(1, Math.min(7, Math.floor(Number(row.day_index) || 1)));
    const ord = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, ord);
    return {
      ...row,
      day_index: day,
      exercise_order: ord,
      sets: Math.max(1, Math.min(20, Math.floor(Number(row.sets) || 3))),
      reps_min: Math.max(1, Math.min(120, Math.floor(Number(row.reps_min) || 8))),
      reps_max: Math.max(1, Math.min(120, Math.floor(Number(row.reps_max) || 12))),
      rest_seconds: Math.max(15, Math.min(900, Math.floor(Number(row.rest_seconds) || 60))),
      superset_group: row.superset_group ? superset(row.superset_group) : null,
    };
  });
}
function newRow(planId: string, day: number, item: ExerciseCatalog): PlanExercise {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    plan_id: planId,
    day_index: day,
    exercise_order: 1,
    exercise_id: item.id,
    exercise_name: item.name,
    muscle_group: item.target_muscle,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    rest_seconds: 90,
    rpe: 7,
    superset_group: null,
    difficulty_level: item.difficulty_level || "intermediate",
    equipment_required: item.equipment_required ?? [],
  };
}

export default function WorkoutPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [showFull, setShowFull] = useState(false);

  const [rows, setRows] = useState<PlanExercise[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [libraryDay, setLibraryDay] = useState(1);
  const [results, setResults] = useState<ExerciseCatalog[]>([]);
  const [suggestions, setSuggestions] = useState<ExerciseCatalog[]>([]);
  const [searching, setSearching] = useState(false);

  const [customName, setCustomName] = useState("");
  const [customMuscle, setCustomMuscle] = useState("chest");
  const [creating, setCreating] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans.find((p) => p.is_active) ?? null,
    [plans, selectedPlanId],
  );
  const byDay = useMemo(() => {
    const map = new Map<number, PlanExercise[]>();
    rows.forEach((row) => {
      const cur = map.get(row.day_index) ?? [];
      cur.push(row);
      map.set(row.day_index, cur);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/workout-planner/plans", { cache: "no-store" });
    const body = (await res.json()) as { plans?: Plan[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Failed to load plans");
    const items = body.plans ?? [];
    setPlans(items);
    setSelectedPlanId((cur) => cur && items.some((p) => p.id === cur) ? cur : (items.find((p) => p.is_active)?.id ?? items[0]?.id ?? null));
  }, []);

  const loadToday = useCallback(async (planId: string) => {
    const res = await fetch(`/api/workout/today?planId=${planId}&lookbackDays=42`, { cache: "no-store" });
    const body = (await res.json()) as TodayResponse;
    if (!res.ok) throw new Error(body.error ?? "Failed to load workout");
    setToday(body);
  }, []);

  const loadPlanDetail = useCallback(async (planId: string) => {
    const res = await fetch(`/api/workout-planner/plans/${planId}`, { cache: "no-store" });
    const body = (await res.json()) as { exercises?: PlanExercise[]; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Failed to load plan detail");
    setRows(normalize(body.exercises ?? []));
    setDirty(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadPlans().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, [loadPlans]);

  useEffect(() => {
    if (!selectedPlanId) return;
    void Promise.all([loadToday(selectedPlanId), loadPlanDetail(selectedPlanId)]).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed"),
    );
  }, [loadToday, loadPlanDetail, selectedPlanId]);

  const generatePlan = async () => {
    const res = await fetch("/api/workout-planner/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "AI Smart Program", goal: "hypertrophy", experienceLevel: "intermediate", workoutDaysPerWeek: 4, preferredEquipment: ["barbell", "dumbbells"], visibility: "private" }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Failed to generate");
    await loadPlans();
    setNotice("Plan generated.");
  };

  const updateRow = (id: string, fn: (r: PlanExercise) => PlanExercise) => {
    setRows((cur) => normalize(cur.map((r) => (r.id === id ? fn(r) : r))));
    setDirty(true);
  };

  const saveBuilder = async () => {
    if (!selectedPlanId || rows.length === 0) return;
    setSaving(true);
    try {
      const exercises = normalize(rows).map((r) => ({ dayIndex: r.day_index, exerciseOrder: r.exercise_order, exerciseId: r.exercise_id, exerciseName: r.exercise_name, muscleGroup: r.muscle_group, sets: r.sets, repsMin: r.reps_min, repsMax: r.reps_max, restSeconds: r.rest_seconds, tempo: "2-0-2", rpe: r.rpe ?? 7, notes: "", supersetGroup: r.superset_group, difficultyLevel: (r.difficulty_level === "beginner" || r.difficulty_level === "advanced") ? r.difficulty_level : "intermediate", equipmentRequired: r.equipment_required, cloudinaryImageId: null, cloudinaryGifId: null, createdBy: "user", visibility: "private" }));
      const res = await fetch(`/api/workout-planner/plans/${selectedPlanId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exercises }) });
      const body = (await res.json()) as { exercises?: PlanExercise[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setRows(normalize(body.exercises ?? []));
      setDirty(false);
      setNotice("Workout builder saved.");
      await loadToday(selectedPlanId);
    } finally {
      setSaving(false);
    }
  };

  const runSearch = async (mode: "search" | "suggest") => {
    if (!selectedPlanId && mode === "suggest") return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (query.trim()) params.set("q", query.trim());
      if (muscle !== "all") params.set("muscle", muscle);
      if (difficulty !== "all") params.set("difficulty", difficulty);
      if (mode === "suggest") {
        params.set("mode", "suggest");
        params.set("planId", selectedPlanId!);
        params.set("dayIndex", String(libraryDay));
      }
      const res = await fetch(`/api/workout-planner/exercises?${params.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as { exercises?: ExerciseCatalog[]; suggestions?: ExerciseCatalog[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      if (mode === "search") setResults(body.exercises ?? []);
      else setSuggestions(body.suggestions ?? []);
    } finally {
      setSearching(false);
    }
  };

  const createCustom = async () => {
    if (!customName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workout-planner/exercises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: customName.trim(), targetMuscle: customMuscle, difficultyLevel: selectedPlan?.experience_level ?? "intermediate", visibility: "private" }) });
      const body = (await res.json()) as { exercise?: ExerciseCatalog; error?: string };
      if (!res.ok || !body.exercise) throw new Error(body.error ?? "Create failed");
      setRows((cur) => normalize([...cur, newRow(selectedPlanId!, libraryDay, body.exercise!)]));
      setDirty(true);
      setCustomName("");
    } finally {
      setCreating(false);
    }
  };

  const addToPlan = (item: ExerciseCatalog) => {
    if (!selectedPlanId) return;
    setRows((cur) => normalize([...cur, newRow(selectedPlanId, libraryDay, item)]));
    setDirty(true);
  };

  const removeRow = (id: string) => {
    setRows((cur) => normalize(cur.filter((r) => r.id !== id)));
    setDirty(true);
  };

  const moveRow = (id: string, dir: "up" | "down") => {
    setRows((cur) => {
      const next = normalize(cur);
      const idx = next.findIndex((r) => r.id === id);
      if (idx < 0) return next;
      const row = next[idx];
      const inDay = next.map((r, i) => ({ r, i })).filter((x) => x.r.day_index === row.day_index).map((x) => x.i);
      const pos = inDay.indexOf(idx);
      const swap = dir === "up" ? inDay[pos - 1] : inDay[pos + 1];
      if (swap === undefined) return next;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return normalize(next);
    });
    setDirty(true);
  };

  const dropOnRow = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setRows((cur) => {
      const next = normalize(cur);
      const from = next.findIndex((r) => r.id === dragId);
      const to = next.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return next;
      const [moved] = next.splice(from, 1);
      const insertAt = from < to ? to - 1 : to;
      moved.day_index = next[insertAt]?.day_index ?? moved.day_index;
      next.splice(insertAt, 0, moved);
      return normalize(next);
    });
    setDirty(true);
    setDragId(null);
  };

  const applyTemplate = (id: string, key: keyof typeof templates) => {
    const t = templates[key];
    updateRow(id, (r) => ({ ...r, sets: t.sets, reps_min: t.repsMin, reps_max: t.repsMax, rest_seconds: t.rest, rpe: 8 }));
  };

  return (
    <div className="space-y-6 text-day-text-primary dark:text-night-text-primary">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workout Program</h1>
          <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">
            Planner controls your program. Session execution happens on Workout Session.
          </p>
        </div>
        <button type="button" onClick={() => setAdvanced((v) => !v)} className="rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
          {advanced ? "Hide Advanced" : "Advanced Mode"}
        </button>
      </section>

      {error ? <Card className="p-4 text-sm text-red-600 dark:text-red-300">{error}</Card> : null}
      {notice ? <Card className="p-4 text-sm text-emerald-600 dark:text-emerald-300">{notice}</Card> : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-day-text-secondary dark:text-night-text-secondary">Current Program</p>
            <h2 className="mt-1 text-xl font-semibold">{selectedPlan?.name ?? "No plan yet"}</h2>
            {selectedPlan ? <p className="mt-1 text-sm text-day-text-secondary dark:text-night-text-secondary">Goal: {nice(selectedPlan.goal)} | {selectedPlan.workout_days_per_week} days/week | {nice(selectedPlan.experience_level)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void generatePlan().catch((e) => setError(e instanceof Error ? e.message : "Failed"))} className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white dark:bg-night-accent">Generate Plan</button>
            <button type="button" onClick={() => setShowFull((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-day-border px-4 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">
              <Sparkles className="h-4 w-4" />
              {showFull ? "Hide Full Workout" : "View Full Workout"}
            </button>
          </div>
        </div>
        {loading ? <div className="skeleton mt-4 h-24 rounded-lg" /> : null}
      </Card>

      {advanced ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Plans</p>
            <button type="button" disabled={!dirty || saving} onClick={() => void saveBuilder().catch((e) => setError(e instanceof Error ? e.message : "Save failed"))} className="rounded-lg bg-day-accent-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-night-accent">{saving ? "Saving..." : "Save Builder"}</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {plans.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedPlanId(p.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${selectedPlan?.id === p.id ? "border-day-accent-primary bg-sky-50 dark:border-night-accent dark:bg-night-hover" : "border-day-border text-day-text-secondary dark:border-night-border dark:text-night-text-secondary"}`}>{p.name}{p.is_active ? " (Active)" : ""}</button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input className="input-field md:col-span-2" placeholder="Exercise search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="input-field" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              <option value="all">All muscles</option><option value="chest">Chest</option><option value="back">Back</option><option value="legs">Legs</option><option value="shoulders">Shoulders</option><option value="arms">Arms</option><option value="core">Core</option>
            </select>
            <select className="input-field" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <button type="button" onClick={() => void runSearch("search").catch((e) => setError(e instanceof Error ? e.message : "Search failed"))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"><Search className="h-4 w-4" />{searching ? "Searching..." : "Search"}</button>
            <select className="input-field" value={String(libraryDay)} onChange={(e) => setLibraryDay(Math.max(1, Math.min(7, Number(e.target.value))))}>
              {Array.from({ length: 7 }).map((_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
            </select>
            <button type="button" onClick={() => void runSearch("suggest").catch((e) => setError(e instanceof Error ? e.message : "Suggest failed"))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover md:col-span-2"><Wand2 className="h-4 w-4" />AI Suggestions</button>
            <input className="input-field" placeholder="Custom exercise name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            <select className="input-field" value={customMuscle} onChange={(e) => setCustomMuscle(e.target.value)}>
              <option value="chest">Chest</option><option value="back">Back</option><option value="legs">Legs</option><option value="shoulders">Shoulders</option><option value="arms">Arms</option><option value="core">Core</option>
            </select>
            <button type="button" disabled={creating} onClick={() => void createCustom().catch((e) => setError(e instanceof Error ? e.message : "Create failed"))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-day-border px-3 py-2 text-sm font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover"><Plus className="h-4 w-4" />{creating ? "Creating..." : "Create + Add"}</button>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/60">
              <p className="text-sm font-semibold">Library</p>
              <div className="mt-2 space-y-2">
                {results.slice(0, 8).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm dark:border-night-border dark:bg-night-card">
                    <div><p className="font-medium">{x.name}</p><p className="text-xs text-day-text-secondary dark:text-night-text-secondary">{nice(x.target_muscle)} | {nice(x.difficulty_level)}</p></div>
                    <button type="button" onClick={() => addToPlan(x)} className="rounded-lg border border-day-border px-2 py-1 text-xs font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">Add</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-day-border bg-day-hover/70 p-3 dark:border-night-border dark:bg-night-hover/60">
              <p className="text-sm font-semibold">AI Suggestions</p>
              <div className="mt-2 space-y-2">
                {suggestions.slice(0, 8).map((x) => (
                  <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-day-border bg-day-card px-3 py-2 text-sm dark:border-night-border dark:bg-night-card">
                    <div><p className="font-medium">{x.name}</p><p className="text-xs text-day-text-secondary dark:text-night-text-secondary">{nice(x.target_muscle)} | {nice(x.difficulty_level)}</p></div>
                    <button type="button" onClick={() => addToPlan(x)} className="rounded-lg border border-day-border px-2 py-1 text-xs font-semibold text-day-text-secondary hover:bg-day-hover dark:border-night-border dark:text-night-text-secondary dark:hover:bg-night-hover">Add</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {byDay.map(([day, items]) => (
              <div key={day} className="rounded-xl border border-day-border bg-day-hover/60 p-3 dark:border-night-border dark:bg-night-hover/50" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) { updateRow(dragId, (r) => ({ ...r, day_index: day })); setDragId(null); } }}>
                <p className="mb-2 text-sm font-semibold">Day {day}</p>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div key={r.id} draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropOnRow(r.id)} className="rounded-lg border border-day-border bg-day-card p-3 dark:border-night-border dark:bg-night-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-day-text-secondary dark:text-night-text-secondary" /><p className="text-sm font-semibold">#{r.exercise_order} {r.exercise_name}</p></div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => moveRow(r.id, "up")} className="rounded-md border border-day-border px-2 py-1 text-xs dark:border-night-border"><ArrowUp className="h-3 w-3" /></button>
                          <button type="button" onClick={() => moveRow(r.id, "down")} className="rounded-md border border-day-border px-2 py-1 text-xs dark:border-night-border"><ArrowDown className="h-3 w-3" /></button>
                          <button type="button" onClick={() => removeRow(r.id)} className="rounded-md border border-day-border px-2 py-1 text-xs text-red-600 dark:border-night-border dark:text-red-300">x</button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-6">
                        <input className="input-field" type="number" min={1} max={20} value={r.sets} onChange={(e) => updateRow(r.id, (x) => ({ ...x, sets: Number(e.target.value) || 1 }))} />
                        <input className="input-field" type="number" min={1} max={120} value={r.reps_min} onChange={(e) => updateRow(r.id, (x) => ({ ...x, reps_min: Number(e.target.value) || 1 }))} />
                        <input className="input-field" type="number" min={1} max={120} value={r.reps_max} onChange={(e) => updateRow(r.id, (x) => ({ ...x, reps_max: Number(e.target.value) || 1 }))} />
                        <input className="input-field" type="number" min={15} max={900} value={r.rest_seconds} onChange={(e) => updateRow(r.id, (x) => ({ ...x, rest_seconds: Number(e.target.value) || 60 }))} />
                        <input className="input-field" placeholder="Superset" value={r.superset_group ?? ""} onChange={(e) => updateRow(r.id, (x) => ({ ...x, superset_group: superset(e.target.value) }))} />
                        <select className="input-field" defaultValue="" onChange={(e) => { const key = e.target.value as keyof typeof templates; if (key) applyTemplate(r.id, key); e.currentTarget.value = ""; }}>
                          <option value="">Template</option>
                          {Object.entries(templates).map(([k, t]) => <option key={`${r.id}-${k}`} value={k}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {showFull ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-amber-500" />Full Workout (AI Adjusted)</div>
          <p className="mt-1 text-xs text-day-text-secondary dark:text-night-text-secondary">Cache: {today?.cacheState ?? "unknown"}</p>
          <div className="mt-4 space-y-3">
            {(today?.previewExercises ?? []).length === 0 ? (
              <div className="rounded-lg border border-day-border bg-day-hover/70 px-3 py-3 text-sm text-day-text-secondary dark:border-night-border dark:bg-night-hover/60 dark:text-night-text-secondary">Using baseline plan - recommendations adapt after your workouts.</div>
            ) : (
              today?.previewExercises.map((row) => (
                <div key={row.plan_exercise_id} className="rounded-xl border border-day-border bg-day-card p-4 dark:border-night-border dark:bg-night-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{row.exercise_name}</p>
                      <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">{row.recommended_sets} sets x {row.recommended_reps.min}-{row.recommended_reps.max} reps | {row.recommended_weight === null ? "Auto" : `${row.recommended_weight} kg`} | Rest {row.rest_seconds}s</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(row.progression_action)}`}>{nice(row.progression_action)}</span>
                  </div>
                  {row.recommendation_reason.length > 0 ? <p className="mt-2 text-xs text-day-text-secondary dark:text-night-text-secondary">AI: {row.recommendation_reason.join(" | ")}</p> : null}
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
