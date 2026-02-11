-- =====================================================
-- Migration: Create translation_platforms junction table
-- Replace work_scope array with proper FK relationship
-- =====================================================

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS translation_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_id UUID NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  platform_code VARCHAR(50) NOT NULL REFERENCES platforms(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(translation_id, platform_code)
);

-- 2. Migrate data from work_scope array to junction table
INSERT INTO translation_platforms (translation_id, platform_code)
SELECT
  t.id as translation_id,
  unnest(t.work_scope) as platform_code
FROM translations t
WHERE t.work_scope IS NOT NULL
  AND array_length(t.work_scope, 1) > 0
  -- Only migrate if platform exists in platforms table
  AND EXISTS (
    SELECT 1 FROM platforms p
    WHERE p.code = ANY(t.work_scope)
  )
ON CONFLICT (translation_id, platform_code) DO NOTHING;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_translation_platforms_translation_id
  ON translation_platforms(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_platforms_platform_code
  ON translation_platforms(platform_code);

-- 4. Enable RLS
ALTER TABLE translation_platforms ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Authenticated users can view translation platforms"
  ON translation_platforms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage translation platforms"
  ON translation_platforms FOR ALL
  TO authenticated
  USING (true);

-- 6. Add comment to work_scope column (keep for backward compatibility)
COMMENT ON COLUMN translations.work_scope IS 'DEPRECATED: Use translation_platforms table instead';
