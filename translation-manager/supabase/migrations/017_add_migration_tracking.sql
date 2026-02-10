-- Add migration tracking field
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_translations_is_migrated
  ON public.translations(is_migrated);

-- Add comment
COMMENT ON COLUMN public.translations.is_migrated IS
  'Indicates if this translation was imported from a migration';
