-- ========================================
-- Apply all pending migrations
-- ========================================

-- From 006_comprehensive_update.sql
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('SaaS', 'Solution')),
  ADD COLUMN IF NOT EXISTS work_scope TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dev_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS completion_rate INTEGER DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
  ADD COLUMN IF NOT EXISTS platform_completions JSONB DEFAULT '{}'::JSONB;

-- From 010_fix_translation_products_rls.sql
DROP POLICY IF EXISTS "Authenticated users can manage translation products" ON public.translation_products;

CREATE POLICY "Authenticated users can view translation products"
  ON public.translation_products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert translation products"
  ON public.translation_products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update translation products"
  ON public.translation_products FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete translation products"
  ON public.translation_products FOR DELETE
  USING (auth.role() = 'authenticated');
