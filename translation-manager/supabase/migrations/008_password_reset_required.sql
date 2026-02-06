-- =====================================================
-- Migration 008: Add password reset required field
-- =====================================================
--
-- Purpose: Support password-based authentication for bulk-uploaded users
-- - Add password_reset_required flag to force password change on first login
-- - Users created via bulk upload will have this set to true
-- =====================================================

-- Add password_reset_required column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.users.password_reset_required IS 'Set to true when user is created via bulk upload with default password. User must change password on first login.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_password_reset_required 
  ON public.users(password_reset_required) 
  WHERE password_reset_required = true;
