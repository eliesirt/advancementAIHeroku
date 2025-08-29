-- Migration script to add AI model preference settings tables to production Heroku database
-- Run date: 2025-08-29

-- Create system_settings table for application-wide configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_user_specific BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create user_settings table for user-specific setting overrides
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for performance on user settings lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON user_settings(user_id, setting_key);

-- Insert default system setting for AI model preference
INSERT INTO system_settings (key, value, description, category, is_user_specific)
VALUES (
  'ai_model_preference',
  '"gpt-4o"',
  'Default AI model preference for all OpenAI functionality',
  'ai',
  true
) ON CONFLICT (key) DO NOTHING;

-- Verify tables were created successfully
SELECT 'system_settings' as table_name, COUNT(*) as record_count FROM system_settings
UNION ALL
SELECT 'user_settings' as table_name, COUNT(*) as record_count FROM user_settings;