#!/usr/bin/env node

// Production database update script to add pythonAI application
// Run this after deployment: node scripts/add-python-ai-production.js

const { neonConfig, Pool } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function addPythonAIApplication() {
  console.log('🐍 Adding pythonAI application to production database...');
  
  try {
    // Check if pythonAI application already exists
    const existingApp = await pool.query(
      `SELECT id FROM applications WHERE name = 'pythonai'`
    );

    if (existingApp.rows.length > 0) {
      console.log('✅ pythonAI application already exists in production database');
      return;
    }

    // Create the pythonAI application
    const appResult = await pool.query(`
      INSERT INTO applications (name, display_name, description, route, icon, color, is_active, sort_order)
      VALUES ('pythonai', 'pythonAI', 'AI-enhanced Python script management, execution, and scheduling', '/apps/python-ai', 'Code', 'bg-yellow-500', true, 6)
      RETURNING id
    `);

    const pythonAppId = appResult.rows[0].id;
    console.log(`✅ Created pythonAI application with ID: ${pythonAppId}`);

    // Get Administrator and User roles
    const roles = await pool.query(`SELECT id, name FROM roles WHERE name IN ('Administrator', 'User')`);
    const adminRole = roles.rows.find(r => r.name === 'Administrator');
    const userRole = roles.rows.find(r => r.name === 'User');

    // Grant admin role full access to pythonAI
    if (adminRole) {
      await pool.query(`
        INSERT INTO role_applications (role_id, application_id, permissions)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [adminRole.id, pythonAppId, ['read', 'write', 'admin']]);
      console.log('✅ Granted Administrator role access to pythonAI');
    }

    // Grant user role read/write access to pythonAI
    if (userRole) {
      await pool.query(`
        INSERT INTO role_applications (role_id, application_id, permissions)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [userRole.id, pythonAppId, ['read', 'write']]);
      console.log('✅ Granted User role access to pythonAI');
    }

    console.log('🎉 Successfully added pythonAI application to production database!');
    console.log('   Users should now see the pythonAI app in their launcher.');

  } catch (error) {
    console.error('❌ Error adding pythonAI application:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
addPythonAIApplication().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});