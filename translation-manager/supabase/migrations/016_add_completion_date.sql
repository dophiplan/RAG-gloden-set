-- Add completion_date column to translations table
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS completion_date DATE;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_translations_completion_date
  ON public.translations(completion_date);

-- Add comment
COMMENT ON COLUMN public.translations.completion_date IS
  'Expected completion/deadline date for the translation request';
