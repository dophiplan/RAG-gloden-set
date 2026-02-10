-- Migration: Create languages table for dynamic language management
-- Allows admins to add/edit languages from settings page

-- Create languages table
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing languages
INSERT INTO languages (code, name, display_order) VALUES
  ('ko', '한국어', 1),
  ('en', '영어', 2),
  ('ja', '일본어', 3),
  ('zh-CN', '중국어 간체', 4),
  ('zh-TW', '중국어 번체', 5),
  ('de', '독일어', 6),
  ('es', '스페인어', 7),
  ('pt', '포르투갈어', 8)
ON CONFLICT (code) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_languages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER languages_updated_at_trigger
BEFORE UPDATE ON languages
FOR EACH ROW
EXECUTE FUNCTION update_languages_updated_at();

-- Enable RLS
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read languages
CREATE POLICY "Anyone can read languages"
ON languages FOR SELECT
TO authenticated
USING (true);

-- Policy: Only master users can insert/update/delete languages
CREATE POLICY "Only master users can modify languages"
ON languages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.roles @> ARRAY['master'] OR users.roles @> ARRAY['1st_master'])
  )
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_languages_display_order ON languages (display_order ASC);

-- Comments
COMMENT ON TABLE languages IS 'Dynamic language list managed by admins';
COMMENT ON COLUMN languages.code IS 'Language code (e.g., ko, en, ja, zh-CN)';
COMMENT ON COLUMN languages.name IS 'Display name for the language';
COMMENT ON COLUMN languages.display_order IS 'Order for displaying languages in UI';
