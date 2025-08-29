#!/usr/bin/env node
/**
 * Heroku post-build script to ensure required database tables exist
 * Runs after the build process but before the app starts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function ensureRequiredTables() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 Ensuring required database tables exist...');
    
    // Create sessions table for authentication
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar(255) NOT NULL,
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      );
    `);
    console.log('✅ Sessions table verified/created');
    
    // Create ai_jobs table for async processing
    await pool.query(`
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
    `);
    console.log('✅ AI jobs table verified/created');
    
    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON ai_jobs(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);',
      'CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);'
    ];
    
    for (const indexSQL of indexes) {
      await pool.query(indexSQL);
    }
    
    console.log('✅ Database indexes verified/created');
    console.log('🎉 All required database tables are ready!');
    
  } catch (error) {
    console.error('❌ Database table creation failed:', error);
    // Don't exit with error - let the app start anyway
    console.warn('⚠️ App will continue but some features may not work properly');
  } finally {
    await pool.end();
  }
}

// Run the setup
ensureRequiredTables();