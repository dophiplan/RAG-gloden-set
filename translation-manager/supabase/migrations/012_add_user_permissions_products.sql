-- Add permissions and ensure work_products column exists for users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_products TEXT[] DEFAULT '{}';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_permissions ON users USING GIN(permissions);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);

-- Comment
COMMENT ON COLUMN users.permissions IS 'User permissions: translator, requester, deployer, reviewer';
COMMENT ON COLUMN users.work_products IS 'Products the user works on: RC, RV, RM, etc';
