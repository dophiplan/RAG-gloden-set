-- Migration: Add missing API key columns to organization_settings
-- Created: 2026-03-06
-- Description: Add Claude, Kimi, Gemini API key columns

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS claude_api_key TEXT,
  ADD COLUMN IF NOT EXISTS kimi_api_key TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

COMMENT ON COLUMN public.organization_settings.claude_api_key IS 'Anthropic Claude API key';
COMMENT ON COLUMN public.organization_settings.kimi_api_key IS 'Moonshot Kimi API key';
COMMENT ON COLUMN public.organization_settings.gemini_api_key IS 'Google Gemini API key';
