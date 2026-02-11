-- Create rate_limits table for tracking API rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp ON rate_limits(timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_timestamp ON rate_limits(user_id, action, timestamp);

-- Add RLS policies
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own rate limits
CREATE POLICY "Users can view own rate limits"
  ON rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all rate limits
CREATE POLICY "Service role can manage all rate limits"
  ON rate_limits
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add comment
COMMENT ON TABLE rate_limits IS 'Tracks API rate limits for users to prevent abuse and control costs';
COMMENT ON COLUMN rate_limits.action IS 'Action identifier (e.g., ai_translation, bulk_create)';
COMMENT ON COLUMN rate_limits.timestamp IS 'Unix timestamp of the request';

-- Create function to clean up old rate limit entries (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours');
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Cleans up rate limit entries older than 24 hours to prevent table bloat';
