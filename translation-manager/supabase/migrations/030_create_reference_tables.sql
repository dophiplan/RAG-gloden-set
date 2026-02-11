-- =====================================================
-- Migration: Create reference tables for master data
-- =====================================================

-- 1. Translation Statuses Table
CREATE TABLE IF NOT EXISTS translation_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label_ko VARCHAR(100) NOT NULL,
  label_en VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL,
  bg_color VARCHAR(50) NOT NULL,
  text_color VARCHAR(50) NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing statuses
INSERT INTO translation_statuses (code, label_ko, label_en, color, bg_color, text_color, sort_order) VALUES
  ('pending', '번역 요청', 'Pending', 'yellow', 'bg-yellow-100', 'text-yellow-800', 1),
  ('in_progress', '진행 중', 'In Progress', 'purple', 'bg-[#E0E7FF]', 'text-[#4F46E5]', 2),
  ('reviewed', '검수 완료', 'Reviewed', 'gray', 'bg-white', 'text-gray-800', 3),
  ('deployed', '반영 완료', 'Deployed', 'gray', 'bg-gray-100', 'text-gray-500', 4)
ON CONFLICT (code) DO NOTHING;

-- 2. Priority Levels Table
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

-- 3. Scopes Table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_translation_statuses_sort_order ON translation_statuses(sort_order);
CREATE INDEX IF NOT EXISTS idx_priority_levels_sort_order ON priority_levels(sort_order);
CREATE INDEX IF NOT EXISTS idx_scopes_sort_order ON scopes(sort_order);

-- Enable RLS
ALTER TABLE translation_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE scopes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone authenticated can read
CREATE POLICY "Anyone can read translation_statuses"
  ON translation_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read priority_levels"
  ON priority_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read scopes"
  ON scopes FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: Only masters can modify
CREATE POLICY "Only masters can modify translation_statuses"
  ON translation_statuses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> ARRAY['master'] OR users.roles @> ARRAY['1st_master'])
    )
  );

CREATE POLICY "Only masters can modify priority_levels"
  ON priority_levels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> ARRAY['master'] OR users.roles @> ARRAY['1st_master'])
    )
  );

CREATE POLICY "Only masters can modify scopes"
  ON scopes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> ARRAY['master'] OR users.roles @> ARRAY['1st_master'])
    )
  );

-- Create updated_at triggers
CREATE TRIGGER translation_statuses_updated_at
  BEFORE UPDATE ON translation_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER priority_levels_updated_at
  BEFORE UPDATE ON priority_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scopes_updated_at
  BEFORE UPDATE ON scopes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
