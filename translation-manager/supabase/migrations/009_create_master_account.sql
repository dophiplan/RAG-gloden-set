-- =====================================================
-- Migration 009: Create Master Account
-- =====================================================
--
-- Purpose: Register nhkim@rsupport.com as master account
-- Note: This creates a user record. The actual auth account with password
-- must be created separately via Supabase dashboard or API
-- =====================================================

-- Insert master user record
-- Note: The id (UUID) should match the auth.users id created in Supabase Auth
-- For now, we'll use a placeholder UUID. After creating the auth account,
-- update this with the actual UUID.

-- This is a data migration that should be run manually after creating
-- the auth account with password "111111" in Supabase dashboard

-- Placeholder for documentation:
-- 1. Go to Supabase Dashboard -> Authentication -> Users
-- 2. Create user: nhkim@rsupport.com with password "111111"
-- 3. Copy the generated UUID
-- 4. Run the following INSERT with the actual UUID:

-- INSERT INTO public.users (id, email, name, roles, password_reset_required)
-- VALUES (
--   'REPLACE_WITH_ACTUAL_UUID',  -- Replace with UUID from auth.users
--   'nhkim@rsupport.com',
--   'Nanhee Kim',
--   ARRAY['master']::TEXT[],
--   true  -- Will be prompted to change password on first login
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   roles = ARRAY['master']::TEXT[],
--   password_reset_required = true;

-- Add comment
COMMENT ON TABLE public.users IS 'Extended user profiles. Master user: nhkim@rsupport.com with password "111111" (must change on first login)';
