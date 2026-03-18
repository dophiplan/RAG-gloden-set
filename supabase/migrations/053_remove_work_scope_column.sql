-- Migration: Remove work_scope column from users table
-- Created: 2026-03-18
-- Description: Completely remove work_scope after migrating to work_platforms
-- 
-- ⚠️  IMPORTANT: This migration is IRREVERSIBLE. Please backup the users table first.
--     Backup command: CREATE TABLE users_backup_20260318 AS SELECT * FROM users;
--
-- Rollback guide (if needed):
--     1. Restore from backup: INSERT INTO users SELECT * FROM users_backup_20260318;
--     2. Or manually add column: ALTER TABLE users ADD COLUMN work_scope TEXT[];

-- ============================================================================
-- PRE-CHECK: Ensure backup recommendation
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '================================================================================';
  RAISE NOTICE 'MIGRATION 053: Remove work_scope column';
  RAISE NOTICE '--------------------------------------------------------------------------------';
  RAISE NOTICE '⚠️  WARNING: This migration will PERMANENTLY DELETE the work_scope column.';
  RAISE NOTICE '   Please ensure you have a backup of the users table before proceeding.';
  RAISE NOTICE '================================================================================';
END $$;

-- ============================================================================
-- Step 1: Verify migration 052 completed (BLOCKING)
-- ============================================================================
DO $$
DECLARE
  unmigrated_count INTEGER;
  sample_emails TEXT;
BEGIN
  -- Check if any users still have work_scope data but no work_platforms
  SELECT COUNT(*) INTO unmigrated_count
  FROM users 
  WHERE (work_scope IS NOT NULL AND array_length(work_scope, 1) > 0)
    AND (work_platforms IS NULL OR COALESCE(array_length(work_platforms, 1), 0) = 0);
  
  IF unmigrated_count > 0 THEN
    -- Get sample emails for error message
    SELECT string_agg(email, ', ') INTO sample_emails
    FROM (
      SELECT email 
      FROM users 
      WHERE (work_scope IS NOT NULL AND array_length(work_scope, 1) > 0)
        AND (work_platforms IS NULL OR COALESCE(array_length(work_platforms, 1), 0) = 0)
      LIMIT 5
    ) sub;
    
    RAISE EXCEPTION 'Migration 053 blocked: % users have unmigrated work_scope data (samples: %). Please run migration 052 first.',
      unmigrated_count, sample_emails;
  END IF;
END $$;

-- ============================================================================
-- Step 2: Verify work_platforms column exists (BLOCKING)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'work_platforms'
  ) THEN
    RAISE EXCEPTION 'Migration 053 blocked: work_platforms column does not exist. Please run migration 052 first.';
  END IF;
END $$;

-- ============================================================================
-- Step 3: Verify platforms table has data for validation (WARNING)
-- ============================================================================
DO $$
DECLARE
  platform_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO platform_count FROM platforms;
  
  IF platform_count = 0 THEN
    RAISE WARNING 'platforms table is empty. Platform validation may fail for user uploads.';
  ELSE
    RAISE NOTICE 'Found % platforms for validation.', platform_count;
  END IF;
END $$;

-- ============================================================================
-- Step 4: Drop work_scope column (IRREVERSIBLE)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'work_scope'
  ) THEN
    ALTER TABLE users DROP COLUMN work_scope;
    RAISE NOTICE 'Successfully dropped work_scope column.';
  ELSE
    RAISE NOTICE 'work_scope column does not exist, skipping.';
  END IF;
END $$;

-- ============================================================================
-- Step 5: Update comments
-- ============================================================================
COMMENT ON COLUMN users.work_platforms IS '담당 플랫폼 코드 목록 (platforms.code 참조). 예: [android, ios, web]';

-- ============================================================================
-- Step 6: Post-migration verification (BLOCKING)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'work_scope'
  ) THEN
    RAISE EXCEPTION 'Migration 053 failed: work_scope column still exists after drop attempt.';
  END IF;
  
  RAISE NOTICE '================================================================================';
  RAISE NOTICE 'MIGRATION 053 COMPLETED SUCCESSFULLY';
  RAISE NOTICE '--------------------------------------------------------------------------------';
  RAISE NOTICE '✓ work_scope column has been permanently removed.';
  RAISE NOTICE '✓ work_platforms is now the primary column for user platforms.';
  RAISE NOTICE '================================================================================';
END $$;
