-- Add translation source tracking fields to translation_results table
-- This allows us to track whether a translation came from glossary, AI, manual input, or import

ALTER TABLE translation_results
ADD COLUMN source_type TEXT CHECK (source_type IN ('glossary', 'ai', 'manual', 'imported')),
ADD COLUMN glossary_term_id UUID REFERENCES glossary(id) ON DELETE SET NULL;

-- Add indexes for performance optimization
CREATE INDEX idx_translation_results_source_type ON translation_results(source_type);
CREATE INDEX idx_translation_results_glossary_term_id ON translation_results(glossary_term_id);

-- Existing data will have source_type=NULL for backward compatibility
-- No default value is set to distinguish legacy data from new data

COMMENT ON COLUMN translation_results.source_type IS 'Source of the translation: glossary (from DB), ai (newly generated), manual (user edited), imported (from file)';
COMMENT ON COLUMN translation_results.glossary_term_id IS 'Reference to the glossary term that was matched, if source_type is glossary';
