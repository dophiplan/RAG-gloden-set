-- =====================================================
-- Migration: Migrate translations to use FK references
-- =====================================================

-- 1. Add new FK columns to translations table
ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS status_id UUID,
  ADD COLUMN IF NOT EXISTS priority_id UUID,
  ADD COLUMN IF NOT EXISTS scope_id UUID;

-- 2. Migrate existing status data
UPDATE translations t
SET status_id = ts.id
FROM translation_statuses ts
WHERE t.status = ts.code;

-- 3. Migrate existing priority data (map Korean to codes)
UPDATE translations t
SET priority_id = pl.id
FROM priority_levels pl
WHERE (
  (t.priority = '긴급' AND pl.code = 'urgent') OR
  (t.priority = '상' AND pl.code = 'high') OR
  (t.priority = '중' AND pl.code = 'medium') OR
  (t.priority = '하' AND pl.code = 'low')
);

-- 4. Migrate existing scope data
UPDATE translations t
SET scope_id = s.id
FROM scopes s
WHERE (
  (t.scope = 'SaaS' AND s.code = 'saas') OR
  (t.scope = 'Solution' AND s.code = 'solution') OR
  (t.scope = '정부과제' AND s.code = 'government') OR
  (t.scope = '기타' AND s.code = 'other')
);

-- 5. Add foreign key constraints
ALTER TABLE translations
  ADD CONSTRAINT fk_translations_status
    FOREIGN KEY (status_id) REFERENCES translation_statuses(id),
  ADD CONSTRAINT fk_translations_priority
    FOREIGN KEY (priority_id) REFERENCES priority_levels(id),
  ADD CONSTRAINT fk_translations_scope
    FOREIGN KEY (scope_id) REFERENCES scopes(id);

-- 6. Create indexes for FK columns
CREATE INDEX IF NOT EXISTS idx_translations_status_id ON translations(status_id);
CREATE INDEX IF NOT EXISTS idx_translations_priority_id ON translations(priority_id);
CREATE INDEX IF NOT EXISTS idx_translations_scope_id ON translations(scope_id);

-- 7. Drop old columns (keep them as nullable for backward compatibility for now)
-- Will be fully removed in next migration after code is updated
ALTER TABLE translations
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN priority DROP NOT NULL;

-- 8. Add comments
COMMENT ON COLUMN translations.status_id IS 'FK to translation_statuses table';
COMMENT ON COLUMN translations.priority_id IS 'FK to priority_levels table';
COMMENT ON COLUMN translations.scope_id IS 'FK to scopes table';
COMMENT ON COLUMN translations.status IS 'DEPRECATED: Use status_id instead';
COMMENT ON COLUMN translations.priority IS 'DEPRECATED: Use priority_id instead';
COMMENT ON COLUMN translations.scope IS 'DEPRECATED: Use scope_id instead';
