-- Migration 037: Ensure all reference tables exist
-- This migration recreates any missing reference tables
-- Safe to run multiple times (uses IF NOT EXISTS)

-- =====================================================
-- 1. Languages Table
-- =====================================================
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

-- Create index
CREATE INDEX IF NOT EXISTS idx_languages_display_order ON languages (display_order ASC);

-- Enable RLS
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read languages" ON languages;
DROP POLICY IF EXISTS "Only master users can modify languages" ON languages;

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

-- Create updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_languages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS languages_updated_at_trigger ON languages;
CREATE TRIGGER languages_updated_at_trigger
BEFORE UPDATE ON languages
FOR EACH ROW
EXECUTE FUNCTION update_languages_updated_at();

-- =====================================================
-- 2. Ensure Priority Levels Table Exists
-- =====================================================
CREATE TABLE IF NOT EXISTS priority_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing priorities
INSERT INTO priority_levels (code, label, color, sort_order) VALUES
  ('urgent', '긴급', 'bg-red-100 text-red-800', 4),
  ('high', '상', 'bg-orange-100 text-orange-800', 3),
  ('medium', '중', 'bg-yellow-100 text-yellow-800', 2),
  ('low', '하', 'bg-gray-100 text-gray-800', 1)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. Ensure Scopes Table Exists
-- =====================================================
CREATE TABLE IF NOT EXISTS scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing scopes
INSERT INTO scopes (code, name, sort_order) VALUES
  ('saas', 'SaaS', 1),
  ('solution', 'Solution', 2),
  ('government', '정부과제', 3),
  ('other', '기타', 4)
ON CONFLICT (code) DO NOTHING;

-- Comments
COMMENT ON TABLE languages IS 'Dynamic language list managed by admins';
COMMENT ON COLUMN languages.code IS 'Language code (e.g., ko, en, ja, zh-CN)';
COMMENT ON COLUMN languages.name IS 'Display name for the language';
