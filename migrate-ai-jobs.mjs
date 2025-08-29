#!/usr/bin/env node
/**
 * Migration script to create ai_jobs table in production database
 * Run with: node migrate-ai-jobs.mjs
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function migrateAiJobsTable() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 Creating ai_jobs table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ai_jobs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        input JSONB NOT NULL,
        result JSONB,
        error TEXT,
        progress INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;
    
    await pool.query(createTableSQL);
    console.log('✅ ai_jobs table created successfully');
    
    // Create indexes for performance
    console.log('🔄 Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON ai_jobs(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);',
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);'
    ];
    
    for (const indexSQL of indexes) {
      await pool.query(indexSQL);
    }
    
    console.log('✅ Indexes created successfully');
    console.log('🎉 Migration completed! ai_jobs table is ready for async processing');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateAiJobsTable();