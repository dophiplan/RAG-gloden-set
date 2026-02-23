-- Migration: Add translation source tracking
-- Purpose: Track where translations came from (glossary match, AI, manual, imported)
-- Date: 2026-02-11

-- Add source tracking fields to translation_results
ALTER TABLE translation_results
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('glossary', 'ai', 'manual', 'imported')),
ADD COLUMN IF NOT EXISTS glossary_term_id UUID REFERENCES glossary(id) ON DELETE SET NULL;

-- Add indexes for statistics and filtering
CREATE INDEX IF NOT EXISTS idx_translation_results_source_type
ON translation_results(source_type);

CREATE INDEX IF NOT EXISTS idx_translation_results_glossary_term_id
ON translation_results(glossary_term_id);

-- Add comments for documentation
COMMENT ON COLUMN translation_results.source_type IS 'Source of the translation: glossary (from DB), ai (new AI translation), manual (user edited), imported (bulk import)';
COMMENT ON COLUMN translation_results.glossary_term_id IS 'Reference to glossary term if source_type is glossary';

-- Note: Existing data will have source_type=NULL for backward compatibility
-- This allows gradual migration without breaking existing functionality
