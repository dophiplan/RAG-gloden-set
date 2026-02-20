-- ============================================================================
-- Migration: Add Glossary Rollback Support
-- Created: 2026-02-20
-- Purpose: Add rollback functionality for glossary terms with concurrency control
-- ============================================================================

-- ============================================================================
-- 1. Add is_rollback column to glossary_audit_logs
-- ============================================================================

ALTER TABLE public.glossary_audit_logs 
ADD COLUMN IF NOT EXISTS is_rollback BOOLEAN DEFAULT FALSE;

ALTER TABLE public.glossary_audit_logs 
ADD COLUMN IF NOT EXISTS rollback_to_log_id UUID REFERENCES public.glossary_audit_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_is_rollback 
  ON public.glossary_audit_logs(is_rollback) 
  WHERE is_rollback = TRUE;

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_rollback_to 
  ON public.glossary_audit_logs(rollback_to_log_id);

-- ============================================================================
-- 2. Add version column to glossary table for optimistic locking
-- ============================================================================

-- Check if version column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'glossary' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.glossary ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- Initialize version for existing records
UPDATE public.glossary SET version = 1 WHERE version IS NULL;

-- Create index for version lookups
CREATE INDEX IF NOT EXISTS idx_glossary_version ON public.glossary(version);

-- ============================================================================
-- 3. Function: Execute single field rollback
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_glossary_rollback(
  p_glossary_id UUID,
  p_audit_log_id UUID,
  p_user_id UUID,
  p_user_name TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  new_version INTEGER,
  error_code TEXT,
  error_message TEXT,
  reverted_field TEXT,
  old_value TEXT,
  new_value TEXT
) AS $$
DECLARE
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_audit_record RECORD;
  v_current_value TEXT;
  v_field_name TEXT;
BEGIN
  -- 1. Get audit log record
  SELECT 
    gal.field_name,
    gal.old_value,
    gal.new_value,
    gal.glossary_term_id
  INTO v_audit_record
  FROM glossary_audit_logs gal
  WHERE gal.id = p_audit_log_id;

  IF v_audit_record IS NULL THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::INTEGER, 
      'AUDIT_NOT_FOUND'::TEXT, 
      '변경 이력을 찾을 수 없습니다.'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  IF v_audit_record.glossary_term_id != p_glossary_id THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::INTEGER, 
      'INVALID_AUDIT'::TEXT, 
      '변경 이력이 해당 용어와 일치하지 않습니다.'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  v_field_name := v_audit_record.field_name;

  -- 2. Get current version with lock
  SELECT version INTO v_current_version
  FROM glossary
  WHERE id = p_glossary_id
  FOR UPDATE;

  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::INTEGER, 
      'RECORD_NOT_FOUND'::TEXT, 
      '용어를 찾을 수 없습니다.'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- 3. Get current field value for validation
  CASE v_field_name
    WHEN 'term' THEN
      SELECT term INTO v_current_value FROM glossary WHERE id = p_glossary_id;
    WHEN 'translation' THEN
      SELECT translation INTO v_current_value FROM glossary WHERE id = p_glossary_id;
    WHEN 'context' THEN
      SELECT context INTO v_current_value FROM glossary WHERE id = p_glossary_id;
    WHEN 'approval_status' THEN
      SELECT approval_status INTO v_current_value FROM glossary WHERE id = p_glossary_id;
    ELSE
      RETURN QUERY SELECT 
        FALSE, 
        NULL::INTEGER, 
        'INVALID_FIELD'::TEXT, 
        '지원하지 않는 필드입니다.'::TEXT,
        NULL::TEXT,
        NULL::TEXT,
        NULL::TEXT;
      RETURN;
  END CASE;

  -- 4. Validate current value matches audit's new_value
  IF v_current_value IS DISTINCT FROM v_audit_record.new_value THEN
    RETURN QUERY SELECT 
      FALSE, 
      NULL::INTEGER, 
      'AUDIT_MISMATCH'::TEXT, 
      '데이터가 이미 변경되었습니다.'::TEXT,
      v_field_name::TEXT,
      v_current_value::TEXT,
      v_audit_record.new_value::TEXT;
    RETURN;
  END IF;

  -- 5. Execute rollback
  v_new_version := v_current_version + 1;

  CASE v_field_name
    WHEN 'term' THEN
      UPDATE glossary 
      SET term = v_audit_record.old_value, 
          version = v_new_version,
          updated_at = NOW()
      WHERE id = p_glossary_id;
    WHEN 'translation' THEN
      UPDATE glossary 
      SET translation = v_audit_record.old_value, 
          version = v_new_version,
          updated_at = NOW()
      WHERE id = p_glossary_id;
    WHEN 'context' THEN
      UPDATE glossary 
      SET context = v_audit_record.old_value, 
          version = v_new_version,
          updated_at = NOW()
      WHERE id = p_glossary_id;
    WHEN 'approval_status' THEN
      UPDATE glossary 
      SET approval_status = v_audit_record.old_value, 
          version = v_new_version,
          updated_at = NOW()
      WHERE id = p_glossary_id;
  END CASE;

  -- 6. Create rollback audit log
  INSERT INTO glossary_audit_logs (
    glossary_term_id,
    user_id,
    user_name,
    user_email,
    action,
    field_name,
    old_value,
    new_value,
    is_rollback,
    rollback_to_log_id,
    metadata
  ) VALUES (
    p_glossary_id,
    p_user_id,
    p_user_name,
    p_user_email,
    'rollback',
    v_field_name,
    v_audit_record.new_value,
    v_audit_record.old_value,
    TRUE,
    p_audit_log_id,
    jsonb_build_object(
      'previous_version', v_current_version,
      'new_version', v_new_version,
      'reason', 'user_rollback'
    )
  );

  RETURN QUERY SELECT 
    TRUE, 
    v_new_version, 
    NULL::TEXT, 
    NULL::TEXT,
    v_field_name::TEXT,
    v_audit_record.old_value::TEXT,
    v_audit_record.new_value::TEXT;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION execute_glossary_rollback TO authenticated;

