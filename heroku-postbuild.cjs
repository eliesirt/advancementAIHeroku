#!/usr/bin/env node

// Use our proven build.cjs script that works
const { execSync } = require('child_process');

console.log('🚀 Heroku build starting...');

try {
  console.log('📦 Running proven build script...');
  execSync('node build.cjs', { stdio: 'inherit' });
  console.log('✅ Heroku build completed successfully!');
} catch (error) {
  console.error('❌ Heroku build failed:', error.message);
  process.exit(1);
}
