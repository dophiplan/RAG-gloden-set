-- Add support for multiple AI provider API keys
-- OpenAI (기존), Claude (Anthropic), Kimi, Gemini (Google)

ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS claude_api_key TEXT,
ADD COLUMN IF NOT EXISTS kimi_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Also add to user_settings if it exists
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS claude_api_key TEXT,
ADD COLUMN IF NOT EXISTS kimi_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
