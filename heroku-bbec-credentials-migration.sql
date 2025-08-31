-- Heroku Production Database Migration: Add BBEC User-Specific Authentication
-- Run this SQL on your Heroku Postgres database using:
-- heroku pg:psql --app your-app-name < heroku-bbec-credentials-migration.sql

-- Add BBEC username and password columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bbec_username TEXT,
ADD COLUMN IF NOT EXISTS bbec_password TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.bbec_username IS 'User-specific BBEC username for API authentication';
COMMENT ON COLUMN users.bbec_password IS 'User-specific BBEC password for API authentication';

-- Optional: Create index for faster lookups (if needed for performance)
CREATE INDEX IF NOT EXISTS idx_users_bbec_credentials 
ON users(bbec_username) 
WHERE bbec_username IS NOT NULL;

-- Verify the changes
\d users;

-- Show current user records to confirm structure
SELECT id, email, first_name, last_name, bbec_guid, bbec_username, 
       CASE WHEN bbec_password IS NOT NULL THEN '[ENCRYPTED]' ELSE NULL END as has_password
FROM users 
ORDER BY id;