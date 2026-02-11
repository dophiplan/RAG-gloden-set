-- Add cache tracking columns to glossary table
ALTER TABLE public.glossary
  ADD COLUMN source_type TEXT DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'excel_import', 'ai_generated')),
  ADD COLUMN imported_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN hit_count INTEGER DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX idx_glossary_source_type ON glossary(source_type);
CREATE INDEX idx_glossary_imported_at ON glossary(imported_at DESC) WHERE imported_at IS NOT NULL;
CREATE INDEX idx_glossary_hit_count ON glossary(hit_count DESC);

-- Update existing records to have imported_at as created_at
UPDATE public.glossary
SET imported_at = created_at
WHERE imported_at IS NULL;

COMMENT ON COLUMN glossary.source_type IS 'Source of the glossary term: manual (user created), excel_import (imported from Excel), ai_generated (created by AI translation)';
COMMENT ON COLUMN glossary.imported_at IS 'Timestamp when the term was added to the system';
COMMENT ON COLUMN glossary.hit_count IS 'Number of times this term was used in translations';
