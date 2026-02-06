-- Translation corrections table for learning from human edits
CREATE TABLE IF NOT EXISTS public.translation_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  source_text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_translation_corrections_language_code
  ON public.translation_corrections(language_code);
CREATE INDEX IF NOT EXISTS idx_translation_corrections_source_text
  ON public.translation_corrections USING gin(to_tsvector('simple', source_text));
CREATE INDEX IF NOT EXISTS idx_translation_corrections_created_at
  ON public.translation_corrections(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.translation_corrections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for translation_corrections
-- All authenticated users can view corrections for learning
CREATE POLICY "Authenticated users can view all corrections"
  ON public.translation_corrections
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can insert their own corrections
CREATE POLICY "Authenticated users can insert corrections"
  ON public.translation_corrections
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only the user who created the correction can delete it
CREATE POLICY "Users can delete their own corrections"
  ON public.translation_corrections
  FOR DELETE
  USING (user_id = auth.uid());
