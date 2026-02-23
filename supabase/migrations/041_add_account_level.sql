-- Add account_level column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS account_level TEXT DEFAULT 'user' CHECK (account_level IN ('1st_master', 'master', 'manager', 'user'));

-- Set 1st master for primary admin
UPDATE users
SET account_level = '1st_master'
WHERE email = 'nhkim@rsupport.com';

-- Set master for users with master role
UPDATE users
SET account_level = 'master'
WHERE roles @> ARRAY['master']::TEXT[] AND email != 'nhkim@rsupport.com';

-- Set 1st_master for users with 1st_master role
UPDATE users
SET account_level = '1st_master'
WHERE roles @> ARRAY['1st_master']::TEXT[];

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_account_level ON users(account_level);

-- Add column comment
COMMENT ON COLUMN users.account_level IS 'Account permission level: 1st_master, master, manager, or user';
