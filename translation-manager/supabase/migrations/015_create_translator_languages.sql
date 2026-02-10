-- Create translator_languages table
CREATE TABLE IF NOT EXISTS translator_languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, language_code)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_translator_languages_user_id ON translator_languages(user_id);
CREATE INDEX IF NOT EXISTS idx_translator_languages_language_code ON translator_languages(language_code);

-- Enable RLS
ALTER TABLE translator_languages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own translator languages"
  ON translator_languages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own translator languages"
  ON translator_languages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own translator languages"
  ON translator_languages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own translator languages"
  ON translator_languages FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies (bypass RLS for service role)
CREATE POLICY "Service role can do anything with translator_languages"
  ON translator_languages FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE translator_languages IS 'Stores the languages that each translator can work with';
