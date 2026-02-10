-- Fix status check constraint to include 'in_progress'
-- Drop the old constraint
ALTER TABLE public.translations DROP CONSTRAINT IF EXISTS translations_status_check;

-- Add the new constraint with all valid status values
ALTER TABLE public.translations
  ADD CONSTRAINT translations_status_check
  CHECK (status IN ('pending', 'in_progress', 'reviewed', 'deployed'));

-- Add comment
COMMENT ON COLUMN public.translations.status IS
  'Translation status: pending, in_progress, reviewed, deployed';
