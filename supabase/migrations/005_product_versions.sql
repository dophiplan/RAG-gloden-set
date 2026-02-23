-- Add version fields to translation_products table
ALTER TABLE public.translation_products
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS version_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_translation_products_version
  ON public.translation_products(version);
CREATE INDEX IF NOT EXISTS idx_translation_products_version_updated_at
  ON public.translation_products(version_updated_at DESC);

-- Migrate existing version data from translations to translation_products
UPDATE public.translation_products tp
SET
  version = t.version,
  version_updated_at = t.version_updated_at
FROM public.translations t
WHERE tp.translation_id = t.id
  AND t.version IS NOT NULL;

-- Add version fields to glossary_products table as well
ALTER TABLE public.glossary_products
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS version_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for glossary version queries
CREATE INDEX IF NOT EXISTS idx_glossary_products_version
  ON public.glossary_products(version);
CREATE INDEX IF NOT EXISTS idx_glossary_products_version_updated_at
  ON public.glossary_products(version_updated_at DESC);

-- Note: Keep translations.version for backward compatibility
-- It will be deprecated but not removed yet
