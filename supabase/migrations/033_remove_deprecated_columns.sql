-- =====================================================
-- Migration: Remove deprecated columns
-- Run this AFTER code is updated to use new FK columns
-- =====================================================

-- NOTE: This migration should be run LAST, after all code is updated

-- 1. Drop deprecated product_code columns
-- ALTER TABLE translations DROP COLUMN IF EXISTS product_code;
-- ALTER TABLE glossary DROP COLUMN IF EXISTS product_code;

-- 2. Drop deprecated status/priority/scope TEXT columns
-- ALTER TABLE translations DROP COLUMN IF EXISTS status;
-- ALTER TABLE translations DROP COLUMN IF EXISTS priority;
-- ALTER TABLE translations DROP COLUMN IF EXISTS scope;

-- 3. Drop work_scope array column
-- ALTER TABLE translations DROP COLUMN IF EXISTS work_scope;

-- 4. Make new FK columns NOT NULL
-- ALTER TABLE translations ALTER COLUMN status_id SET NOT NULL;
-- ALTER TABLE translations ALTER COLUMN priority_id SET NOT NULL;

-- COMMENTED OUT: Uncomment and run these after verifying code works with new columns
-- For now, keep old columns for backward compatibility during transition
