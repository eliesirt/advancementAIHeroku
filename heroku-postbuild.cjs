#!/usr/bin/env node

// Ultra-simple Heroku build that mirrors exactly what works locally
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Heroku build starting...');

try {
  // Step 1: Force TypeScript compilation with explicit settings
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc --outDir dist --rootDir . --esModuleInterop --module ES2020 --target ES2020 --skipLibCheck --noEmitOnError false server/**/*.ts shared/**/*.ts', { stdio: 'inherit' });
  
  // Step 2: Build frontend
  console.log('🎨 Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  // Step 3: Create entry point
  console.log('🔧 Creating entry point...');
  const entryPoint = path.join(__dirname, 'dist', 'index.js');
  fs.writeFileSync(entryPoint, 'import "./server/index.js";');
  
  console.log('✅ Build complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
