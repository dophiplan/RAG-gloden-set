-- Add priority field to translations table
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT '중'
  CHECK (priority IN ('긴급', '상', '중', '하'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_translations_priority
  ON public.translations(priority);

-- Update existing records to have default priority
UPDATE public.translations
SET priority = '중'
WHERE priority IS NULL;
