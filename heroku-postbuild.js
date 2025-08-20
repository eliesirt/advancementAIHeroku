#!/usr/bin/env node

// This script runs during Heroku's post-build phase
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Heroku post-build starting...');

try {
  // Run our custom build process that works
  console.log('📦 Running production build process...');
  execSync('node build.cjs', { stdio: 'inherit' });
  
  console.log('✅ Heroku build completed successfully!');
} catch (error) {
  console.error('❌ Heroku build failed:', error.message);
  process.exit(1);
}