-- ============================================================================
-- 4. Function: Get audit history for glossary term
-- ============================================================================

CREATE OR REPLACE FUNCTION get_glossary_audit_history(
  p_glossary_term_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  action TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  is_rollback BOOLEAN,
  rollback_to_log_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gal.id,
    gal.user_id,
    gal.user_name,
    gal.user_email,
    gal.action,
    gal.field_name,
    gal.old_value,
    gal.new_value,
    gal.is_rollback,
    gal.rollback_to_log_id,
    gal.metadata,
    gal.created_at
  FROM glossary_audit_logs gal
  WHERE gal.glossary_term_id = p_glossary_term_id
  ORDER BY gal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_glossary_audit_history TO authenticated;

-- ============================================================================
-- 5. Function: Bulk rollback
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_glossary_rollback(
  p_items JSONB,
  p_user_id UUID,
  p_user_name TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_atomic BOOLEAN DEFAULT FALSE
) RETURNS TABLE(
  glossary_id UUID,
  success BOOLEAN,
  new_version INTEGER,
  error_code TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_item JSONB;
  v_glossary_id UUID;
  v_audit_log_id UUID;
  v_result RECORD;
  v_success_count INTEGER := 0;
  v_failure_count INTEGER := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_glossary_id := (v_item->>'glossaryId')::UUID;
    v_audit_log_id := (v_item->>'auditLogId')::UUID;

    SELECT * INTO v_result
    FROM execute_glossary_rollback(
      v_glossary_id,
      v_audit_log_id,
      p_user_id,
      p_user_name,
      p_user_email
    );

    IF v_result.success THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failure_count := v_failure_count + 1;
      
      -- If atomic and one fails, we should rollback previous ones
      -- Note: This is handled at application level with compensating transactions
    END IF;

    RETURN QUERY SELECT 
      v_glossary_id,
      v_result.success,
      v_result.new_version,
      v_result.error_code,
      v_result.error_message;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bulk_glossary_rollback TO authenticated;

-- ============================================================================
-- 6. Update glossary trigger to auto-increment version
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_glossary_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if version is not explicitly set
  IF NEW.version = OLD.version OR NEW.version IS NULL THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_increment_glossary_version ON glossary;

-- Create trigger
CREATE TRIGGER trigger_increment_glossary_version
  BEFORE UPDATE ON glossary
  FOR EACH ROW
  EXECUTE FUNCTION increment_glossary_version();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN public.glossary_audit_logs.is_rollback IS 'Whether this log entry is a rollback operation';
COMMENT ON COLUMN public.glossary_audit_logs.rollback_to_log_id IS 'Reference to the original audit log that was rolled back to';
COMMENT ON COLUMN public.glossary.version IS 'Optimistic locking version number';
COMMENT ON FUNCTION execute_glossary_rollback IS 'Execute a single field rollback with optimistic locking';
COMMENT ON FUNCTION bulk_glossary_rollback IS 'Execute rollback for multiple glossary items';

-- ============================================================================
-- Migration complete
-- ============================================================================
