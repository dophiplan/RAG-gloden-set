-- Migration: Add 1st_master role to nhkim@rsupport.com
-- This role is the highest level admin that cannot be modified by master users

-- Update nhkim@rsupport.com user to have 1st_master role
UPDATE users
SET roles = ARRAY['1st_master']
WHERE email = 'nhkim@rsupport.com';

-- Comment: The 1st_master role is the highest privilege level
-- Only nhkim@rsupport.com should have this role
-- Master users cannot edit or delete accounts with 1st_master role
