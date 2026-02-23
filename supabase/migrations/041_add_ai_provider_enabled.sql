-- Add enabled flags for AI providers
-- Allows users to temporarily disable providers without deleting API keys

ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS openai_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS claude_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kimi_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gemini_enabled BOOLEAN DEFAULT true;

-- Also add to user_settings for individual user control
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS openai_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS claude_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kimi_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gemini_enabled BOOLEAN DEFAULT true;
