-- ============================================================================
-- Migration: Add Glossary Audit Logs
-- Created: 2026-02-13
-- Purpose: Add audit logging for glossary operations (Phase 4)
-- ============================================================================

-- ============================================================================
-- Table: glossary_audit_logs
-- Purpose: Track all changes to glossary terms
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.glossary_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  glossary_term_id UUID REFERENCES public.glossary(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'create', 
    'update', 
    'delete', 
    'approve', 
    'reject', 
    'bulk_create', 
    'bulk_update', 
    'bulk_delete', 
    'bulk_approve', 
    'bulk_reject',
    'import'
  )),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT NULL, -- For additional context (e.g., product_codes, approval_status)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_term_id 
  ON public.glossary_audit_logs(glossary_term_id);

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_user_id 
  ON public.glossary_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_created_at 
  ON public.glossary_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_action 
  ON public.glossary_audit_logs(action);

-- Composite index for common query pattern: get audit history for a term
CREATE INDEX IF NOT EXISTS idx_glossary_audit_logs_term_created 
  ON public.glossary_audit_logs(glossary_term_id, created_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.glossary_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for glossary terms they can access
-- (Assumes glossary table has appropriate access control)
CREATE POLICY "Users can view glossary audit logs"
  ON public.glossary_audit_logs FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.glossary g
        WHERE g.id = glossary_audit_logs.glossary_term_id
      )
    )
  );

-- Policy: Authenticated users can insert audit logs
-- (Application layer ensures proper audit logging)
CREATE POLICY "Authenticated users can insert glossary audit logs"
  ON public.glossary_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- Function: Log glossary changes automatically
-- Purpose: Can be used in triggers or application layer
-- ============================================================================

CREATE OR REPLACE FUNCTION log_glossary_change(
  p_glossary_term_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_user_email TEXT,
  p_action TEXT,
  p_field_name TEXT DEFAULT NULL,
  p_old_value TEXT DEFAULT NULL,
  p_new_value TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO glossary_audit_logs (
    glossary_term_id,
    user_id,
    user_name,
    user_email,
    action,
    field_name,
    old_value,
    new_value,
    metadata
  )
  VALUES (
    p_glossary_term_id,
    p_user_id,
    p_user_name,
    p_user_email,
    p_action,
    p_field_name,
    p_old_value,
    p_new_value,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE NOTICE 'Failed to create glossary audit log: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION log_glossary_change TO authenticated;

-- ============================================================================
-- Function: Get glossary audit history
-- Purpose: Retrieve audit logs for a specific glossary term
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
    gal.metadata,
    gal.created_at
  FROM glossary_audit_logs gal
  WHERE gal.glossary_term_id = p_glossary_term_id
  ORDER BY gal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_glossary_audit_history TO authenticated;

-- ============================================================================
-- Function: Get recent glossary changes
-- Purpose: Retrieve recent audit logs across all glossary terms
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_glossary_changes(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  glossary_term_id UUID,
  term TEXT,
  user_name TEXT,
  action TEXT,
  field_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gal.id,
    gal.glossary_term_id,
    g.term,
    gal.user_name,
    gal.action,
    gal.field_name,
    gal.created_at
  FROM glossary_audit_logs gal
  JOIN glossary g ON g.id = gal.glossary_term_id
  ORDER BY gal.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_recent_glossary_changes TO authenticated;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.glossary_audit_logs IS 'Audit trail for all glossary term changes';
COMMENT ON COLUMN public.glossary_audit_logs.action IS 'Type of action: create, update, delete, approve, reject, bulk_*, import';
COMMENT ON COLUMN public.glossary_audit_logs.metadata IS 'Additional JSON data (e.g., product_codes, approval_status changes)';

-- ============================================================================
-- Migration complete
-- ============================================================================
