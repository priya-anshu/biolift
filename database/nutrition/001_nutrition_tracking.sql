BEGIN;

CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  calories_target integer NOT NULL DEFAULT 2200
    CHECK (calories_target BETWEEN 500 AND 10000),
  protein_target_g numeric(10,2) NOT NULL DEFAULT 140
    CHECK (protein_target_g BETWEEN 0 AND 1000),
  carbs_target_g numeric(10,2) NOT NULL DEFAULT 220
    CHECK (carbs_target_g BETWEEN 0 AND 1500),
  fiber_target_g numeric(10,2) NOT NULL DEFAULT 30
    CHECK (fiber_target_g BETWEEN 0 AND 200),
  fat_target_g numeric(10,2) NOT NULL DEFAULT 70
    CHECK (fat_target_g BETWEEN 0 AND 400),
  sugar_target_g numeric(10,2) NOT NULL DEFAULT 36
    CHECK (sugar_target_g BETWEEN 0 AND 300),
  water_target_ml integer NOT NULL DEFAULT 3000
    CHECK (water_target_ml BETWEEN 0 AND 12000),
  sodium_target_mg numeric(10,2) NOT NULL DEFAULT 2300
    CHECK (sodium_target_mg BETWEEN 0 AND 10000),
  calcium_target_mg numeric(10,2) NOT NULL DEFAULT 1000
    CHECK (calcium_target_mg BETWEEN 0 AND 5000),
  iron_target_mg numeric(10,2) NOT NULL DEFAULT 18
    CHECK (iron_target_mg BETWEEN 0 AND 200),
  vitamin_c_target_mg numeric(10,2) NOT NULL DEFAULT 90
    CHECK (vitamin_c_target_mg BETWEEN 0 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  meal_slot text NOT NULL
    CHECK (
      meal_slot IN (
        'pre_workout',
        'breakfast',
        'mid_morning',
        'lunch',
        'evening_snack',
        'dinner',
        'hydration'
      )
    ),
  description text NOT NULL,
  recognized_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_tokens text[] NOT NULL DEFAULT '{}',
  confidence_score numeric(4,3) NOT NULL DEFAULT 1
    CHECK (confidence_score BETWEEN 0 AND 1),
  review_status text NOT NULL DEFAULT 'reviewed'
    CHECK (review_status IN ('reviewed', 'needs_review')),
  source text NOT NULL DEFAULT 'catalog'
    CHECK (source IN ('catalog', 'manual', 'mixed', 'usda', 'open_food_facts')),
  calories_kcal numeric(10,2) NOT NULL DEFAULT 0 CHECK (calories_kcal >= 0),
  protein_g numeric(10,2) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric(10,2) NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fiber_g numeric(10,2) NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  fat_g numeric(10,2) NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  sugar_g numeric(10,2) NOT NULL DEFAULT 0 CHECK (sugar_g >= 0),
  water_ml integer NOT NULL DEFAULT 0 CHECK (water_ml >= 0),
  sodium_mg numeric(10,2) NOT NULL DEFAULT 0 CHECK (sodium_mg >= 0),
  calcium_mg numeric(10,2) NOT NULL DEFAULT 0 CHECK (calcium_mg >= 0),
  iron_mg numeric(10,2) NOT NULL DEFAULT 0 CHECK (iron_mg >= 0),
  vitamin_c_mg numeric(10,2) NOT NULL DEFAULT 0 CHECK (vitamin_c_mg >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
  ON public.nutrition_logs (user_id, log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date_slot
  ON public.nutrition_logs (user_id, log_date DESC, meal_slot, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_review_queue
  ON public.nutrition_logs (user_id, review_status, log_date DESC);

DROP TRIGGER IF EXISTS trg_nutrition_goals_updated_at ON public.nutrition_goals;
CREATE TRIGGER trg_nutrition_goals_updated_at
BEFORE UPDATE ON public.nutrition_goals
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_nutrition_logs_updated_at ON public.nutrition_logs;
CREATE TRIGGER trg_nutrition_logs_updated_at
BEFORE UPDATE ON public.nutrition_logs
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutrition goals owner access" ON public.nutrition_goals;
CREATE POLICY "Nutrition goals owner access"
ON public.nutrition_goals
FOR ALL
USING (user_id = public.current_profile_id() OR public.is_current_user_admin())
WITH CHECK (user_id = public.current_profile_id() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Nutrition logs owner access" ON public.nutrition_logs;
CREATE POLICY "Nutrition logs owner access"
ON public.nutrition_logs
FOR ALL
USING (user_id = public.current_profile_id() OR public.is_current_user_admin())
WITH CHECK (user_id = public.current_profile_id() OR public.is_current_user_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_logs TO authenticated;

COMMIT;
