-- Add deploy_status to translation_platforms table
ALTER TABLE translation_platforms 
ADD COLUMN IF NOT EXISTS deploy_status VARCHAR(20) DEFAULT 'pending' 
CHECK (deploy_status IN ('pending', 'completed'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_translation_platforms_deploy_status 
ON translation_platforms(deploy_status);

-- Add comment for documentation
COMMENT ON COLUMN translation_platforms.deploy_status IS 'Platform deployment status: pending, completed';
