-- Update translation status constraint to include all 7 statuses
-- This aligns the database with the TypeScript TranslationStatus type

-- Drop the old constraint
ALTER TABLE public.translations DROP CONSTRAINT IF EXISTS translations_status_check;

-- Add the new constraint with all valid status values
ALTER TABLE public.translations
  ADD CONSTRAINT translations_status_check
  CHECK (status IN (
    'pending', 
    'in_progress', 
    'reviewed', 
    'deployed',
    're_request',
    'not_used',
    're_deploy_request'
  ));

-- Add comment
COMMENT ON COLUMN public.translations.status IS
  'Translation status: pending, in_progress, reviewed, deployed, re_request, not_used, re_deploy_request';

-- Also update the reference table if it exists
DO $$
BEGIN
  -- Insert missing statuses into reference table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'translation_statuses') THEN
    INSERT INTO public.translation_statuses (code, label_ko, label_en, color, bg_color, text_color, sort_order)
    VALUES 
      ('re_request', '재요청', 'Re-request', 'orange', 'bg-orange-100', 'text-orange-700', 5),
      ('not_used', '미사용', 'Not Used', 'gray', 'bg-gray-100', 'text-gray-600', 6),
      ('re_deploy_request', '재반영요청', 'Re-deploy Request', 'amber', 'bg-amber-100', 'text-amber-700', 7)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;
