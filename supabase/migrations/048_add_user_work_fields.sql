-- Migration: Add work_scope and work_languages columns to users table
-- Created: 2026-03-06
-- Description: Add fields for user work scope and language preferences

-- Add work_scope column (array of strings)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS work_scope TEXT[] DEFAULT '{}';

-- Add work_languages column (array of strings)  
ALTER TABLE users
ADD COLUMN IF NOT EXISTS work_languages TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN users.work_scope IS '작업 범위 (예: ["translation", "review", "deploy"])';
COMMENT ON COLUMN users.work_languages IS '작업 언어 (예: ["ko", "en", "ja"])';
