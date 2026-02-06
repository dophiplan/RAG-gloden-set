-- =====================================================
-- Migration 007: Organization API Key Access for All Domain Users
-- =====================================================
--
-- Purpose: Allow all @rsupport.com users to manage organization API keys
-- Previously: Only masters could manage organization settings
-- Now: All users with matching domain can manage their organization's API key
--
-- This enables Phase 4-8: 조직 공용 API 키
-- - Rsupport.com에 속한 계정만 키 등록 가능
-- - 조직 전체가 해당 키를 공유
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only masters can view organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Only masters can manage organization settings" ON organization_settings;

-- Create new policy: All authenticated users can view their organization's settings
CREATE POLICY "Users can view their organization settings"
  ON public.organization_settings FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND domain = (
      SELECT SPLIT_PART(email, '@', 2)
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Create new policy: All @rsupport.com users can manage organization settings
-- (primarily for API key registration)
CREATE POLICY "Domain users can manage organization settings"
  ON public.organization_settings FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND domain = (
      SELECT SPLIT_PART(email, '@', 2)
      FROM public.users
      WHERE id = auth.uid()
    )
    AND domain = 'rsupport.com'  -- Restrict to rsupport.com domain only
  );

-- Add comment for documentation
COMMENT ON TABLE public.organization_settings IS 'Organization-wide settings including shared API keys. All users within an organization can view and manage their organization''s settings, but only rsupport.com domain users can modify them.';
