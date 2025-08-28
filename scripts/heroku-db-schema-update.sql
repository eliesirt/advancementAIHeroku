-- Heroku Production Database Schema Update for pythonAI
-- Run this in Heroku postgres to create missing tables

-- Create python_scripts table if it doesn't exist
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

-- Create script_executions table if it doesn't exist
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

-- Create script_versions table if it doesn't exist
CREATE TABLE IF NOT EXISTS script_versions (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_description TEXT,
    created_by VARCHAR NOT NULL,
    git_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create script_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS script_schedules (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    inputs JSONB,
    max_concurrent_runs INTEGER DEFAULT 1,
    timeout_seconds INTEGER DEFAULT 300,
    created_by VARCHAR NOT NULL,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create script_qc_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS script_qc_results (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    linting_results JSONB,
    security_issues JSONB,
    suggestions JSONB,
    generated_tests TEXT,
    generated_docstrings TEXT,
    quality_score INTEGER,
    created_by VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create script_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS script_permissions (
    id SERIAL PRIMARY KEY,
    script_id INTEGER NOT NULL,
    user_id VARCHAR,
    role_id INTEGER,
    permissions TEXT[] NOT NULL,
    granted_by VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    -- Add foreign key constraints only if they don't already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'python_scripts_owner_id_fkey'
    ) THEN
        ALTER TABLE python_scripts 
        ADD CONSTRAINT python_scripts_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'script_executions_script_id_fkey'
    ) THEN
        ALTER TABLE script_executions 
        ADD CONSTRAINT script_executions_script_id_fkey 
        FOREIGN KEY (script_id) REFERENCES python_scripts(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'script_executions_triggered_by_fkey'
    ) THEN
        ALTER TABLE script_executions 
        ADD CONSTRAINT script_executions_triggered_by_fkey 
        FOREIGN KEY (triggered_by) REFERENCES users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'script_versions_script_id_fkey'
    ) THEN
        ALTER TABLE script_versions 
        ADD CONSTRAINT script_versions_script_id_fkey 
        FOREIGN KEY (script_id) REFERENCES python_scripts(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'script_versions_created_by_fkey'
    ) THEN
        ALTER TABLE script_versions 
        ADD CONSTRAINT script_versions_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_python_scripts_owner_id ON python_scripts(owner_id);
CREATE INDEX IF NOT EXISTS idx_python_scripts_status ON python_scripts(status);
CREATE INDEX IF NOT EXISTS idx_script_executions_script_id ON script_executions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_executions_status ON script_executions(status);
CREATE INDEX IF NOT EXISTS idx_script_executions_triggered_by ON script_executions(triggered_by);

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('python_scripts', 'script_executions', 'script_versions', 'script_schedules', 'script_qc_results', 'script_permissions')
ORDER BY tablename;