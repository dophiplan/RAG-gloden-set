-- =====================================================
-- Migration: Fix priority constraint for English codes
-- =====================================================

-- 1. Drop old constraint
ALTER TABLE public.translations
  DROP CONSTRAINT IF EXISTS translations_priority_check;

-- 2. Update existing priorities to English codes
UPDATE public.translations
SET priority = CASE priority
  WHEN '긴급' THEN 'urgent'
  WHEN '상' THEN 'high'
  WHEN '중' THEN 'medium'
  WHEN '하' THEN 'low'
  ELSE 'medium'
END;

-- 3. Add new constraint with English codes
ALTER TABLE public.translations
  ADD CONSTRAINT translations_priority_check
  CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

-- 4. Update default value
ALTER TABLE public.translations
  ALTER COLUMN priority SET DEFAULT 'medium';

-- 5. Update scope constraint similarly
ALTER TABLE public.translations
  DROP CONSTRAINT IF EXISTS translations_scope_check;

-- Update existing scopes to lowercase codes
UPDATE public.translations
SET scope = CASE scope
  WHEN 'SaaS' THEN 'saas'
  WHEN 'Solution' THEN 'solution'
  WHEN '정부과제' THEN 'government'
  WHEN '기타' THEN 'other'
  ELSE scope
END
WHERE scope IS NOT NULL;

-- Add new scope constraint
ALTER TABLE public.translations
  ADD CONSTRAINT translations_scope_check
  CHECK (scope IN ('saas', 'solution', 'government', 'other'));
