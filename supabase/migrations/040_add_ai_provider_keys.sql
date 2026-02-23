-- Add missing AI provider API key columns to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS claude_api_key TEXT,
ADD COLUMN IF NOT EXISTS kimi_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Add comments
COMMENT ON COLUMN public.organization_settings.claude_api_key IS 'Claude (Anthropic) API key';
COMMENT ON COLUMN public.organization_settings.kimi_api_key IS 'Kimi (Moonshot AI) API key';
COMMENT ON COLUMN public.organization_settings.gemini_api_key IS 'Google Gemini API key';
