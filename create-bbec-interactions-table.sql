-- Manual table creation script for BBEC Interactions table
-- Run this in Heroku PostgreSQL database to create the bbec_interactions table

-- Create the bbec_interactions table for storing interaction data fetched from BBEC API
CREATE TABLE IF NOT EXISTS bbec_interactions (
    id SERIAL PRIMARY KEY,
    constituent_id TEXT NOT NULL,                    -- GUID from BBEC
    name TEXT NOT NULL,                              -- Full name (first and last together)
    last_name TEXT NOT NULL,                         -- Last name
    lookup_id TEXT NOT NULL,                         -- User-friendly ID (U, Z, or 8 prefix)
    interaction_lookup_id TEXT NOT NULL,             -- User-friendly unique ID for interaction
    interaction_id TEXT NOT NULL,                    -- GUID unique ID for interaction
    summary TEXT,                                    -- Short description
    comment TEXT,                                    -- Long verbose detailed description
    date TIMESTAMP NOT NULL,                         -- Date of interaction
    contact_method TEXT,                             -- Type of meeting (in-person, zoom, email, etc.)
    prospect_manager_id TEXT NOT NULL,               -- GUID of prospect manager
    last_synced TIMESTAMP DEFAULT NOW() NOT NULL,   -- When last synced from BBEC
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,    -- When record was created
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL     -- When record was last updated
);

-- Create unique index for upserts and efficient lookups  
CREATE UNIQUE INDEX IF NOT EXISTS bbec_interactions_constituent_interaction_uidx 
    ON bbec_interactions(constituent_id, interaction_id);

CREATE INDEX IF NOT EXISTS bbec_interactions_prospect_manager_idx 
    ON bbec_interactions(prospect_manager_id);

CREATE INDEX IF NOT EXISTS bbec_interactions_date_idx 
    ON bbec_interactions(date);

-- Add a comment to the table for documentation
COMMENT ON TABLE bbec_interactions IS 'Stores interaction data fetched from BBEC API for the past two years of interactions for constituents';

-- Add comments to key columns
COMMENT ON COLUMN bbec_interactions.constituent_id IS 'GUID primary key for each prospect record from BBEC';
COMMENT ON COLUMN bbec_interactions.interaction_id IS 'GUID unique identifier for each interaction record from BBEC';
COMMENT ON COLUMN bbec_interactions.lookup_id IS 'User-friendly ID that begins with U, Z or 8';
COMMENT ON COLUMN bbec_interactions.prospect_manager_id IS 'GUID of the prospect manager/portfolio owner';

-- Verify table creation
SELECT 'bbec_interactions table created successfully' AS result;