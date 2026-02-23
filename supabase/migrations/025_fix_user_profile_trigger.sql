-- =====================================================
-- Migration: 025_fix_user_profile_trigger.sql
-- Description: Fix handle_new_user() trigger to include roles column
-- Issue: Migration 006 added roles column but didn't update the trigger
-- =====================================================

-- Update the user profile creation function to include roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, roles, permissions, work_products)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url',
    ARRAY['user']::TEXT[],        -- Default role: 'user'
    ARRAY[]::TEXT[],               -- Empty permissions (no restrictions)
    ARRAY[]::TEXT[]                -- Empty work_products (no restrictions)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    -- Don't overwrite roles if they already exist
    roles = CASE
      WHEN public.users.roles IS NULL OR array_length(public.users.roles, 1) IS NULL
      THEN EXCLUDED.roles
      ELSE public.users.roles
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger (ensuring it's up to date)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Backfill: Fix existing users with empty roles
-- =====================================================

-- Update existing users who have empty or null roles
UPDATE public.users
SET
  roles = ARRAY['user']::TEXT[],
  permissions = COALESCE(permissions, ARRAY[]::TEXT[]),
  work_products = COALESCE(work_products, ARRAY[]::TEXT[])
WHERE
  roles IS NULL
  OR array_length(roles, 1) IS NULL
  OR array_length(roles, 1) = 0;

-- =====================================================
-- Verification
-- =====================================================

-- Show users with their roles
SELECT
  id,
  email,
  name,
  roles,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
