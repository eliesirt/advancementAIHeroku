#!/usr/bin/env node
/**
 * Database Connection Diagnostic Script for Heroku
 * This script helps diagnose and fix DATABASE_URL issues on Heroku
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

console.log('=== Heroku Database Connection Diagnostic ===');
console.log('Current timestamp:', new Date().toISOString());
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.log('\nTo fix this on Heroku:');
  console.log('heroku config:set DATABASE_URL="your-neon-connection-string" -a your-app-name');
  process.exit(1);
}

// Parse and display connection info (safely)
try {
  const url = new URL(databaseUrl);
  console.log('\n=== Connection Details ===');
  console.log('Protocol:', url.protocol);
  console.log('Hostname:', url.hostname);
  console.log('Port:', url.port || 'default');
  console.log('Database:', url.pathname.substring(1));
  console.log('Username:', url.username);
  
  // Check if this looks like a Neon URL
  const isNeonUrl = url.hostname.includes('neon.tech') || url.hostname.includes('neondb.postgres');
  console.log('Appears to be Neon URL:', isNeonUrl);
  
  if (!isNeonUrl) {
    console.warn('⚠️  WARNING: This does not appear to be a Neon database URL!');
    console.log('Expected hostname pattern: *.neon.tech or *.neondb.postgres');
    console.log('Current hostname:', url.hostname);
  }
  
} catch (error) {
  console.error('❌ Invalid DATABASE_URL format:', error.message);
  process.exit(1);
}

// Test the connection
console.log('\n=== Testing Database Connection ===');
try {
  const sql = neon(databaseUrl);
  console.log('Created Neon client...');
  
  const result = await sql`SELECT 
    version() as postgres_version,
    current_database() as database_name,
    current_user as username,
    now() as current_time
  `;
  
  console.log('✅ Database connection successful!');
  console.log('PostgreSQL Version:', result[0].postgres_version);
  console.log('Database Name:', result[0].database_name);
  console.log('Username:', result[0].username);
  console.log('Server Time:', result[0].current_time);
  
  // Test a simple table query
  try {
    const tableTest = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5`;
    console.log('✅ Table access successful!');
    console.log('Sample tables:', tableTest.map(t => t.table_name).join(', '));
  } catch (tableError) {
    console.warn('⚠️  Table access warning:', tableError.message);
  }
  
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.error('Error details:', error);
  
  if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
    console.log('\n🔧 SOLUTION:');
    console.log('This appears to be a DNS resolution error.');
    console.log('The DATABASE_URL is pointing to an invalid or old hostname.');
    console.log('\nSteps to fix:');
    console.log('1. Get your correct Neon connection string from neon.tech dashboard');
    console.log('2. Update Heroku config: heroku config:set DATABASE_URL="correct-url" -a your-app-name');
    console.log('3. Restart the app: heroku restart -a your-app-name');
  }
  
  process.exit(1);
}

console.log('\n=== Diagnostic Complete ===');