#!/usr/bin/env node

// Simple Heroku post-build script using CommonJS to avoid module issues
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Heroku post-build starting...');

try {
  // Run standard build
  console.log('📦 Running build...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Create entry point
  console.log('🔧 Creating entry point...');
  const entryPoint = path.join(__dirname, 'dist', 'index.js');
  const entryContent = '// Heroku entry point\nimport "./server/index.js";';
  
  if (!fs.existsSync(path.dirname(entryPoint))) {
    fs.mkdirSync(path.dirname(entryPoint), { recursive: true });
  }
  
  fs.writeFileSync(entryPoint, entryContent);
  console.log('✅ Entry point created at dist/index.js');
  
  console.log('🎉 Heroku build completed successfully!');
} catch (error) {
  console.error('❌ Heroku build failed:', error.message);
  process.exit(1);
}