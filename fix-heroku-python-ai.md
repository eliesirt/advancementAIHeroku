# Fix Heroku pythonAI Script Creation Issue

## Problem
The "Create Script" button fails in Heroku production with "Error Failed to create script" message. This works in Replit development but not in Heroku production.

## Root Cause Analysis
1. **Production Database Missing Tables**: The Heroku production database likely doesn't have the Python script tables (`python_scripts`, `script_executions`, etc.)
2. **Schema Mismatch**: Production database schema may be outdated compared to the latest schema definitions
3. **Fast Startup Mode**: Production uses fast startup mode which may have different error handling

## Solutions (Execute in Order)

### Solution 1: Update Production Database Schema
Run this command in Heroku CLI to update the database schema:

```bash
# First, check your Heroku app name
heroku apps

# Push database schema to production (replace 'your-app-name' with actual app name)
heroku run --app your-app-name npm run db:push

# Alternative: Run drizzle push directly
heroku run --app your-app-name npx drizzle-kit push

# Example if your app is named 'advancement-ai':
heroku run --app advancement-ai npm run db:push
heroku run --app advancement-ai npx drizzle-kit push
```

### Solution 2: Verify Database Tables Exist
Connect to production database and verify tables exist:

```bash
# Connect to production database
heroku pg:psql

# Check if python_scripts table exists
\dt python_scripts

# Check all tables
\dt

# If tables don't exist, create them manually:
CREATE TABLE IF NOT EXISTS python_scripts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    owner_id VARCHAR NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    requirements TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    status TEXT DEFAULT 'draft',
    git_hash TEXT,
    git_branch TEXT DEFAULT 'main',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS script_executions (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL,
    schedule_id INTEGER,
    triggered_by VARCHAR NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    inputs JSONB,
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    duration INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    environment_snapshot JSONB,
    artifacts JSONB,
    resource_usage JSONB,
    is_scheduled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Solution 3: Test Script Creation
After updating the schema, test script creation:

1. Go to Heroku app pythonAI section
2. Try creating a simple script:
   - Name: "test_script"
   - Description: "Test script creation"
   - Content: `print("Hello from Heroku!")`
3. Check Heroku logs for detailed error messages:
   ```bash
   heroku logs --tail
   ```

### Solution 4: Debug Mode (If Still Failing)
If creation still fails, enable detailed logging by checking Heroku logs while creating a script.

The updated production code now includes extensive logging:
- `🐍 [HEROKU] Creating Python script:`
- `🐍 [HEROKU] Script data prepared:`
- `🐍 [HEROKU] Storage imported successfully`
- `🐍 [HEROKU] Script created successfully:`
- `🚨 [HEROKU] Error creating Python script:` (if errors occur)

### Solution 5: Manual Database Verification
If the above doesn't work, manually verify the production database:

```sql
-- Check if applications table has pythonAI
SELECT * FROM applications WHERE name = 'pythonai';

-- Check if user has proper permissions
SELECT u.*, r.name as role_name 
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id 
LEFT JOIN roles r ON ur.role_id = r.id 
WHERE u.email = 'elsirt@gmail.com';

-- Check if pythonAI app permissions exist
SELECT * FROM role_applications ra 
JOIN applications a ON ra.application_id = a.id 
WHERE a.name = 'pythonai';
```

## Expected Resolution
After updating the database schema, script creation should work properly. The enhanced error logging will provide specific details if any issues remain.

## Verification Steps
1. ✅ Database schema updated in production
2. ✅ Python script tables exist
3. ✅ pythonAI application visible in launcher
4. ✅ Script creation works without errors
5. ✅ Script execution history displays properly