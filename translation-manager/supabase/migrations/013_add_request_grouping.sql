-- Add request_id to translations table
ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS request_id UUID;

-- Create index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_translations_request_id
  ON public.translations(request_id);

-- Create composite index for request-based filtering
CREATE INDEX IF NOT EXISTS idx_translations_request_status
  ON public.translations(request_id, status)
  WHERE request_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.translations.request_id IS
  'Groups translations created from same PDF upload batch. NULL for individual translations.';
