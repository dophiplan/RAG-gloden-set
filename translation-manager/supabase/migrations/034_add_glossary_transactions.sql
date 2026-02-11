-- Add transaction-safe functions for glossary operations
-- Created: 2026-02-11
-- Purpose: Fix P0-3 - Data loss in bulk operations

-- ============================================================================
-- Function: create_glossary_with_products
-- Purpose: Atomically create a glossary term with product associations
-- ============================================================================

CREATE OR REPLACE FUNCTION create_glossary_with_products(
  p_term TEXT,
  p_translation TEXT,
  p_product_code TEXT,
  p_user_id UUID,
  p_source_type TEXT DEFAULT 'manual',
  p_product_codes TEXT[] DEFAULT NULL
) RETURNS glossary AS $$
DECLARE
  v_new_term glossary;
  v_product_code TEXT;
BEGIN
  -- 1. Insert glossary term
  INSERT INTO glossary (
    term,
    translation,
    product_code,
    user_id,
    source_type,
    imported_at
  )
  VALUES (
    p_term,
    p_translation,
    p_product_code,
    p_user_id,
    p_source_type,
    NOW()
  )
  RETURNING * INTO v_new_term;

  -- 2. Create product associations (if provided)
  IF p_product_codes IS NOT NULL AND array_length(p_product_codes, 1) > 0 THEN
    FOREACH v_product_code IN ARRAY p_product_codes
    LOOP
      INSERT INTO glossary_products (glossary_id, product_code)
      VALUES (v_new_term.id, v_product_code)
      ON CONFLICT (glossary_id, product_code) DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Return the created term
  RETURN v_new_term;

  -- Note: If any step fails, the entire transaction is rolled back automatically
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE NOTICE 'Error in create_glossary_with_products: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: bulk_approve_glossary
-- Purpose: Atomically approve multiple glossary terms
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_approve_glossary(
  p_term_ids UUID[],
  p_approved_by UUID
) RETURNS TABLE (
  success_count INTEGER,
  failed_count INTEGER
) AS $$
DECLARE
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  -- Update all terms in a single transaction
  WITH updated AS (
    UPDATE glossary
    SET
      approval_status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW()
    WHERE id = ANY(p_term_ids)
      AND approval_status = 'pending' -- Only approve pending terms
    RETURNING id
  )
  SELECT COUNT(*) INTO v_success_count FROM updated;

  -- Calculate failed count
  v_failed_count := array_length(p_term_ids, 1) - v_success_count;

  RETURN QUERY SELECT v_success_count, v_failed_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in bulk_approve_glossary: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: bulk_reject_glossary
-- Purpose: Atomically reject multiple glossary terms
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_reject_glossary(
  p_term_ids UUID[],
  p_approved_by UUID
) RETURNS TABLE (
  success_count INTEGER,
  failed_count INTEGER
) AS $$
DECLARE
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  -- Update all terms in a single transaction
  WITH updated AS (
    UPDATE glossary
    SET
      approval_status = 'rejected',
      approved_by = p_approved_by,
      approved_at = NOW()
    WHERE id = ANY(p_term_ids)
      AND approval_status = 'pending' -- Only reject pending terms
    RETURNING id
  )
  SELECT COUNT(*) INTO v_success_count FROM updated;

  -- Calculate failed count
  v_failed_count := array_length(p_term_ids, 1) - v_success_count;

  RETURN QUERY SELECT v_success_count, v_failed_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in bulk_reject_glossary: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: bulk_delete_glossary
-- Purpose: Atomically delete multiple glossary terms
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_delete_glossary(
  p_term_ids UUID[]
) RETURNS TABLE (
  success_count INTEGER,
  failed_count INTEGER
) AS $$
DECLARE
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  -- Delete all terms in a single transaction
  -- Related glossary_products are automatically deleted (ON DELETE CASCADE)
  WITH deleted AS (
    DELETE FROM glossary
    WHERE id = ANY(p_term_ids)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_success_count FROM deleted;

  -- Calculate failed count
  v_failed_count := array_length(p_term_ids, 1) - v_success_count;

  RETURN QUERY SELECT v_success_count, v_failed_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in bulk_delete_glossary: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_glossary_with_products TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_approve_glossary TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_reject_glossary TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_delete_glossary TO authenticated;

-- ============================================================================
-- Test queries (commented out - uncomment to test manually)
-- ============================================================================

-- Test create_glossary_with_products:
-- SELECT * FROM create_glossary_with_products(
--   'Test Term',
--   'Test Translation',
--   'RC',
--   '00000000-0000-0000-0000-000000000000'::UUID,
--   'manual',
--   ARRAY['RC', 'RV']
-- );

-- Test bulk_approve_glossary:
-- SELECT * FROM bulk_approve_glossary(
--   ARRAY['term-id-1', 'term-id-2']::UUID[],
--   'user-id'::UUID
-- );
